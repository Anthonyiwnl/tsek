export const maxDocumentCharacters = 10_000;

export function documentText(content) {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(content);
  return { text: text.trim(), characterCount: [...text].length };
}

export function documentLengthMessage(characterCount) {
  return `This file contains ${characterCount.toLocaleString('en-US')} characters. Use a text file with 1 to 10,000 characters and non-whitespace document text.`;
}
