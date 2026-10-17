import type { MaterialRepository, MaterialSnapshot } from './repository';
import type { PersonalWorkspaceData } from '../workflow/personalWorkspace';
import { BackupSchema, checkBounds } from './backupSchema';
import { restoreValidatedBackup } from './workspaceDataCoordinator';
import { validateEvidence } from '../llm/validateEvidence';
import type { AnswerEvidence, MaterialChunkSelection, MaterialLocator } from '../domain/materialTypes';

export type UserBackup = { schemaVersion: 1; workspace: PersonalWorkspaceData; snapshot: MaterialSnapshot };
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export function validateUserBackup(value: unknown): UserBackup {
  const json = JSON.stringify(value);
  if (!json || new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) throw new Error('备份不能超过 20 MiB');
  checkBounds(value);
  const backup = BackupSchema.parse(value);
  const unique = (items: { id: string }[]) => { if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('重复记录'); };
  for (const items of [backup.snapshot.documents, backup.snapshot.chunks, backup.snapshot.drafts, backup.workspace.jobFiles, backup.workspace.answerAssets, backup.workspace.interviewSessions, backup.workspace.reviewReports]) unique(items);
  const docs = new Map(backup.snapshot.documents.map(doc => [doc.id, doc]));
  const chunks = new Map(backup.snapshot.chunks.map(chunk => [chunk.id, chunk]));
  const normalize = (value: string) => value.replace(/\s+/gu, ' ').trim();
  const selection = (ref: MaterialChunkSelection) => {
    const doc = docs.get(ref.documentId);
    if (!doc) return; // Stale snapshots may predate a source deletion.
    if (ref.documentVersion > doc.version) throw new Error('片段版本非法');
    if (ref.documentVersion === doc.version) {
      const chunk = chunks.get(ref.chunkId);
      if (!chunk || chunk.documentId !== ref.documentId || chunk.documentVersion !== ref.documentVersion) throw new Error('选择片段来源不匹配');
    }
  };
  for (const chunk of chunks.values()) {
    const doc = docs.get(chunk.documentId);
    if (!doc || doc.version !== chunk.documentVersion || doc.kind !== chunk.kind || !doc.text.includes(chunk.text)) throw new Error('片段来源不匹配');
  }
  // Evidence is a historical snapshot, not a foreign key to today's replacement chunks.
  const refs = (items: AnswerEvidence[] | string | undefined, answer: string): void => {
    if (!Array.isArray(items)) return;
    let paragraphs = 0;
    let inParagraph = false;
    for (const line of answer.split(/\r?\n/)) {
      if (!line.trim()) inParagraph = false;
      else if (!inParagraph) { paragraphs += 1; inParagraph = true; }
    }
    for (const ref of items) {
      const doc = docs.get(ref.documentId);
      if (ref.status === 'source-deleted') {
        if (ref.quote || ref.locatorSnapshot || ref.titleSnapshot !== '已删除资料') throw new Error('已删除来源包含摘录');
      } else {
        if (ref.status === 'validated' && !doc) throw new Error('引用来源不存在');
        if (doc && ref.documentVersion > doc.version) throw new Error('引用版本非法');
        if (doc && ref.documentVersion === doc.version) {
          const chunk = chunks.get(ref.chunkId);
          if (!chunk || chunk.documentId !== ref.documentId || chunk.kind !== ref.kind || !normalize(chunk.text).includes(normalize(ref.quote))) throw new Error('引用片段不匹配');
          if (ref.status === 'validated' && (!normalize(ref.quote) || ref.titleSnapshot !== chunk.title || !sameLocator(ref.locatorSnapshot, chunk.locator) || ref.answerParagraphIndex >= paragraphs)) throw new Error('已核对引用的来源或回答段落不匹配');
        }
      }
    }
  };
  const answerRefs = (answer: { improvedAnswer?: string; evidence?: AnswerEvidence[] | string; answerVersions?: { answer: string; evidence?: AnswerEvidence[] }[] }) => {
    refs(answer.evidence, answer.improvedAnswer ?? '');
    for (const version of answer.answerVersions ?? []) refs(version.evidence, version.answer);
  };
  backup.workspace.answerAssets.forEach(answerRefs);
  for (const draft of backup.snapshot.drafts) {
    if (draft.kind !== 'focus-flow') {
      draft.selectedChunks.forEach(selection);
      if (draft.documentId && docs.has(draft.documentId) && (draft.documentVersion ?? Infinity) > docs.get(draft.documentId)!.version) throw new Error('草稿版本非法');
    } else {
      draft.materialDraft?.interviewItems.forEach(answerRefs);
      for (const work of Object.values(draft.work)) {
        work.selectedChunks.forEach(selection);
        const source = work.provenance;
        if (source?.kind === 'model') {
          validateEvidence(source.request, source.response);
          for (const chunk of source.request.chunks) {
            selection(chunk);
            const current = chunks.get(chunk.chunkId);
            if (docs.get(chunk.documentId)?.version === chunk.documentVersion && current && (current.text !== chunk.text || current.kind !== chunk.kind)) throw new Error('发送快照来源不匹配');
          }
        }
      }
    }
  }
  return backup;
}
function sameLocator(snapshot: MaterialLocator | undefined, source: MaterialLocator): boolean {
  if (!snapshot || snapshot.type !== source.type) return false;
  return snapshot.type === 'page' && source.type === 'page'
    ? snapshot.pageNumber === source.pageNumber && snapshot.paragraphIndex === source.paragraphIndex
    : snapshot.type === 'paragraph' && source.type === 'paragraph' && snapshot.paragraphIndex === source.paragraphIndex;
}
export function exportUserBackup(workspace: PersonalWorkspaceData, snapshot: MaterialSnapshot): UserBackup {
  return validateUserBackup(JSON.parse(JSON.stringify({ schemaVersion: 1, workspace, snapshot })));
}
export async function restoreUserBackup(backup: UserBackup, repository: MaterialRepository, workspaceStore: import('./workspaceDataCoordinator').WorkspaceStore): Promise<void> {
  const validated = validateUserBackup(backup);
  await restoreValidatedBackup(validated, repository, workspaceStore);
}
