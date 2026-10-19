import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { MaterialDocument } from '../../domain/materialTypes';
import { chunkDocument } from '../chunkDocument';
import { createMaterialRepository } from '../repository';
import { searchMaterials } from '../searchMaterials';

const document = (text: string, version = 1): MaterialDocument => ({
  id: 'synthetic', version, text, kind: 'knowledge', title: 'Synthetic title', tags: ['research'],
  sourceFormat: 'pdf', createdAt: '2026-10-13', updatedAt: '2026-10-13',
});
describe('material chunking', () => {
  it('uses paragraphs and stable document/version/sequence IDs', () => {
    const result = chunkDocument(document('first\nline\n \nsecond\r\n\u3000\r\nthird'));
    expect(result.map(c => c.text)).toEqual(['first\nline', 'second', 'third']);
    expect(result.map(c => c.id)).toEqual(['synthetic:1:0', 'synthetic:1:1', 'synthetic:1:2']);
    expect(result.map(c => c.locator)).toEqual([0, 1, 2].map(paragraphIndex => ({ type: 'paragraph', paragraphIndex })));
    expect(result[0]).toMatchObject({ title: 'Synthetic title', tags: ['research'], kind: 'knowledge', documentId: 'synthetic', documentVersion: 1 });
  });
  it('hard splits long paragraphs at 1200 without dropping text or breaking surrogate pairs', () => {
    const text = 'x'.repeat(1199) + '😀' + 'y'.repeat(1300);
    const chunks = chunkDocument(document(text));
    expect(chunks.every(c => c.text.length <= 1200)).toBe(true);
    expect(chunks.map(c => c.text).join('')).toBe(text);
    expect(chunks[0].text).toHaveLength(1199);
    expect(chunks.map(c => c.locator)).toEqual(Array(3).fill({ type: 'paragraph', paragraphIndex: 0 }));
  });
  it.each(['. ', '? ', '! ', '。', '？', '！'])('keeps short sentences intact at %s boundaries in a long paragraph', separator => {
    const first = 'a'.repeat(1100) + separator;
    const second = 'b'.repeat(150) + separator.trim();
    const text = first + second;
    const chunks = chunkDocument(document(text));
    expect(chunks.map(c => c.text)).toEqual([first, second]);
    expect(chunks.every(c => c.text.length <= 1200)).toBe(true);
    expect(chunks.map(c => c.text).join('')).toBe(text);
    expect(chunks.map(c => c.locator)).toEqual(Array(2).fill({ type: 'paragraph', paragraphIndex: 0 }));
  });
  it('preserves a sentence-boundary React keyword for real word search', () => {
    const text = 'a'.repeat(1100) + '. ' + 'b'.repeat(95) + ' React improves performance.';
    const chunks = chunkDocument({ ...document(text), tags: [] });
    expect(searchMaterials(chunks, 'React').map(c => c.text)).toEqual(['b'.repeat(95) + ' React improves performance.']);
    expect(chunks.map(c => c.text).join('')).toBe(text);
    expect(chunks.every(c => c.text.length <= 1200)).toBe(true);
  });
  it('packs complete sentences together without reordering or dropping whitespace', () => {
    const first = 'a'.repeat(500) + '.\n';
    const second = 'b'.repeat(500) + '? ';
    const third = 'c'.repeat(300) + '!';
    const text = first + second + third;
    const chunks = chunkDocument(document(text));
    expect(chunks.map(c => c.text)).toEqual([first + second, third]);
    expect(chunks.map(c => c.text).join('')).toBe(text);
    expect(chunks.every(c => c.text.length <= 1200)).toBe(true);
  });
  it('keeps closing quotes with sentences and preserves page locators after sentence splitting', () => {
    const first = '甲'.repeat(1100) + '。”';
    const second = '乙'.repeat(150) + '！';
    const pages = [{ pageNumber: 1, text: first + second }, { pageNumber: 2, text: 'final sentence.' }];
    const doc = document(pages.map(page => page.text).join('\n\n'));
    const chunks = chunkDocument(doc, pages);
    expect(chunks.map(c => c.text)).toEqual([first, second, 'final sentence.']);
    expect(chunks.slice(0, 2).map(c => c.text).join('')).toBe(pages[0].text);
    expect(chunks.every(c => c.text.length <= 1200)).toBe(true);
    expect(chunks.map(c => c.locator)).toEqual([
      { type: 'page', pageNumber: 1, paragraphIndex: 0 },
      { type: 'page', pageNumber: 1, paragraphIndex: 0 },
      { type: 'page', pageNumber: 2, paragraphIndex: 0 },
    ]);
    expect(chunkDocument({ ...doc, text: doc.text + ' edited' }, pages).every(c => c.locator.type === 'paragraph')).toBe(true);
  });
  it('keeps pages only for exact original extracted text', () => {
    const pages = [{ pageNumber: 1, text: 'alpha' }, { pageNumber: 2, text: 'beta\n\ngamma' }];
    const doc = document('alpha\n\nbeta\n\ngamma');
    expect(chunkDocument(doc, pages).map(c => c.locator)).toEqual([
      { type: 'page', pageNumber: 1, paragraphIndex: 0 },
      { type: 'page', pageNumber: 2, paragraphIndex: 0 },
      { type: 'page', pageNumber: 2, paragraphIndex: 1 },
    ]);
    expect(chunkDocument({ ...doc, text: `${doc.text} edited` }, pages).every(c => c.locator.type === 'paragraph')).toBe(true);
    expect(chunkDocument({ ...doc, sourceFormat: 'paste' }, pages).every(c => c.locator.type === 'paragraph')).toBe(true);
  });
  it('returns no chunks for blank text', () => expect(chunkDocument(document(' \n\n '))).toEqual([]));
  it('rejects over-limit edited text rather than silently truncating', () => {
    expect(() => chunkDocument(document('x'.repeat(50001)))).toThrow();
  });
  it('integrates target-version IDs with repository incrementing saves', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    await repo.saveDocument(document('old'), chunkDocument(document('old')), null);
    const previous = (await repo.getDocument('synthetic'))!;
    const next = { ...previous, text: 'new', version: previous.version + 1 };
    await repo.saveDocument(next, chunkDocument(next), previous.version);
    expect((await repo.getDocument('synthetic'))?.version).toBe(2);
    expect(await repo.listChunks()).toEqual([{ id: 'synthetic:2:0', documentId: 'synthetic', documentVersion: 2,
      kind: 'knowledge', title: 'Synthetic title', tags: ['research'], text: 'new', locator: { type: 'paragraph', paragraphIndex: 0 } }]);
  });
});
