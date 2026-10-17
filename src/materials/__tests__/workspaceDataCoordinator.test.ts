import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { createMaterialRepository } from '../repository';
import { createEmptyPersonalWorkspaceData } from '../../workflow/personalWorkspace';
import { answerAssets } from '../../domain/sampleData';
import { deleteMaterial, resumePendingDeletions, clearAllUserData, readUserBackup, markMaterialUpdated, persistMaterialUpdate } from '../workspaceDataCoordinator';
import { exportUserBackup, restoreUserBackup, validateUserBackup } from '../backup';
import type { AnswerEvidence } from '../../domain/materialTypes';
import { request, response } from '../../llm/__tests__/fixtures';
import type { FocusFlowDraft } from '../../domain/focusFlowDraft';
import { getMaterialDraftQueue } from '../draftQueue';

const evidence: AnswerEvidence = { documentId: 'd', documentVersion: 1, chunkId: 'c', kind: 'experience', titleSnapshot: 'Synthetic title', quote: 'Synthetic quote', locatorSnapshot: { type: 'page', pageNumber: 2 }, answerParagraphIndex: 0, status: 'validated' };
async function fixture() {
  const repo = createMaterialRepository(new IDBFactory());
  await repo.saveDocument({ id: 'd', kind: 'experience', title: 'Synthetic title', tags: [], text: 'Synthetic quote', sourceFileName: 'fiction.txt', sourceFormat: 'txt', version: 1, createdAt: '2026-10-17', updatedAt: '2026-10-17' }, [{ id: 'c', documentId: 'd', documentVersion: 1, kind: 'experience', title: 'Synthetic title', text: 'Synthetic quote', tags: [], locator: { type: 'paragraph', paragraphIndex: 0 } }], null);
  let workspace = createEmptyPersonalWorkspaceData();
  workspace.answerAssets = [{ ...structuredClone(answerAssets[0]), evidence: [evidence], answerVersions: [{ id: 'v', answer: 'Keep answer', note: 'User note', createdAt: '2026-10-17', source: 'manual-edit', evidence: [evidence] }] }];
  const store = { read: () => workspace, write: vi.fn(async (next: typeof workspace) => { workspace = next; }) };
  return { repo, store };
}
describe('workspace maintenance', () => {
  it('persists_source_update_intent_before_document_write_and_recovers_after_workspace_failure', async () => {
    const { repo, store } = await fixture(); const doc = (await repo.getDocument('d'))!;
    store.write.mockRejectedValueOnce(new Error('quota'));
    await expect(persistMaterialUpdate('d', 1, repo, store, async () => {
      expect(await repo.listDeletions()).toHaveLength(1);
      await repo.saveDocument({ ...doc, text: 'Replacement' }, [], 1);
    })).rejects.toThrow('quota');
    expect((await repo.getDocument('d'))?.version).toBe(2);
    expect(await repo.listDeletions()).toHaveLength(1);
    await resumePendingDeletions(repo, store);
    expect(store.read().answerAssets[0].evidence?.[0].status).toBe('source-updated');
  });
  it('failed_document_write_does_not_falsely_mark_unchanged_source_as_updated', async () => {
    const { repo, store } = await fixture();
    await expect(persistMaterialUpdate('d', 1, repo, store, async () => { throw new Error('quota'); })).rejects.toThrow('quota');
    await resumePendingDeletions(repo, store);
    expect(store.read().answerAssets[0].evidence?.[0].status).toBe('validated');
    expect(await repo.listDeletions()).toEqual([]);
  });
  it('purges_typed_flow_request_response_selections_and_history_without_editing_user_text', async () => {
    const { repo, store } = await fixture();
    const input = request(); input.chunks = [{ ...input.chunks[0], documentId: 'd', documentVersion: 1, chunkId: 'c', title: 'Synthetic title', text: 'Synthetic quote' }];
    const output = { ...response(input), citations: [{ chunkId: 'c', quote: 'Synthetic quote', answerParagraphIndex: 0 }] };
    const flow: FocusFlowDraft = { id: 'focus-flow:unconfirmed', jobId: 'unconfirmed', kind: 'focus-flow', schemaVersion: 1,
      jobDraft: { company: '', roleTitle: '', direction: '', jdText: '' }, rawText: 'User handwritten Synthetic quote', stage: 'answers', activeItemId: 'q1', updatedAt: '',
      materialDraft: { sourceType: 'mixed_material', jobContext: {}, globalInsights: {}, missingInfoWarnings: [], interviewItems: [{ id: 'q1', title: 'User title', improvedAnswer: 'Keep body', answerAssetCandidate: true, confidence: 'high', generation: { provider: 'deepseek', model: 'synthetic', generatedAt: '', generationId: 'g1', origin: 'model' }, answerVersions: store.read().answerAssets[0].answerVersions }] },
      work: { q1: { revision: 1, selectedChunks: [{ documentId: 'd', documentVersion: 1, chunkId: 'c' }], provenance: { kind: 'model', revision: 1, request: input, response: output } } } };
    await repo.saveFlowDraft(flow);
    const backup = exportUserBackup(store.read(), await repo.exportSnapshot());
    expect(validateUserBackup(backup).snapshot.drafts[0]).toEqual(flow);
    await deleteMaterial('d', repo, store);
    const cleaned = (await repo.listFlowDrafts())[0];
    expect(cleaned.rawText).toBe(flow.rawText); expect(cleaned.materialDraft?.interviewItems[0].improvedAnswer).toBe('Keep body');
    expect(cleaned.work.q1).toEqual({ revision: 2, selectedChunks: [] });
    expect(cleaned.materialDraft?.interviewItems[0].generation).toBeUndefined();
    expect(cleaned.materialDraft?.interviewItems[0].answerVersions?.[0].evidence?.[0].status).toBe('source-deleted');
    expect(JSON.stringify(cleaned.work)).not.toContain('Synthetic quote');
  });
  it('intent_failure_makes_no_changes_and_read_failure_is_not_swallowed', async () => {
    const { repo, store } = await fixture(); const before = await repo.exportSnapshot();
    vi.spyOn(repo, 'putDeletion').mockRejectedValueOnce(new Error('quota'));
    await expect(clearAllUserData(repo, store)).rejects.toThrow('quota'); expect(await repo.exportSnapshot()).toEqual(before);
    vi.spyOn(store, 'read').mockImplementationOnce(() => { throw new Error('unavailable'); });
    await expect(deleteMaterial('d', repo, store)).rejects.toThrow('unavailable'); expect(await repo.getDocument('d')).toBeDefined(); expect(await repo.listDeletions()).toHaveLength(1);
  });
  it('clear_failure_leaves_log_and_restart_finishes_both_stores', async () => {
    const { repo, store } = await fixture(); vi.spyOn(repo, 'clearAll').mockRejectedValueOnce(new Error('quota'));
    await expect(clearAllUserData(repo, store)).rejects.toThrow('quota'); expect(await repo.listDeletions()).toHaveLength(1);
    await resumePendingDeletions(repo, store); expect(await repo.exportSnapshot()).toEqual({ documents: [], chunks: [], drafts: [] }); expect(store.read().answerAssets).toEqual([]);
  });
  it('restore_failure_has_durable_original_and_recovers_rollback', async () => {
    const { repo, store } = await fixture(); const original = exportUserBackup(store.read(), await repo.exportSnapshot());
    const target = structuredClone(original); target.snapshot.documents[0].title = 'Replacement'; target.snapshot.chunks[0].title = 'Replacement';
    store.write.mockRejectedValueOnce(new Error('quota')).mockRejectedValueOnce(new Error('quota'));
    await expect(restoreUserBackup(target, repo, store)).rejects.toThrow('quota');
    const journal = (await repo.listDeletions())[0]; expect(journal.kind).toBe('restore-backup'); expect(JSON.stringify(journal)).toContain('originalJson');
    await resumePendingDeletions(repo, store);
    expect(exportUserBackup(store.read(), await repo.exportSnapshot())).toEqual(original); expect(await repo.listDeletions()).toEqual([]);
  });
  it('export_recovers_pending_delete_before_serializing', async () => {
    const { repo, store } = await fixture(); store.write.mockRejectedValueOnce(new Error('quota'));
    await expect(deleteMaterial('d', repo, store)).rejects.toThrow();
    const backup = await readUserBackup(repo, store); expect(backup.snapshot.documents).toEqual([]); expect(backup.workspace.answerAssets[0].evidence?.[0].quote).toBe('');
  });
  it('all_maintenance_waits_for_existing_queue_without_nested_run', async () => {
    const { repo, store } = await fixture(); const order: string[] = []; let release!: () => void;
    const old = getMaterialDraftQueue(repo).run(async () => { await new Promise<void>(resolve => { release = resolve; }); order.push('old'); });
    const deleting = deleteMaterial('d', repo, store).then(() => { order.push('delete'); });
    await Promise.resolve(); release(); await old; await deleting; expect(order).toEqual(['old', 'delete']);
  });
  it('source_updated_preserves_needs_review_and_source_deleted_status', async () => {
    const { repo, store } = await fixture(); store.read().answerAssets[0].evidence = [{ ...evidence, status: 'needs-review' }];
    await markMaterialUpdated('d', repo, store); expect(store.read().answerAssets[0].evidence?.[0].status).toBe('needs-review');
    expect(store.read().answerAssets[0].answerVersions?.[0].evidence?.[0].status).toBe('source-updated');
    await deleteMaterial('d', repo, store); await markMaterialUpdated('d', repo, store);
    expect(store.read().answerAssets[0].evidence?.[0].status).toBe('source-deleted');
  });
  it('purges_all_version_quotes_but_keeps_answer_body', async () => {
    const { repo, store } = await fixture(); const body = store.read().answerAssets[0].improvedAnswer;
    await deleteMaterial('d', repo, store);
    const asset = store.read().answerAssets[0];
    expect(asset.improvedAnswer).toBe(body);
    for (const refs of [asset.evidence, asset.answerVersions?.[0].evidence]) expect(refs).toEqual([{ ...evidence, titleSnapshot: '已删除资料', quote: '', locatorSnapshot: undefined, status: 'source-deleted' }]);
    expect(await repo.listDocuments()).toEqual([]); expect(await repo.listDeletions()).toEqual([]);
  });
  it('resumes_after_workspace_write_failure', async () => {
    const { repo, store } = await fixture(); store.write.mockRejectedValueOnce(new Error('quota'));
    await expect(deleteMaterial('d', repo, store)).rejects.toThrow('quota');
    expect(await repo.listDeletions()).toHaveLength(1); expect(await repo.getDocument('d')).toBeDefined();
    await resumePendingDeletions(repo, store);
    expect(await repo.listDeletions()).toEqual([]); expect(await repo.getDocument('d')).toBeUndefined();
  });
  it('clears_both_stores_before_success', async () => {
    const { repo, store } = await fixture(); await clearAllUserData(repo, store);
    expect(store.read().answerAssets).toEqual([]); expect(await repo.exportSnapshot()).toEqual({ documents: [], chunks: [], drafts: [] });
  });
  it('invalid_backup_preserves_current_data', async () => {
    const { repo, store } = await fixture(); const before = await repo.exportSnapshot();
    await expect(restoreUserBackup({ schemaVersion: 99 } as never, repo, store)).rejects.toThrow();
    expect(await repo.exportSnapshot()).toEqual(before);
    const backup = exportUserBackup(store.read(), before);
    expect(() => validateUserBackup({ ...backup, apiKey: 'forbidden' })).toThrow();
  });
  it('roundtrips_all_optional_fields', async () => {
    const { repo, store } = await fixture();
    store.read().answerAssets[0].sourceQuestionId = 'q';
    store.read().answerAssets[0].modelRationale = { rewriteFocus: 'Actual', applicabilityBoundary: 'Narrow' };
    const backup = exportUserBackup(store.read(), await repo.exportSnapshot());
    expect(validateUserBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
    await clearAllUserData(repo, store); await restoreUserBackup(backup, repo, store);
    expect(exportUserBackup(store.read(), await repo.exportSnapshot())).toEqual(backup);
  });
});
