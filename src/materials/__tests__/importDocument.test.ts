import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { importDocument } from '../importDocument';

async function fixture(name: string): Promise<File> {
  const bytes = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  return new File([bytes], name);
}

describe('local material import', () => {
  it.each([['sample.TXT', 'txt'], ['sample.md', 'markdown']])('extracts %s without interpreting markup', async (name, format) => {
    const text = '# Synthetic 项目\n\n<script>fictional()</script>';
    expect(await importDocument(new File([text], name))).toEqual({ text, format, sourceFileName: name });
  });
  it('extracts real DOCX as plain text, never executes its hyperlink', async () => {
    const result = await importDocument(await fixture('synthetic.docx'));
    expect(result).toEqual({ text: 'Synthetic project alpha\n\nSynthetic link label\n\n', format: 'docx', sourceFileName: 'synthetic.docx' });
    expect('fixtureExecuted' in globalThis).toBe(false);
  });
  it('extracts real PDF and retains exact page text boundaries', async () => {
    expect(await importDocument(await fixture('synthetic.pdf'))).toEqual({
      text: 'Synthetic project alpha\n\nSynthetic research beta', format: 'pdf', sourceFileName: 'synthetic.pdf',
      pages: [{ pageNumber: 1, text: 'Synthetic project alpha' }, { pageNumber: 2, text: 'Synthetic research beta' }],
    });
  });
  it('extracts a real Chinese PDF using predefined CMaps', async () => {
    expect((await importDocument(await fixture('chinese.pdf'))).text).toBe('虚构项目用户研究');
  });
  it('does not execute embedded PDF JavaScript or follow URI actions', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'));
    try {
      expect((await importDocument(await fixture('active-content.pdf'))).text).toBe('Synthetic project alpha\n\nSynthetic research beta');
      expect('fixtureExecuted' in globalThis).toBe(false);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it.each(['encrypted.pdf', 'encrypted-empty-password.pdf'])('rejects encrypted %s', async name => {
    await expect(importDocument(await fixture(name))).rejects.toMatchObject({ code: 'ENCRYPTED_PDF' });
  });
  it('rejects a real image-only scanned PDF', async () => {
    await expect(importDocument(await fixture('scanned.pdf'))).rejects.toMatchObject({ code: 'SCANNED_PDF' });
  });
  it('rejects image-only scanned pages in mixed PDFs, without rejecting blank pages', async () => {
    await expect(importDocument(await fixture('mixed-scan.pdf'))).rejects.toMatchObject({ code: 'SCANNED_PDF' });
    expect(await importDocument(await fixture('blank-page.pdf'))).toMatchObject({
      text: '\n\nSynthetic text page', pages: [{ pageNumber: 1, text: '' }, { pageNumber: 2, text: 'Synthetic text page' }],
    });
  });
  it.each(['legacy.doc', 'image.png', 'macro.docm', 'fake.constructor'])('rejects unsupported %s', async name => {
    await expect(importDocument(new File(['fictional'], name))).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
  });
  it('rejects malformed parser inputs', async () => {
    await expect(importDocument(new File(['not a PDF'], 'bad.pdf'))).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    await expect(importDocument(new File(['not a ZIP'], 'bad.docx'))).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
  });
  it('accepts exactly 50000 characters and rejects 50001 without truncation', async () => {
    expect((await importDocument(new File(['x'.repeat(50000)], 'exact.txt'))).text).toHaveLength(50000);
    await expect(importDocument(new File(['x'.repeat(50001)], 'over.txt'))).rejects.toMatchObject({ code: 'TEXT_TOO_LONG' });
    await expect(importDocument(await fixture('too-long.docx'))).rejects.toMatchObject({ code: 'TEXT_TOO_LONG' });
    expect((await importDocument(await fixture('exact-limit.docx'))).text).toHaveLength(50000);
  });
  it('enforces the exact PDF extracted-text boundary including page separators', async () => {
    expect((await importDocument(await fixture('exact-limit.pdf'))).text).toHaveLength(50000);
    await expect(importDocument(await fixture('over-limit.pdf'))).rejects.toMatchObject({ code: 'TEXT_TOO_LONG' });
  });
  it('accepts the 5 MiB file-size boundary and rejects one byte above before reading', async () => {
    const exact = new File(['x'.repeat(5 * 1024 * 1024)], 'exact.txt');
    await expect(importDocument(exact)).rejects.toMatchObject({ code: 'TEXT_TOO_LONG' });
    await expect(importDocument(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'over.txt'))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
  it('rejects empty text', async () => {
    await expect(importDocument(new File([' \n\t'], 'empty.md'))).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });
});
