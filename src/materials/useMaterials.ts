import { useCallback, useEffect, useRef, useState } from 'react';
import type { MaterialChunk, MaterialDocument } from '../domain/materialTypes';
import { chunkDocument } from './chunkDocument';
import type { PageText } from './importDocument';
import type { MaterialRepository } from './repository';

export function useMaterials(repository: MaterialRepository) {
  const [documents, setDocuments] = useState<MaterialDocument[]>([]);
  const [chunks, setChunks] = useState<MaterialChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true); setError('');
    try {
      const [nextDocuments, nextChunks] = await Promise.all([repository.listDocuments(), repository.listChunks()]);
      if (current === request.current) { setDocuments(nextDocuments); setChunks(nextChunks); }
    } catch { if (current === request.current) setError('资料加载失败'); }
    finally { if (current === request.current) setLoading(false); }
  }, [repository]);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);

  const saveDocument = async (input: MaterialDocument, expectedVersion: number | null, pages?: PageText[], preservePdfLocators = true) => {
    const document = { ...input, version: (expectedVersion ?? 0) + 1 };
    const previous = await repository.getDocument(document.id);
    let nextChunks = chunkDocument(document, pages);
    // A metadata-only edit can retain real persisted PDF locators; never synthesize page numbers.
    if (preservePdfLocators && !pages && previous?.text === document.text && previous.sourceFormat === 'pdf' && document.sourceFormat === 'pdf') {
      const persisted = (await repository.listChunks()).filter(chunk => chunk.documentId === document.id && chunk.documentVersion === expectedVersion);
      if (persisted.length && persisted.some(chunk => chunk.locator.type === 'page')) {
        nextChunks = persisted.map((chunk, index) => ({ ...chunk, id: `${document.id}:${document.version}:${index}`,
          documentVersion: document.version, title: document.title, kind: document.kind, tags: [...document.tags] }));
      }
    }
    await repository.saveDocument(document, nextChunks, expectedVersion);
    await refresh();
    return document;
  };
  return { documents, chunks, loading, error, refresh, saveDocument };
}
