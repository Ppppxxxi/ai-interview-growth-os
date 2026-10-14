import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore, forceCloseDatabase } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaterialChunk, MaterialDocument, MaterialDraft, PendingDeletion } from '../../domain/materialTypes';
import { createMaterialRepository } from '../repository';
import type { FocusFlowDraft } from '../../domain/focusFlowDraft';

const document = (id = 'doc'): MaterialDocument => ({
  id, kind: 'experience', title: 'Synthetic material', tags: ['test'], text: 'First text',
  sourceFormat: 'paste', version: 1, createdAt: '2026-10-13', updatedAt: '2026-10-13',
});
const chunk = (id = 'chunk', documentId = 'doc'): MaterialChunk => ({
  id, documentId, documentVersion: 1, kind: 'experience', title: 'Synthetic material',
  text: 'First text', locator: { type: 'paragraph', paragraphIndex: 0 }, tags: ['test'],
});
const draft: MaterialDraft = {
  id: 'draft', kind: 'knowledge', title: 'Synthetic draft', tags: [], text: 'Draft',
  sourceFormat: 'paste', selectedChunks: [], updatedAt: '2026-10-13',
};
const deletion: PendingDeletion = {
  id: 'operation', kind: 'delete-document', documentId: 'doc', createdAt: '2026-10-13',
};

afterEach(() => vi.restoreAllMocks());

describe('material repository', () => {
  it('persists_typed_flow_drafts_without_exposing_them_as_document_imports', async () => {
    const factory = new IDBFactory(); const repo = createMaterialRepository(factory);
    const flow: FocusFlowDraft = { id: 'focus-flow:j1', kind: 'focus-flow', schemaVersion: 1, jobId: 'j1', jobDraft: { company: '虚构公司', roleTitle: '', direction: '', jdText: '' }, rawText: '虚构原文', stage: 'input', activeItemId: '', work: {}, updatedAt: '2026-10-15' };
    await repo.saveFlowDraft(flow); await repo.saveDraft(draft);
    expect(await createMaterialRepository(factory).listFlowDrafts()).toEqual([flow]);
    expect(await repo.listDrafts()).toEqual([draft]);
    const snapshot = await repo.exportSnapshot(); expect(snapshot.drafts).toHaveLength(2);
    await repo.clearAll(); await repo.replaceSnapshot(snapshot);
    expect(await repo.listFlowDrafts()).toEqual([flow]); expect(await repo.listDrafts()).toEqual([draft]);
    await expect(repo.saveFlowDraft({ ...flow, schemaVersion: 99 } as unknown as FocusFlowDraft)).rejects.toThrow('INVALID_FLOW_DRAFT');
    await expect(repo.saveFlowDraft({ ...flow, work: { unrelated: { revision: 0, selectedChunks: [] } } })).rejects.toThrow('INVALID_FLOW_DRAFT');
    await expect(repo.replaceSnapshot({ ...snapshot, drafts: [{ ...flow, stage: 'accepted' } as unknown as FocusFlowDraft] })).rejects.toThrow('INVALID_SNAPSHOT');
    expect(await repo.listFlowDrafts()).toEqual([flow]);
  });
  it('persists_after_reopen', async () => {
    const factory = new IDBFactory();
    const first = createMaterialRepository(factory);
    await first.saveDocument(document(), [chunk()], null);
    const reopened = createMaterialRepository(factory);
    expect(await reopened.getDocument('doc')).toEqual(document());
    expect(await reopened.listDocuments()).toEqual([document()]);
    expect(await reopened.listChunks()).toEqual([chunk()]);
    expect(await reopened.getDocument('absent')).toBeUndefined();
  });

  it('increments_version_atomically', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    await repo.saveDocument(document(), [chunk()], null);
    await repo.saveDocument({ ...document(), text: 'Second text', version: 99 },
      [{ ...chunk('replacement'), text: 'Second text', documentVersion: 99 }], 1);
    expect(await repo.getDocument('doc')).toEqual({ ...document(), text: 'Second text', version: 2 });
    expect(await repo.listChunks()).toEqual([{ ...chunk('replacement'), text: 'Second text', documentVersion: 2 }]);
    expect(document().version).toBe(1);
  });

  it('rejects_stale_version', async () => {
    const factory = new IDBFactory();
    const repo = createMaterialRepository(factory);
    await repo.saveDocument(document(), [chunk()], null);
    const other = createMaterialRepository(factory);
    const results = await Promise.allSettled([
      repo.saveDocument({ ...document(), text: 'Writer A' }, [chunk('a')], 1),
      other.saveDocument({ ...document(), text: 'Writer B' }, [chunk('b')], 1),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ message: 'VERSION_CONFLICT', code: 'VERSION_CONFLICT' });
    expect((await repo.getDocument('doc'))?.version).toBe(2);
    await expect(repo.saveDocument(document(), [], null)).rejects.toThrow('VERSION_CONFLICT');
    await expect(repo.saveDocument(document('missing'), [], 1)).rejects.toThrow('VERSION_CONFLICT');
  });

  it('preserves_data_on_quota_error', async () => {
    const factory = new IDBFactory();
    const repo = createMaterialRepository(factory);
    await repo.saveDocument(document(), [chunk()], null);
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof add>) {
      if (this.name === 'chunks') throw new DOMException('Full', 'QuotaExceededError');
      return add.apply(this, args);
    });
    await expect(repo.saveDocument({ ...document(), text: 'Lost write' }, [chunk('new')], 1))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await createMaterialRepository(factory).exportSnapshot()).toEqual({ documents: [document()], chunks: [chunk()], drafts: [] });
  });

  it('retains_pending_deletion', async () => {
    const factory = new IDBFactory();
    const repo = createMaterialRepository(factory);
    await repo.saveDocument(document(), [chunk()], null);
    await repo.saveDocument(document('other'), [chunk('other-chunk', 'other')], null);
    await repo.putDeletion(deletion);
    await repo.deleteDocumentAndChunks('doc');
    await repo.deleteDocumentAndChunks('doc');
    const reopened = createMaterialRepository(factory);
    expect(await reopened.listDeletions()).toEqual([deletion]);
    expect(await reopened.listChunks()).toEqual([chunk('other-chunk', 'other')]);
    expect(await reopened.getDocument('doc')).toBeUndefined();
    await reopened.finishDeletion('operation');
    await reopened.finishDeletion('operation');
    expect(await reopened.listDeletions()).toEqual([]);
  });

  it('saves_and_deletes_drafts_without_mutating_caller_data', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    const input = { ...draft, tags: ['original'] };
    await repo.saveDraft(input);
    input.tags.push('changed');
    expect(await repo.listDrafts()).toEqual([{ ...draft, tags: ['original'] }]);
    await repo.saveDraft({ ...draft, text: 'Updated' });
    expect(await repo.listDrafts()).toEqual([{ ...draft, text: 'Updated' }]);
    await repo.deleteDraft('draft');
    await repo.deleteDraft('draft');
    expect(await repo.listDrafts()).toEqual([]);
  });

  it('clear_and_restore_preserve_recovery_logs', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    await repo.saveDocument(document(), [chunk()], null);
    await repo.saveDraft(draft);
    await repo.putDeletion(deletion);
    const snapshot = await repo.exportSnapshot();
    expect(snapshot).toEqual({ documents: [document()], chunks: [chunk()], drafts: [draft] });
    await repo.clearAll();
    expect(await repo.exportSnapshot()).toEqual({ documents: [], chunks: [], drafts: [] });
    expect(await repo.listDeletions()).toEqual([deletion]);
    await repo.saveDocument(document('other'), [], null);
    await repo.replaceSnapshot(snapshot);
    expect(await repo.exportSnapshot()).toEqual(snapshot);
    expect(await repo.listDeletions()).toEqual([deletion]);
  });

  it('replace_snapshot_rolls_back_all_stores_on_failure', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    await repo.saveDocument(document(), [chunk()], null);
    await repo.saveDraft(draft);
    await repo.putDeletion(deletion);
    const snapshot = await repo.exportSnapshot();
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof add>) {
      if (this.name === 'drafts') throw new DOMException('Full', 'QuotaExceededError');
      return add.apply(this, args);
    });
    await expect(repo.replaceSnapshot({ documents: [document('new')], chunks: [], drafts: [draft] }))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await repo.exportSnapshot()).toEqual(snapshot);
    expect(await repo.listDeletions()).toEqual([deletion]);
  });

  it('isolates_injected_factories_without_swapping_globals', async () => {
    const original = globalThis.indexedDB;
    const a = createMaterialRepository(new IDBFactory());
    const b = createMaterialRepository(new IDBFactory());
    await Promise.all([a.saveDocument(document('a'), [], null), b.saveDocument(document('b'), [], null)]);
    expect((await a.listDocuments()).map(item => item.id)).toEqual(['a']);
    expect((await b.listDocuments()).map(item => item.id)).toEqual(['b']);
    expect(globalThis.indexedDB).toBe(original);
  });

  it('reopens_terminated_connections', async () => {
    const factory = new IDBFactory();
    const open = factory.open.bind(factory);
    let connection: globalThis.IDBDatabase | undefined;
    vi.spyOn(factory, 'open').mockImplementation((...args) => {
      const request = open(...args);
      request.addEventListener('success', () => { connection = request.result; });
      return request;
    });
    const repo = createMaterialRepository(factory);
    await repo.saveDocument(document(), [chunk()], null);
    // fake-indexeddb 6.2.5 declares a constructor here, but expects a database instance.
    forceCloseDatabase(connection! as unknown as Parameters<typeof forceCloseDatabase>[0]);
    expect(await repo.getDocument('doc')).toEqual(document());
    await repo.saveDocument(document(), [chunk()], 1);
    expect((await repo.getDocument('doc'))?.version).toBe(2);
  });

  it('rejects_cross_document_chunks_and_duplicate_ids_without_overwriting', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    await repo.saveDocument(document(), [chunk()], null);
    await expect(repo.saveDocument(document('other'), [chunk('foreign', 'doc')], null)).rejects.toThrow('INVALID_CHUNKS');
    await expect(repo.saveDocument(document('other'), [chunk('chunk', 'other')], null)).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await repo.listDocuments()).toEqual([document()]);
    expect(await repo.listChunks()).toEqual([chunk()]);
  });

  it('rejects_inconsistent_snapshots_without_clearing_existing_data', async () => {
    const repo = createMaterialRepository(new IDBFactory());
    await repo.saveDocument(document(), [chunk()], null);
    await expect(repo.replaceSnapshot({ documents: [document()], chunks: [{ ...chunk(), documentVersion: 2 }], drafts: [] }))
      .rejects.toThrow('INVALID_SNAPSHOT');
    expect(await repo.listChunks()).toEqual([chunk()]);
  });
});
