import type { AnswerEvidence, PendingDeletion } from '../domain/materialTypes';
import type { MaterialRepository, MaterialSnapshot } from './repository';
import { createEmptyPersonalWorkspaceData, type PersonalWorkspaceData } from '../workflow/personalWorkspace';
import { getMaterialDraftQueue } from './draftQueue';
import { acceptWorkspaceEpoch, ensureWorkspaceFence, invalidateWorkspaceEpoch } from './workspaceFence';
import { validateUserBackup, type UserBackup } from './backup';

export interface WorkspaceStore { read(): PersonalWorkspaceData; write(data: PersonalWorkspaceData): Promise<void> }
function maintenanceQueue(repo: MaterialRepository) {
  ensureWorkspaceFence(repo);
  return getMaterialDraftQueue(repo);
}
function cleanEvidence(items: AnswerEvidence[] | undefined, id: string, updated = false): AnswerEvidence[] | undefined {
  return items?.map(ref => ref.documentId !== id || (updated && ref.status === 'source-deleted') ? ref : updated ?
    { ...ref, status: ref.status === 'needs-review' ? 'needs-review' : 'source-updated' } :
    { ...ref, titleSnapshot: '已删除资料', quote: '', locatorSnapshot: undefined, status: 'source-deleted' });
}
function cleanAnswer<T extends { evidence?: AnswerEvidence[] | string; generation?: unknown; answerVersions?: { evidence?: AnswerEvidence[]; generation?: unknown }[] }>(item: T, id: string, updated = false): T {
  const affected = Array.isArray(item.evidence) && item.evidence.some(ref => ref.documentId === id);
  return { ...item, evidence: typeof item.evidence === 'string' ? item.evidence : cleanEvidence(item.evidence, id, updated),
    generation: affected && !updated ? undefined : item.generation,
    ...(item.answerVersions ? { answerVersions: item.answerVersions.map(version => cleanAnswer(version, id, updated)) } : {}) };
}
async function purge(repo: MaterialRepository, store: WorkspaceStore, id: string, updated = false) {
  const workspace = store.read();
  await store.write({ ...workspace, answerAssets: workspace.answerAssets.map(asset => cleanAnswer(asset, id, updated)) });
  const snapshot = await repo.exportSnapshot();
  snapshot.drafts = snapshot.drafts.flatMap<MaterialSnapshot['drafts'][number]>(draft => {
    if (draft.kind !== 'focus-flow') {
      if (!updated && draft.documentId === id) return [];
      return [{ ...draft, selectedChunks: draft.selectedChunks.filter(chunk => chunk.documentId !== id) }];
    }
    const work = Object.fromEntries(Object.entries(draft.work).map(([questionId, value]) => {
      const affected = value.selectedChunks.some(chunk => chunk.documentId === id) ||
        (value.provenance?.kind === 'model' && value.provenance.request.chunks.some(chunk => chunk.documentId === id));
      return [questionId, affected ? { revision: value.revision + 1, selectedChunks: value.selectedChunks.filter(chunk => chunk.documentId !== id) } : value];
    }));
    return [{ ...draft, work, materialDraft: draft.materialDraft && { ...draft.materialDraft, interviewItems: draft.materialDraft.interviewItems.map(item => {
      const cleaned = cleanAnswer(item, id, updated);
      return !updated && work[item.id] !== draft.work[item.id] ? { ...cleaned, generation: undefined } : cleaned;
    }) } }];
  });
  await repo.replaceSnapshot(snapshot);
}
async function replay(task: PendingDeletion, repo: MaterialRepository, store: WorkspaceStore) {
  if (task.kind === 'source-updated') {
    const source = await repo.getDocument(task.documentId);
    if (task.fromVersion === undefined || (source && source.version > task.fromVersion)) await purge(repo, store, task.documentId, true);
  } else if (task.kind === 'delete-document') {
    await purge(repo, store, task.documentId); await repo.deleteDocumentAndChunks(task.documentId);
  } else if (task.kind === 'clear-all') {
    await store.write(task.workspaceJson ? JSON.parse(task.workspaceJson) : createEmptyPersonalWorkspaceData());
    await repo.clearAll();
  } else {
    // Incomplete restore always rolls back. The durable original survives quota/write failure.
    if (!task.originalJson) throw new Error('旧恢复日志缺少原快照，需人工恢复');
    const original = JSON.parse(task.originalJson) as UserBackup;
    await repo.replaceSnapshot(original.snapshot); await store.write(original.workspace);
  }
  await repo.finishDeletion(task.id);
}
async function resumeRaw(repo: MaterialRepository, store: WorkspaceStore) {
  const tasks = await repo.listDeletions();
  if (tasks.length) invalidateWorkspaceEpoch(repo);
  for (const task of tasks) await replay(task, repo, store);
  acceptWorkspaceEpoch(repo);
}
export async function resumePendingDeletions(repo: MaterialRepository, store: WorkspaceStore): Promise<void> {
  await maintenanceQueue(repo).run(() => resumeRaw(repo, store), { maintenance: true });
}
export async function deleteMaterial(id: string, repo: MaterialRepository, store: WorkspaceStore): Promise<void> {
  await maintenanceQueue(repo).run(async () => {
    await resumeRaw(repo, store);
    const task: PendingDeletion = { id: crypto.randomUUID(), kind: 'delete-document', documentId: id, createdAt: new Date().toISOString() };
    await repo.putDeletion(task); invalidateWorkspaceEpoch(repo);
    await replay(task, repo, store);
  }, { maintenance: true });
}
export async function clearAllUserData(repo: MaterialRepository, store: WorkspaceStore): Promise<void> {
  await maintenanceQueue(repo).run(async () => {
    await resumeRaw(repo, store);
    const task: PendingDeletion = { id: crypto.randomUUID(), kind: 'clear-all', workspaceJson: JSON.stringify(createEmptyPersonalWorkspaceData()), createdAt: new Date().toISOString() };
    await repo.putDeletion(task); invalidateWorkspaceEpoch(repo);
    await replay(task, repo, store);
  }, { maintenance: true });
}
export async function restoreValidatedBackup(backup: UserBackup, repo: MaterialRepository, store: WorkspaceStore): Promise<void> {
  await maintenanceQueue(repo).run(async () => {
    await resumeRaw(repo, store);
    const original: UserBackup = { schemaVersion: 1, workspace: store.read(), snapshot: await repo.exportSnapshot() };
    const task: PendingDeletion = { id: crypto.randomUUID(), kind: 'restore-backup', backupJson: JSON.stringify(backup), originalJson: JSON.stringify(original), phase: 'applying', createdAt: new Date().toISOString() };
    await repo.putDeletion(task); invalidateWorkspaceEpoch(repo);
    try { await repo.replaceSnapshot(backup.snapshot); await store.write(backup.workspace); await repo.finishDeletion(task.id); }
    catch (error) {
      try { await repo.putDeletion({ ...task, phase: 'rollback' }); await repo.replaceSnapshot(original.snapshot); await store.write(original.workspace); } catch { /* Durable original remains for the next recovery attempt. */ }
      throw error;
    }
  }, { maintenance: true });
}
export async function readUserBackup(repo: MaterialRepository, store: WorkspaceStore, options: { recoverPending?: boolean } = {}): Promise<UserBackup> {
  const recoverPending = options.recoverPending !== false;
  return maintenanceQueue(repo).run(async () => {
    if (recoverPending) await resumeRaw(repo, store);
    else if ((await repo.listDeletions()).length) throw new Error('本地数据尚未恢复，暂时无法导出');
    return validateUserBackup({ schemaVersion: 1, workspace: store.read(), snapshot: await repo.exportSnapshot() });
  }, recoverPending ? { maintenance: true } : undefined);
}
export async function markMaterialUpdated(id: string, repo: MaterialRepository, store: WorkspaceStore): Promise<void> {
  await maintenanceQueue(repo).run(async () => {
    await resumeRaw(repo, store);
    const task: PendingDeletion = { id: crypto.randomUUID(), kind: 'source-updated', documentId: id, createdAt: new Date().toISOString() };
    await repo.putDeletion(task); invalidateWorkspaceEpoch(repo);
    await replay(task, repo, store);
  }, { maintenance: true });
}

export async function persistMaterialUpdate<T>(id: string, fromVersion: number, repo: MaterialRepository, store: WorkspaceStore, write: () => Promise<T>): Promise<T> {
  return maintenanceQueue(repo).run(async () => {
    await resumeRaw(repo, store);
    const task: PendingDeletion = { id: crypto.randomUUID(), kind: 'source-updated', documentId: id, fromVersion, createdAt: new Date().toISOString() };
    await repo.putDeletion(task); invalidateWorkspaceEpoch(repo);
    const result = await write();
    await replay(task, repo, store);
    return result;
  }, { maintenance: true });
}
