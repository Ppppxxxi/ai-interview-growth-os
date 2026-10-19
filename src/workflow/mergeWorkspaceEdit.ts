import type { PersonalWorkspaceData } from './personalWorkspace';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export class WorkspaceConflictError extends Error {
  constructor() { super('另一页面已修改相同数据，当前编辑已保留；请核对最新数据后重试'); }
}

// Run inside the fenced queue with a fresh durable read; change only touched entities.
export function mergeWorkspaceEdit(base: PersonalWorkspaceData, edited: PersonalWorkspaceData, latest: PersonalWorkspaceData): PersonalWorkspaceData {
  function merge<T extends { id: string }>(before: T[], after: T[], current: T[]): T[] {
    const original = new Map(before.map(item => [item.id, item]));
    const intended = new Map(after.map(item => [item.id, item]));
    const stored = new Map(current.map(item => [item.id, item]));
    const changed = new Set([...original.keys(), ...intended.keys()].filter(id => !same(original.get(id), intended.get(id))));
    for (const id of changed) {
      if (!same(stored.get(id), original.get(id)) && !same(stored.get(id), intended.get(id))) throw new WorkspaceConflictError();
      // Deletion must not strand a concurrently added dependent entity.
      if (!intended.has(id) && !same(base, latest)) throw new WorkspaceConflictError();
    }
    return [...current.flatMap(item => changed.has(item.id) ? intended.has(item.id) ? [intended.get(item.id)!] : [] : [item]),
      ...after.filter(item => !stored.has(item.id))];
  }
  const next = { ...latest,
    jobFiles: merge(base.jobFiles, edited.jobFiles, latest.jobFiles),
    interviewSessions: merge(base.interviewSessions, edited.interviewSessions, latest.interviewSessions),
    reviewReports: merge(base.reviewReports, edited.reviewReports, latest.reviewReports),
    answerAssets: merge(base.answerAssets, edited.answerAssets, latest.answerAssets),
    selectedJobId: edited.selectedJobId !== base.selectedJobId ? edited.selectedJobId : latest.selectedJobId,
    updatedAt: edited.updatedAt,
  };
  if (!next.jobFiles.some(job => job.id === next.selectedJobId)) throw new WorkspaceConflictError();
  return next;
}
