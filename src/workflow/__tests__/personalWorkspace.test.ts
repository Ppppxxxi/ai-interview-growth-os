import { describe, expect, it } from 'vitest';
import { answerAssets, jobFiles } from '../../domain/sampleData';
import {
  createJobFileFromDraft,
  createPersonalWorkspaceData,
  PERSONAL_WORKSPACE_STORAGE_KEY,
  readPersonalWorkspace,
  upsertJobFile,
  writePersonalWorkspace
} from '../personalWorkspace';

function createMemoryStorage(initialValue?: string) {
  const store = new Map<string, string>();
  if (initialValue) store.set(PERSONAL_WORKSPACE_STORAGE_KEY, initialValue);

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

describe('personalWorkspace', () => {
  it('reads valid persisted workspace data', () => {
    const persisted = createPersonalWorkspaceData(jobFiles, answerAssets, jobFiles[1].id, '2026-07-10T00:00:00.000Z');
    const storage = createMemoryStorage(JSON.stringify(persisted));

    expect(readPersonalWorkspace(storage, createPersonalWorkspaceData([], []))).toEqual(persisted);
  });

  it('falls back when persisted data is malformed', () => {
    const fallback = createPersonalWorkspaceData(jobFiles, answerAssets, jobFiles[0].id, '2026-07-10T00:00:00.000Z');
    const storage = createMemoryStorage('{not-json');

    expect(readPersonalWorkspace(storage, fallback)).toBe(fallback);
  });

  it('writes workspace data to storage', () => {
    const storage = createMemoryStorage();
    const data = createPersonalWorkspaceData(jobFiles, answerAssets, jobFiles[0].id, '2026-07-10T00:00:00.000Z');

    writePersonalWorkspace(storage, data);

    expect(storage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(JSON.stringify(data));
  });

  it('creates a user job file from form input', () => {
    const job = createJobFileFromDraft(
      {
        company: '  新公司  ',
        roleTitle: ' AI 产品经理 ',
        direction: ' AI 产品 ',
        jdText: ' 负责 AI 产品规划 ',
        stage: ''
      },
      3,
      1000
    );

    expect(job).toMatchObject({
      id: 'job-user-4-rs',
      company: '新公司',
      roleTitle: 'AI 产品经理',
      direction: 'AI 产品',
      jdText: '负责 AI 产品规划',
      stage: '准备中',
      status: '待导入面试对话',
      interviewSessionIds: []
    });
  });

  it('upserts user-created job files', () => {
    const nextJob = { ...jobFiles[0], status: '已更新' };

    expect(upsertJobFile(jobFiles, nextJob)[0].status).toBe('已更新');
    expect(upsertJobFile(jobFiles, createJobFileFromDraft(nextJob, jobFiles.length, 1000))[0].id).toBe('job-user-4-rs');
  });
});
