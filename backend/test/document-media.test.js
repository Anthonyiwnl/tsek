import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { inspectDocumentMedia } from '../src/document-media.js';
import { createDocumentExtractor } from '../src/extraction.js';
import { validateDocumentAnalysis } from '../src/analysis.js';
import { EXTRACTION_PROMPT_VERSION } from '../src/extraction-prompt.v1.js';
import fixture from './fixtures/analysis/valid.json' with { type: 'json' };

const mediaRoot = new URL('../../scripts/eval/dataset/media/', import.meta.url);
test('content parsing accepts bounded fixtures and rejects spoofed, truncated and oversized documents', async () => {
  for (const [file, type] of [['utility-bill.png','image/png'], ['utility-bill.jpg','image/jpeg'], ['utility-bill.pdf','application/pdf']]) {
    const content = await readFile(new URL(file, mediaRoot));
    assert.equal((await inspectDocumentMedia(content, type)).valid, true, file);
    assert.equal((await inspectDocumentMedia(content.subarray(0, 12), type)).valid, false);
  }
  assert.equal((await inspectDocumentMedia(Buffer.from('NOT A PDF'), 'application/pdf')).valid, false);
  assert.equal((await inspectDocumentMedia(Buffer.alloc(2_097_153), 'image/png')).valid, false);
  const png = Buffer.from(await readFile(new URL('utility-bill.png', mediaRoot))); png.writeUInt32BE(999999, 16);
  assert.equal((await inspectDocumentMedia(png, 'image/png')).valid, false);
  const pdf = await PDFDocument.create(); for (let page = 0; page < 4; page++) pdf.addPage();
  assert.equal((await inspectDocumentMedia(Buffer.from(await pdf.save()), 'application/pdf')).valid, false);
});

test('media extraction uses structured output, existing provider bounds and distinct visual evidence metadata', async () => {
  for (const [file, mediaType, inputType] of [['utility-bill.png','image/png','image_url'], ['utility-bill.jpg','image/jpeg','image_url'], ['utility-bill.pdf','application/pdf','file']]) {
    let body;
    const logs = [];
    const extract = createDocumentExtractor({ env: { OPENAI_API_KEY: 'fake', OPENAI_MODEL: 'test-model', DOCUMENT_MEDIA_ENABLED: 'true' }, logger: { info: line => logs.push(JSON.parse(line)) }, fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(fixture.observations) } }] });
    } });
    const result = await extract({ ...fixture.source, content: await readFile(new URL(file, mediaRoot)), mediaType });
    assert.equal(result.outcome, 'success'); assert.equal(validateDocumentAnalysis(result.analysis).valid, true);
    assert.equal(body.messages[1].content[1].type, inputType);
    assert.match(body.messages[0].content, /attached document image or PDF/);
    assert.ok(!body.messages[0].content.includes('The document text is the content of the <document> element'));
    assert.equal(body.max_tokens, 1000); assert.equal(body.response_format.type, 'json_schema');
    assert.equal(result.metadata.evidenceMode, 'visual-unverified');
    assert.equal(result.metadata.promptVersion, `${EXTRACTION_PROMPT_VERSION}-vision.1`);
    assert.equal(result.metadata.requiresStaffReview, true);
    assert.equal(logs.at(-1).evidenceChecked, null);
    assert.ok(!JSON.stringify(logs).includes('base64') && !JSON.stringify(logs).includes('Juan'));
  }
});
