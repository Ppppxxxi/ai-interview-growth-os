import type { MaterialSourceFormat } from '../domain/materialTypes';

export const MAX_MATERIAL_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_MATERIAL_TEXT_LENGTH = 50000;
export type PageText = { pageNumber: number; text: string };
export type ImportedMaterial = {
  text: string;
  format: Exclude<MaterialSourceFormat, 'paste'>;
  sourceFileName: string;
  pages?: PageText[];
};
export type MaterialImportErrorCode = 'FILE_TOO_LARGE' | 'TEXT_TOO_LONG' | 'UNSUPPORTED_FORMAT' |
  'ENCRYPTED_PDF' | 'SCANNED_PDF' | 'EMPTY_DOCUMENT' | 'INVALID_DOCUMENT';

const errorMessages: Record<MaterialImportErrorCode, string> = {
  FILE_TOO_LARGE: '文件不能超过 5 MiB。',
  TEXT_TOO_LONG: '提取文本不能超过 50,000 字符，请拆分资料后重新导入。',
  UNSUPPORTED_FORMAT: '仅支持 TXT、Markdown、DOCX 和文字版 PDF，不支持旧版 DOC。',
  ENCRYPTED_PDF: '不支持加密 PDF，请先导出未加密的文字版 PDF。',
  SCANNED_PDF: '此 PDF 含无法提取的扫描页或没有可提取文字，不支持扫描件或 OCR。',
  EMPTY_DOCUMENT: '资料中没有可提取的文字。',
  INVALID_DOCUMENT: '文件无法完整解析，请检查文件后重新导入。',
};

export class MaterialImportError extends Error {
  constructor(public readonly code: MaterialImportErrorCode) {
    super(errorMessages[code]);
    this.name = 'MaterialImportError';
  }
}

// Only build-time allowlisted data URLs, never document-controlled resource URLs.
class LocalPdfBinaryData {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const cmaps = import.meta.glob<string>('/node_modules/pdfjs-dist/cmaps/*.bcmap', { query: '?url&inline', import: 'default' });
    const fonts = import.meta.glob<string>('/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}', { query: '?url&inline', import: 'default' });
    const loader = kind === 'cMapUrl' ? cmaps[`/node_modules/pdfjs-dist/cmaps/${filename}`] :
      kind === 'standardFontDataUrl' ? fonts[`/node_modules/pdfjs-dist/standard_fonts/${filename}`] : undefined;
    if (!loader) throw new Error('External PDF resources are disabled');
    const url = await loader();
    if (!url.startsWith('data:') || !url.includes(';base64,')) throw new Error('Invalid local PDF resource');
    const binary = atob(url.slice(url.indexOf(',') + 1));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
}

async function extractPdf(file: File): Promise<Pick<ImportedMaterial, 'text' | 'pages'>> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  // Node tests use PDF.js's bundled fake worker; browsers use the emitted same-origin asset.
  if (typeof window !== 'undefined') pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    enableXfa: false, useWorkerFetch: false, useWasm: false,
    disableFontFace: true, useSystemFonts: false, stopAtErrors: true,
    BinaryDataFactory: LocalPdfBinaryData,
  });
  try {
    const pdf = await task.promise;
    // Empty user passwords can load without prompting; permissions still identify encryption.
    if (await pdf.getPermissions() !== null) throw new MaterialImportError('ENCRYPTED_PDF');
    const pages: PageText[] = [];
    let length = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        let text = '';
        for (const item of content.items) {
          if (!('str' in item)) continue;
          text += item.str + (item.hasEOL ? '\n' : ' ');
        }
        text = text.trim();
        if (!text) {
          const operators = await page.getOperatorList();
          const imageOperators = new Set(Object.entries(pdfjs.OPS)
            .filter(([name]) => /^paint.*Image/.test(name)).map(([, value]) => value));
          if (operators.fnArray.some(operator => imageOperators.has(operator))) throw new MaterialImportError('SCANNED_PDF');
        }
        length += text.length + (pages.length ? 2 : 0);
        if (length > MAX_MATERIAL_TEXT_LENGTH) throw new MaterialImportError('TEXT_TOO_LONG');
        pages.push({ pageNumber, text });
      } finally {
        page.cleanup();
      }
    }
    const text = pages.map(page => page.text).join('\n\n');
    if (!text.trim()) throw new MaterialImportError('SCANNED_PDF');
    return { text, pages };
  } catch (error) {
    if (error instanceof MaterialImportError) throw error;
    if (error instanceof Error && error.name === 'PasswordException') throw new MaterialImportError('ENCRYPTED_PDF');
    throw new MaterialImportError('INVALID_DOCUMENT');
  } finally {
    await task.destroy();
  }
}

export async function importDocument(file: File): Promise<ImportedMaterial> {
  if (file.size > MAX_MATERIAL_FILE_BYTES) throw new MaterialImportError('FILE_TOO_LARGE');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const formats = new Map<string, ImportedMaterial['format']>([['txt', 'txt'], ['md', 'markdown'], ['docx', 'docx'], ['pdf', 'pdf']]);
  const format = extension ? formats.get(extension) : undefined;
  if (!format) throw new MaterialImportError('UNSUPPORTED_FORMAT');
  let extracted: Pick<ImportedMaterial, 'text' | 'pages'>;
  try {
    if (format === 'pdf') {
      extracted = await extractPdf(file);
    } else if (format === 'docx') {
      const { default: mammoth } = await import('mammoth/mammoth.browser');
      // extractRawText has no options parameter; external access is disabled in this API.
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (result.messages.some(message => message.type === 'error')) throw new MaterialImportError('INVALID_DOCUMENT');
      extracted = { text: result.value };
    } else {
      extracted = { text: await file.text() };
    }
  } catch (error) {
    if (error instanceof MaterialImportError) throw error;
    throw new MaterialImportError('INVALID_DOCUMENT');
  }
  if (extracted.text.length > MAX_MATERIAL_TEXT_LENGTH) throw new MaterialImportError('TEXT_TOO_LONG');
  if (!extracted.text.trim()) throw new MaterialImportError('EMPTY_DOCUMENT');
  return { ...extracted, format, sourceFileName: file.name };
}
