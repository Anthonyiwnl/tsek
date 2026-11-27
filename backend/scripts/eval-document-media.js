// Explicit, operator-run evaluation only. Never invoked by npm test or CI.
import { readFile, writeFile } from 'node:fs/promises';
import { createDocumentExtractor } from '../src/extraction.js';
import { inspectDocumentMedia } from '../src/document-media.js';
import { textMatches } from '../../scripts/eval/lib.mjs';

if (!process.argv.includes('--live') || !process.env.OPENAI_API_KEY) throw new Error('Live media evaluation requires --live and a separately capped evaluation key.');
const root = new URL('../../scripts/eval/dataset/', import.meta.url);
const dataset = JSON.parse(await readFile(new URL('documents.media.v1.json', root), 'utf8'));
const extract = createDocumentExtractor({ env: { ...process.env, DOCUMENT_MEDIA_ENABLED: 'true' } });
const results = [];
for (const sample of dataset.cases) {
  const content = await readFile(new URL(sample.file, root));
  if (!(await inspectDocumentMedia(content, sample.mediaType)).valid) throw new Error('Invalid evaluation media fixture.');
  const result = await extract({ content, mediaType: sample.mediaType, applicationId: 'evaluation-application', uploadedFileId: sample.id });
  const observations = result.analysis?.observations;
  results.push({ id: sample.id, outcome: result.outcome, correct: result.outcome === 'success'
    && ['documentType','applicantName','address'].every(field => textMatches(sample.expected[field], observations[field].value))
    && observations.readability.status === sample.expected.readability && result.analysis.decisions.outcome === sample.expected.outcome });
}
const report = { mode: 'live', cases: results.length, correct: results.filter(row => row.correct).length, results };
await writeFile(new URL('../../scripts/eval/results/media-pilot.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ cases: report.cases, correct: report.correct }));
if (report.correct < report.cases) process.exitCode = 1;
