import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, jobFiles, reviewReports } from '../../domain/sampleData';
import {
  attachInterviewSessionToJob,
  clearPersonalWorkspace,
  createEmptyPersonalWorkspaceData,
  createJobFileFromDraft,
  createPersonalWorkspaceData,
  hasRealWorkspaceData,
  hasPersonalWorkspace,
  PERSONAL_WORKSPACE_STORAGE_KEY,
  readPersonalWorkspace,
  removeJobFile,
  removeInterviewRecord,
  upsertInterviewSession,
  upsertJobFile,
  upsertReviewReport,
  writePersonalWorkspace
} from '../personalWorkspace';

function createMemoryStorage(initialValue?: string) {
  const store = new Map<string, string>();
  if (initialValue) store.set(PERSONAL_WORKSPACE_STORAGE_KEY, initialValue);

  return {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
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

  it('detects and clears persisted workspace data', () => {
    const data = createPersonalWorkspaceData(jobFiles, answerAssets, jobFiles[0].id, '2026-07-10T00:00:00.000Z');
    const storage = createMemoryStorage(JSON.stringify(data));

    expect(hasPersonalWorkspace(storage)).toBe(true);
    clearPersonalWorkspace(storage);

    expect(hasPersonalWorkspace(storage)).toBe(false);
    expect(storage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('creates an empty first-use workspace', () => {
    const workspace = createEmptyPersonalWorkspaceData('2026-07-20T00:00:00.000Z');

    expect(workspace.jobFiles).toHaveLength(1);
    expect(workspace.answerAssets).toHaveLength(0);
    expect(workspace.interviewSessions).toHaveLength(0);
    expect(workspace.reviewReports).toHaveLength(0);
    expect(workspace.jobFiles[0].status).toBe('待粘贴 JD 和面试对话');
  });

  it('detects whether a workspace has real user data', () => {
    const emptyWorkspace = createEmptyPersonalWorkspaceData('2026-07-20T00:00:00.000Z');
    const editedFirstJob = {
      ...emptyWorkspace,
      jobFiles: [{ ...emptyWorkspace.jobFiles[0], company: '我的真实目标公司' }]
    };
    const sampleWorkspace = createPersonalWorkspaceData(jobFiles, [], jobFiles[0].id, '2026-07-10T00:00:00.000Z');
    const sampleIds = jobFiles.map((job) => job.id);

    expect(hasRealWorkspaceData(emptyWorkspace, sampleIds)).toBe(false);
    expect(hasRealWorkspaceData(editedFirstJob, sampleIds)).toBe(true);
    expect(hasRealWorkspaceData(sampleWorkspace, sampleIds)).toBe(false);
    expect(hasRealWorkspaceData({ ...emptyWorkspace, interviewSessions: [interviewSessions[0]] }, sampleIds)).toBe(true);
  });

  it('hydrates old persisted data with fallback sessions and reviews', () => {
    const oldPersisted = {
      version: 1,
      jobFiles,
      answerAssets,
      selectedJobId: jobFiles[0].id,
      updatedAt: '2026-07-10T00:00:00.000Z'
    };
    const fallback = createPersonalWorkspaceData(
      jobFiles,
      answerAssets,
      jobFiles[0].id,
      '2026-07-10T00:00:00.000Z',
      interviewSessions,
      reviewReports
    );
    const storage = createMemoryStorage(JSON.stringify(oldPersisted));

    const hydrated = readPersonalWorkspace(storage, fallback);

    expect(hydrated.interviewSessions).toBe(interviewSessions);
    expect(hydrated.reviewReports).toBe(reviewReports);
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

  it('upserts interview sessions and review reports', () => {
    const nextSession = { ...interviewSessions[0], interviewType: '更新后的记录' };
    const nextReport = { ...reviewReports[0], summary: '更新后的复盘' };

    expect(upsertInterviewSession(interviewSessions, nextSession)[0].interviewType).toBe('更新后的记录');
    expect(upsertReviewReport(reviewReports, nextReport)[0].summary).toBe('更新后的复盘');
    expect(upsertInterviewSession(interviewSessions, { ...nextSession, id: 'new-session' })[0].id).toBe('new-session');
  });

  it('attaches a generated interview session to its job file', () => {
    const session = { ...interviewSessions[0], id: 'session-new' };
    const updatedJobs = attachInterviewSessionToJob(jobFiles, session);

    expect(updatedJobs[0].interviewSessionIds[0]).toBe('session-new');
    expect(updatedJobs[0].status).toBe('2 场面试记录');
  });

  it('removes an interview record and its linked review and answer assets', () => {
    const session = { ...interviewSessions[0], id: 'session-to-delete' };
    const review = { ...reviewReports[0], id: 'review-to-delete', sessionId: session.id };
    const asset = { ...answerAssets[0], id: 'asset-to-delete', sourceInterviewId: session.id, sourceReviewId: review.id };
    const job = {
      ...jobFiles[0],
      interviewSessionIds: [session.id],
      status: '1 场面试记录'
    };
    const workspace = createPersonalWorkspaceData(
      [job, ...jobFiles.slice(1)],
      [asset, ...answerAssets],
      job.id,
      '2026-07-10T00:00:00.000Z',
      [session, ...interviewSessions],
      [review, ...reviewReports]
    );

    const nextWorkspace = removeInterviewRecord(workspace, session.id);

    expect(nextWorkspace.interviewSessions.some((item) => item.id === session.id)).toBe(false);
    expect(nextWorkspace.reviewReports.some((item) => item.sessionId === session.id)).toBe(false);
    expect(nextWorkspace.answerAssets.some((item) => item.sourceInterviewId === session.id)).toBe(false);
    expect(nextWorkspace.jobFiles[0].interviewSessionIds).toEqual([]);
    expect(nextWorkspace.jobFiles[0].status).toBe('待导入面试对话');
  });
  it('removes a job file and all records linked to that job', () => {
    const jobToDelete = jobFiles[0];
    const session = { ...interviewSessions[0], id: 'session-delete-job', jobFileId: jobToDelete.id };
    const review = { ...reviewReports[0], id: 'review-delete-job', sessionId: session.id, jobFileId: jobToDelete.id };
    const directAsset = {
      ...answerAssets[0],
      id: 'asset-delete-job',
      sourceJobId: jobToDelete.id,
      sourceInterviewId: session.id,
      sourceReviewId: review.id
    };
    const feedbackLinkedAsset = {
      ...answerAssets[1],
      id: 'asset-used-for-deleted-job',
      sourceJobId: jobFiles[1].id,
      usageFeedback: {
        status: 'used-effective' as const,
        usedForJobId: jobToDelete.id,
        updatedAt: '2026-07-12T00:00:00.000Z'
      }
    };
    const workspace = createPersonalWorkspaceData(
      jobFiles,
      [directAsset, feedbackLinkedAsset, ...answerAssets],
      jobToDelete.id,
      '2026-07-10T00:00:00.000Z',
      [session, ...interviewSessions],
      [review, ...reviewReports]
    );

    const nextWorkspace = removeJobFile(workspace, jobToDelete.id);

    expect(nextWorkspace.jobFiles.some((job) => job.id === jobToDelete.id)).toBe(false);
    expect(nextWorkspace.interviewSessions.some((item) => item.jobFileId === jobToDelete.id)).toBe(false);
    expect(nextWorkspace.reviewReports.some((item) => item.jobFileId === jobToDelete.id)).toBe(false);
    expect(nextWorkspace.answerAssets.some((item) => item.sourceJobId === jobToDelete.id)).toBe(false);
    expect(nextWorkspace.answerAssets.some((item) => item.usageFeedback?.usedForJobId === jobToDelete.id)).toBe(false);
    expect(nextWorkspace.selectedJobId).toBe(jobFiles[1].id);
  });
});
