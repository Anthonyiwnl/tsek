import { parentPort, workerData } from 'node:worker_threads';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const content = Buffer.from(workerData.content);
const dimensions = (width, height) => width > 0 && height > 0 && width <= 4096 && height <= 4096 && width * height <= 4_000_000;
try {
  let metadata;
  if (workerData.mediaType === 'application/pdf') {
    if (!content.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Signature');
    const pdf = await PDFDocument.load(content, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
    if (pdf.getPageCount() < 1 || pdf.getPageCount() > 3) throw new Error('Page count');
    metadata = { pages: pdf.getPageCount() };
  } else if (workerData.mediaType === 'image/png') {
    if (content.length < 24 || !content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      || !dimensions(content.readUInt32BE(16), content.readUInt32BE(20))) throw new Error('Dimensions');
    const png = PNG.sync.read(content, { checkCRC: true });
    metadata = { width: png.width, height: png.height };
  } else if (workerData.mediaType === 'image/jpeg') {
    if (!content.subarray(0, 3).equals(Buffer.from([255,216,255]))) throw new Error('Signature');
    const image = jpeg.decode(content, { useTArray: true, tolerantDecoding: false, maxResolutionInMP: 4, maxMemoryUsageInMB: 64 });
    if (!dimensions(image.width, image.height)) throw new Error('Dimensions');
    metadata = { width: image.width, height: image.height };
  } else throw new Error('Type');
  parentPort.postMessage({ valid: true, ...metadata });
} catch { parentPort.postMessage({ valid: false }); }
