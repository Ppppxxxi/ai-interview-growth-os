import type { MaterialChunk, MaterialDocument, MaterialLocator } from '../domain/materialTypes';
import { MaterialImportError, MAX_MATERIAL_TEXT_LENGTH, type PageText } from './importDocument';

const MAX_CHUNK_LENGTH = 1200;

export function chunkDocument(document: MaterialDocument, pages?: PageText[]): MaterialChunk[] {
  if (document.text.length > MAX_MATERIAL_TEXT_LENGTH) throw new MaterialImportError('TEXT_TOO_LONG');
  if (!Number.isSafeInteger(document.version) || document.version < 1) throw new Error('Invalid material version');
  const chunks: MaterialChunk[] = [];
  const originalPages = document.sourceFormat === 'pdf' && pages?.length &&
    pages.every((page, index) => page.pageNumber === index + 1) &&
    pages.map(page => page.text).join('\n\n') === document.text;
  const sections = originalPages ? pages! : [{ text: document.text }];
  for (const section of sections) {
    const paragraphs = section.text.split(/\r?\n[^\S\r\n]*\r?\n(?:[^\S\r\n]*\r?\n)*/u)
      .map(text => text.trim()).filter(Boolean);
    paragraphs.forEach((text, paragraphIndex) => {
      const locator: MaterialLocator = 'pageNumber' in section
        ? { type: 'page', pageNumber: section.pageNumber, paragraphIndex }
        : { type: 'paragraph', paragraphIndex };
      for (let start = 0; start < text.length;) {
        let end = Math.min(start + MAX_CHUNK_LENGTH, text.length);
        // Keep a UTF-16 surrogate pair together while respecting the character cap.
        if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end--;
        chunks.push({
          id: `${document.id}:${document.version}:${chunks.length}`,
          documentId: document.id, documentVersion: document.version,
          kind: document.kind, title: document.title, text: text.slice(start, end),
          locator: { ...locator }, tags: [...document.tags],
        });
        start = end;
      }
    });
  }
  return chunks;
}
