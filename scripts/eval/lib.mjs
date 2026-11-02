// Scoring and provider helpers for compare-models.mjs. No dependencies, so it
// runs with plain Node on any team member's PC.

export const DOCUMENT_TYPES = ['Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency', 'Other'];
export const READABILITY = ['clear', 'partially_readable', 'unreadable'];
export const OUTCOMES = ['complete', 'incomplete', 'unreadable', 'needs_review'];
export const FIELDS = ['documentType', 'applicantName', 'address'];

// USD per 1M tokens (input, output), standard short-context rates.
// Check https://openai.com/api/pricing before quoting a cost, and add a model
// with --price name=input/output. Local models are free to run.
export const DEFAULT_PRICES = {
  'gpt-4.1': [2.0, 8.0],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1-nano': [0.1, 0.4],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-5': [1.25, 10.0],
  'gpt-5-mini': [0.25, 2.0],
  'gpt-5-nano': [0.05, 0.4],
};

/** Split "ollama:qwen3.5:9b" into provider "ollama" and model "qwen3.5:9b". */
export function parseModelSpec(spec) {
  const index = spec.indexOf(':');
  if (index <= 0 || index === spec.length - 1) {
    throw new Error(`Model "${spec}" must look like provider:model, e.g. openai:gpt-4.1-mini or ollama:qwen3.5:9b.`);
  }
  const provider = spec.slice(0, index);
  if (!['openai', 'ollama', 'compat', 'mock'].includes(provider)) {
    throw new Error(`Unknown provider "${provider}" in "${spec}". Use openai, ollama, compat or mock.`);
  }
  return { spec, provider, model: spec.slice(index + 1) };
}

/** Pull the JSON object out of a model reply: drops <think> blocks and code fences. */
export function extractJson(text) {
  if (typeof text !== 'string') return { ok: false, error: 'empty reply' };
  let body = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) body = fenced[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'no JSON object in reply' };
  try {
    const value = JSON.parse(body.slice(start, end + 1));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'reply is not a JSON object' };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${error.message}` };
  }
}

const isConfidence = (value) => typeof value === 'number' && value >= 0 && value <= 1;
const isTextObservation = (value) => value !== null && typeof value === 'object'
  && (value.value === null || typeof value.value === 'string') && isConfidence(value.confidence);

/** Check the reply against the shape in prompt.v1.md. Returns a list of problems. */
export function schemaProblems(answer) {
  const problems = [];
  for (const field of FIELDS) {
    if (!isTextObservation(answer[field])) problems.push(`${field} must be {value: string|null, confidence: 0..1}`);
  }
  const typeValue = answer.documentType?.value;
  if (typeof typeValue === 'string' && !DOCUMENT_TYPES.includes(typeValue)) {
    problems.push(`documentType.value "${typeValue}" is not an allowed type`);
  }
  const readability = answer.readability;
  if (!readability || !READABILITY.includes(readability.status) || !isConfidence(readability.confidence)) {
    problems.push('readability must be {status: clear|partially_readable|unreadable, confidence: 0..1}');
  }
  if (!OUTCOMES.includes(answer.outcome)) problems.push('outcome is not an allowed value');
  const missing = answer.missingInformation;
  const ordered = Array.isArray(missing) && missing.every((field) => FIELDS.includes(field))
    && missing.every((field, index) => index === 0 || FIELDS.indexOf(missing[index - 1]) < FIELDS.indexOf(field));
  if (!ordered) {
    problems.push('missingInformation must list documentType, applicantName or address, each once, in that order');
  }
  return problems;
}

/** Lowercase, drop titles and punctuation, collapse spaces. */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(mr|mrs|ms|hon|kap|dr)\b\.?/g, ' ')
    .replace(/\bbrgy\b\.?/g, 'barangay')
    .replace(/\bblk\b\.?/g, 'block')
    .replace(/\bst\b\.?/g, 'street')
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

/** Jaccard overlap of word sets, 0..1. */
export function overlap(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

const numbers = (text) => (normalize(text).match(/\d+/g) ?? []).join(' ');

/**
 * A text field matches when both are null, or both are text with the same
 * numbers (house, lot, purok) in the same order and at least 75% word overlap.
 */
export function textMatches(expected, actual) {
  if (expected === null || expected === undefined) return actual === null;
  if (typeof actual !== 'string' || actual.trim() === '') return false;
  return numbers(expected) === numbers(actual) && overlap(expected, actual) >= 0.75;
}

/**
 * Score one parsed reply against one case. Field accuracy covers the three
 * fields and readability. A field that is absent or malformed never earns a
 * point, even when the expected value is null.
 */
export function scoreAnswer(expected, answer) {
  const valid = (field) => isTextObservation(answer[field]);
  const fields = {
    documentType: valid('documentType') && answer.documentType.value === expected.documentType,
    applicantName: valid('applicantName') && textMatches(expected.applicantName, answer.applicantName.value),
    address: valid('address') && textMatches(expected.address, answer.address.value),
    readability: isConfidence(answer.readability?.confidence)
      && [expected.readability, ...(expected.readabilityAlso ?? [])].includes(answer.readability.status),
  };
  const missing = Array.isArray(answer.missingInformation) ? [...answer.missingInformation].sort() : null;
  return {
    fields,
    fieldScore: Object.values(fields).filter(Boolean).length / 4,
    outcomeCorrect: answer.outcome === expected.outcome,
    missingCorrect: missing !== null && JSON.stringify(missing) === JSON.stringify([...expected.missingInformation].sort()),
  };
}

export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/** Turn per-case results for one model into the summary row. */
export function summarize(spec, results, price) {
  const count = results.length;
  const parsed = results.filter((result) => result.json);
  const valid = parsed.filter((result) => result.schemaProblems.length === 0);
  const scored = results.filter((result) => result.score);
  const latencies = results.filter((result) => result.latencyMs !== null).map((result) => result.latencyMs);
  const inputTokens = results.reduce((sum, result) => sum + (result.usage?.prompt_tokens ?? 0), 0);
  const outputTokens = results.reduce((sum, result) => sum + (result.usage?.completion_tokens ?? 0), 0);
  const cost = price ? (inputTokens * price[0] + outputTokens * price[1]) / 1e6 : null;
  const rate = (part) => (count === 0 ? 0 : part / count);
  return {
    model: spec,
    cases: count,
    errors: results.filter((result) => result.error).length,
    validJson: rate(parsed.length),
    schemaValid: rate(valid.length),
    fieldAccuracy: rate(scored.reduce((sum, result) => sum + result.score.fieldScore, 0)),
    outcomeAccuracy: rate(scored.filter((result) => result.score.outcomeCorrect).length),
    missingAccuracy: rate(scored.filter((result) => result.score.missingCorrect).length),
    latencyMedianMs: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    inputTokens,
    outputTokens,
    costUsd: cost,
  };
}

const pct = (value) => `${(value * 100).toFixed(0)}%`;
const seconds = (ms) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const usd = (value, provider) => {
  if (provider === 'ollama' || provider === 'mock') return '$0 (local)';
  return value === null ? 'unknown price' : `$${value.toFixed(4)}`;
};

/** Markdown table, best outcome accuracy first. */
export function markdownTable(summaries) {
  const rows = [...summaries].sort((a, b) => b.outcomeAccuracy - a.outcomeAccuracy || b.fieldAccuracy - a.fieldAccuracy);
  const lines = [
    '| Model | Valid JSON | Matches schema | Field accuracy | Outcome accuracy | Missing-field list | Median latency | p95 latency | Tokens in/out | Cost for the run | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    const provider = row.model.split(':')[0];
    lines.push(`| \`${row.model}\` | ${pct(row.validJson)} | ${pct(row.schemaValid)} | ${pct(row.fieldAccuracy)} | ${pct(row.outcomeAccuracy)} | ${pct(row.missingAccuracy)} | ${seconds(row.latencyMedianMs)} | ${seconds(row.latencyP95Ms)} | ${row.inputTokens}/${row.outputTokens} | ${usd(row.costUsd, provider)} | ${row.errors} |`);
  }
  return lines.join('\n');
}
