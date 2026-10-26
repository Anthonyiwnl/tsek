import { ProviderError } from './provider.js';

const allowedStatuses = new Set(['complete', 'incomplete', 'uncertain']);
const fieldNamePattern = /^[a-z][a-z0-9_]{0,63}$/;

function invalidAnalysis() {
  throw new ProviderError(
    'The analysis provider returned an unusable response.',
    'AI_INVALID_RESPONSE',
  );
}

function cleanText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

export function normalizeAnalysisResult(rawResult, requirements, selectedDocumentType) {
  let parsed;
  try {
    parsed = JSON.parse(rawResult);
  } catch {
    invalidAnalysis();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalidAnalysis();
  if (Object.keys(parsed).sort().join(',') !== 'detected_document_type,extracted_fields,requirements') {
    invalidAnalysis();
  }

  const detectedDocumentType = cleanText(parsed.detected_document_type, 128);
  const inputFields = parsed.extracted_fields;
  if (!detectedDocumentType || !inputFields || typeof inputFields !== 'object'
    || Array.isArray(inputFields) || Object.keys(inputFields).length > 20) {
    invalidAnalysis();
  }
  const extractedFields = {};
  for (const [name, value] of Object.entries(inputFields)) {
    if (!fieldNamePattern.test(name)
      || (value !== null && (typeof value !== 'string' || value.length > 500))) {
      invalidAnalysis();
    }
    extractedFields[name] = value === null ? null : value.trim();
  }

  if (!Array.isArray(parsed.requirements) || parsed.requirements.length !== requirements.length) {
    invalidAnalysis();
  }
  const decisions = new Map();
  for (const decision of parsed.requirements) {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)
      || Object.keys(decision).sort().join(',') !== 'reason,requirement_id,status'
      || typeof decision.requirement_id !== 'string'
      || decisions.has(decision.requirement_id)
      || !allowedStatuses.has(decision.status)) {
      invalidAnalysis();
    }
    const reason = cleanText(decision.reason, 400);
    if (!reason) invalidAnalysis();
    decisions.set(decision.requirement_id, { status: decision.status, reason });
  }

  const normalizedRequirements = requirements.map(requirement => {
    const decision = decisions.get(requirement.id);
    if (!decision) invalidAnalysis();
    return {
      id: requirement.id,
      name: requirement.name,
      is_required: requirement.is_required,
      status: decision.status,
      reason: decision.reason,
    };
  });
  if (decisions.size !== requirements.length) invalidAnalysis();

  const canonical = value => value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
  return {
    detected_document_type: detectedDocumentType,
    document_type_match: canonical(detectedDocumentType) === canonical(selectedDocumentType),
    extracted_fields: extractedFields,
    requirements: normalizedRequirements,
  };
}

export function computeChecklist(requirements, files) {
  const decisions = requirements.map(requirement => {
    const evidence = files.flatMap(file => {
      const analyzed = file.analysis;
      if (!analyzed || !analyzed.document_type_match || !Array.isArray(analyzed.requirements)) return [];
      const decision = analyzed.requirements.find(item => item.id === requirement.id);
      return decision ? [{ ...decision, file_id: file.id, file_name: file.original_name }] : [];
    });
    const latest = evidence[0];
    return {
      ...requirement,
      status: latest?.status ?? 'uncertain',
      reason: latest?.reason ?? 'No matching analyzed document is available.',
      ...(latest ? { file_id: latest.file_id } : {}),
    };
  });
  return {
    requirements: decisions,
    is_complete: decisions.every(item => !item.is_required || item.status === 'complete'),
  };
}
