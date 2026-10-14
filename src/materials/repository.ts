import { wrap, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { MaterialChunk, MaterialDocument, MaterialDraft, PendingDeletion } from '../domain/materialTypes';
import { FocusFlowDraftSchema, type FocusFlowDraft } from '../domain/focusFlowDraft';
type StoredDraft = MaterialDraft | FocusFlowDraft;

export type MaterialSnapshot = {
  documents: MaterialDocument[];
  chunks: MaterialChunk[];
  drafts: StoredDraft[];
};

export interface MaterialRepository {
  listDocuments(): Promise<MaterialDocument[]>;
  listChunks(): Promise<MaterialChunk[]>;
  getDocument(id: string): Promise<MaterialDocument | undefined>;
  saveDocument(document: MaterialDocument, chunks: MaterialChunk[], expectedVersion: number | null): Promise<void>;
  saveDraft(draft: MaterialDraft): Promise<void>;
  listDrafts(): Promise<MaterialDraft[]>;
  saveFlowDraft(draft: FocusFlowDraft): Promise<void>;
  listFlowDrafts(): Promise<FocusFlowDraft[]>;
  deleteDraft(id: string): Promise<void>;
  putDeletion(task: PendingDeletion): Promise<void>;
  listDeletions(): Promise<PendingDeletion[]>;
  deleteDocumentAndChunks(id: string): Promise<void>;
  finishDeletion(id: string): Promise<void>;
  clearAll(): Promise<void>;
  exportSnapshot(): Promise<MaterialSnapshot>;
  replaceSnapshot(snapshot: MaterialSnapshot): Promise<void>;
}

interface MaterialDatabase extends DBSchema {
  documents: { key: string; value: MaterialDocument };
  chunks: { key: string; value: MaterialChunk; indexes: { documentId: string } };
  drafts: { key: string; value: StoredDraft };
  pendingDeletions: { key: string; value: PendingDeletion };
}

type StoreName = 'documents' | 'chunks' | 'drafts' | 'pendingDeletions';
type Transaction<Mode extends IDBTransactionMode> = IDBPTransaction<MaterialDatabase, StoreName[], Mode>;
const databaseName = 'ai-interview-growth-os-materials';
const databaseVersion = 1;
const dataStores: StoreName[] = ['documents', 'chunks', 'drafts'];

function repositoryError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function validateSnapshot(snapshot: MaterialSnapshot): void {
  for (const draft of snapshot.drafts) if (draft.kind === 'focus-flow' && !FocusFlowDraftSchema.safeParse(draft).success) throw repositoryError('INVALID_SNAPSHOT');
  const documents = new Map(snapshot.documents.map(document => [document.id, document]));
  if (documents.size !== snapshot.documents.length ||
      new Set(snapshot.chunks.map(chunk => chunk.id)).size !== snapshot.chunks.length ||
      new Set(snapshot.drafts.map(draft => draft.id)).size !== snapshot.drafts.length ||
      snapshot.documents.some(document => !Number.isSafeInteger(document.version) || document.version < 1) ||
      snapshot.chunks.some(chunk => documents.get(chunk.documentId)?.version !== chunk.documentVersion)) {
    throw repositoryError('INVALID_SNAPSHOT');
  }
}

export function createMaterialRepository(factory?: IDBFactory): MaterialRepository {
  let connection: Promise<IDBPDatabase<MaterialDatabase>> | undefined;

  function open(): Promise<IDBPDatabase<MaterialDatabase>> {
    if (!connection) {
      const selectedFactory = factory ?? globalThis.indexedDB;
      if (!selectedFactory) throw repositoryError('INDEXEDDB_UNAVAILABLE');
      // openDB uses global indexedDB; wrap is the public API for an injected factory.
      const request = selectedFactory.open(databaseName, databaseVersion);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        db.createObjectStore('documents', { keyPath: 'id' });
        db.createObjectStore('chunks', { keyPath: 'id' }).createIndex('documentId', 'documentId');
        db.createObjectStore('drafts', { keyPath: 'id' });
        db.createObjectStore('pendingDeletions', { keyPath: 'id' });
      });
      const opening = wrap(request) as Promise<IDBPDatabase<MaterialDatabase>>;
      connection = opening;
      void opening.then(db => {
        const invalidate = () => {
          if (connection === opening) connection = undefined;
        };
        db.addEventListener('close', invalidate);
        db.addEventListener('versionchange', () => { db.close(); invalidate(); });
      }, () => {
        if (connection === opening) connection = undefined;
      });
    }
    return connection;
  }

  async function transact<Mode extends IDBTransactionMode, Result>(
    stores: StoreName[], mode: Mode, operation: (tx: Transaction<Mode>) => Promise<Result>,
  ): Promise<Result> {
    let db = await open();
    let tx: Transaction<Mode>;
    try {
      tx = db.transaction(stores, mode);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'InvalidStateError') throw error;
      // Only retry connection acquisition: a failed write is never replayed or hidden.
      db.close();
      connection = undefined;
      db = await open();
      tx = db.transaction(stores, mode);
    }
    const done = tx.done;
    void done.catch(() => {});
    try {
      const result = await operation(tx);
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* An already aborted transaction needs no further action. */ }
      await done.catch(() => {});
      throw error;
    }
  }

  async function removeChunks(tx: Transaction<'readwrite'>, id: string): Promise<void> {
    const store = tx.objectStore('chunks');
    const keys = await store.index('documentId').getAllKeys(id);
    for (const key of keys) await store.delete(key);
  }

  return {
    listDocuments: () => transact(['documents'], 'readonly', tx => tx.objectStore('documents').getAll()),
    listChunks: () => transact(['chunks'], 'readonly', tx => tx.objectStore('chunks').getAll()),
    getDocument: id => transact(['documents'], 'readonly', tx => tx.objectStore('documents').get(id)),
    async saveDocument(document, chunks, expectedVersion) {
      if (chunks.some(chunk => chunk.documentId !== document.id) ||
          new Set(chunks.map(chunk => chunk.id)).size !== chunks.length) throw repositoryError('INVALID_CHUNKS');
      await transact(['documents', 'chunks'], 'readwrite', async tx => {
        const store = tx.objectStore('documents');
        const current = await store.get(document.id);
        if (expectedVersion === null ? current !== undefined :
          !current || current.version !== expectedVersion || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
          throw repositoryError('VERSION_CONFLICT');
        }
        const version = (current?.version ?? 0) + 1;
        if (!Number.isSafeInteger(version)) throw repositoryError('VERSION_CONFLICT');
        await store.put({ ...document, version });
        await removeChunks(tx, document.id);
        for (const chunk of chunks) {
          await tx.objectStore('chunks').add({ ...chunk, documentVersion: version });
        }
      });
    },
    saveDraft: async draft => { await transact(['drafts'], 'readwrite', async tx => { await tx.objectStore('drafts').put(draft); }); },
    listDrafts: async () => (await transact(['drafts'], 'readonly', tx => tx.objectStore('drafts').getAll())).filter((draft): draft is MaterialDraft => draft.kind !== 'focus-flow'),
    async saveFlowDraft(draft) {
      const parsed = FocusFlowDraftSchema.safeParse(draft);
      if (!parsed.success) throw repositoryError('INVALID_FLOW_DRAFT');
      await transact(['drafts'], 'readwrite', async tx => { await tx.objectStore('drafts').put(parsed.data); });
    },
    listFlowDrafts: async () => (await transact(['drafts'], 'readonly', tx => tx.objectStore('drafts').getAll())).filter(draft => draft.kind === 'focus-flow').map(draft => {
      const parsed = FocusFlowDraftSchema.safeParse(draft);
      if (!parsed.success) throw repositoryError('INVALID_FLOW_DRAFT');
      return parsed.data;
    }),
    deleteDraft: async id => { await transact(['drafts'], 'readwrite', async tx => { await tx.objectStore('drafts').delete(id); }); },
    putDeletion: async task => { await transact(['pendingDeletions'], 'readwrite', async tx => { await tx.objectStore('pendingDeletions').put(task); }); },
    listDeletions: () => transact(['pendingDeletions'], 'readonly', tx => tx.objectStore('pendingDeletions').getAll()),
    async deleteDocumentAndChunks(id) {
      await transact(['documents', 'chunks'], 'readwrite', async tx => {
        await tx.objectStore('documents').delete(id);
        await removeChunks(tx, id);
      });
    },
    finishDeletion: async id => { await transact(['pendingDeletions'], 'readwrite', async tx => { await tx.objectStore('pendingDeletions').delete(id); }); },
    async clearAll() {
      await transact(dataStores, 'readwrite', async tx => {
        for (const store of dataStores) await tx.objectStore(store).clear();
      });
    },
    exportSnapshot: () => transact(dataStores, 'readonly', async tx => {
      const [documents, chunks, drafts] = await Promise.all([
        tx.objectStore('documents').getAll(), tx.objectStore('chunks').getAll(), tx.objectStore('drafts').getAll(),
      ]);
      return { documents, chunks, drafts };
    }),
    async replaceSnapshot(snapshot) {
      validateSnapshot(snapshot);
      // The coordinator owns recovery logs, which survive clear/restore until finishDeletion.
      await transact(dataStores, 'readwrite', async tx => {
        for (const store of dataStores) await tx.objectStore(store).clear();
        for (const document of snapshot.documents) await tx.objectStore('documents').add(document);
        for (const chunk of snapshot.chunks) await tx.objectStore('chunks').add(chunk);
        for (const draft of snapshot.drafts) await tx.objectStore('drafts').add(draft);
      });
    },
  };
}
