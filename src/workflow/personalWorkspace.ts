import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';

export const PERSONAL_WORKSPACE_STORAGE_KEY = 'ai-interview-growth-os:v0.2:workspace';

export type StorageLike = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

export type NewJobDraft = {
  company: string;
  roleTitle: string;
  direction: string;
  jdText: string;
  stage: string;
};

export type PersonalWorkspaceData = {
  version: 1;
  jobFiles: JobFile[];
  interviewSessions: InterviewSession[];
  reviewReports: ReviewReport[];
  answerAssets: AnswerAsset[];
  selectedJobId: string;
  updatedAt: string;
};

export function hasPersonalWorkspace(storage: StorageLike | undefined) {
  if (!storage) return false;
  return Boolean(storage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY));
}

export function createPersonalWorkspaceData(
  jobFiles: JobFile[],
  answerAssets: AnswerAsset[],
  selectedJobId = jobFiles[0]?.id ?? '',
  updatedAt = new Date().toISOString(),
  interviewSessions: InterviewSession[] = [],
  reviewReports: ReviewReport[] = []
): PersonalWorkspaceData {
  return {
    version: 1,
    jobFiles,
    interviewSessions,
    reviewReports,
    answerAssets,
    selectedJobId,
    updatedAt
  };
}

export function createEmptyPersonalWorkspaceData(updatedAt = new Date().toISOString()): PersonalWorkspaceData {
  const firstJob: JobFile = {
    id: `job-user-first-${Date.now().toString(36)}`,
    company: '我的目标公司',
    roleTitle: 'AI 产品经理',
    direction: 'AI 产品经理',
    jdText: '',
    stage: '准备中',
    status: '待粘贴 JD 和面试对话',
    interviewSessionIds: []
  };

  return createPersonalWorkspaceData([firstJob], [], firstJob.id, updatedAt);
}

export function hasRealWorkspaceData(data: PersonalWorkspaceData, sampleJobIds: Iterable<string> = []) {
  const sampleIds = new Set(sampleJobIds);
  const hasUserJob = data.jobFiles.some((job) => {
    if (sampleIds.has(job.id)) return false;
    if (job.id.startsWith('job-user-first-')) {
      return Boolean(job.jdText.trim()) || job.company !== '我的目标公司' || job.roleTitle !== 'AI 产品经理';
    }
    return true;
  });

  return hasUserJob || data.interviewSessions.length > 0 || data.reviewReports.length > 0 || data.answerAssets.length > 0;
}

export function readPersonalWorkspace(storage: StorageLike | undefined, fallback: PersonalWorkspaceData): PersonalWorkspaceData {
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (!isPersonalWorkspaceData(parsed)) return fallback;

    const selectedJobExists = parsed.jobFiles.some((job) => job.id === parsed.selectedJobId);
    return {
      ...parsed,
      interviewSessions: parsed.interviewSessions ?? fallback.interviewSessions,
      reviewReports: parsed.reviewReports ?? fallback.reviewReports,
      selectedJobId: selectedJobExists ? parsed.selectedJobId : parsed.jobFiles[0]?.id ?? ''
    };
  } catch {
    return fallback;
  }
}

export function writePersonalWorkspace(storage: StorageLike | undefined, data: PersonalWorkspaceData) {
  if (!storage) return;
  storage.setItem(PERSONAL_WORKSPACE_STORAGE_KEY, JSON.stringify(data));
}

export function clearPersonalWorkspace(storage: StorageLike | undefined) {
  if (!storage) return;
  storage.removeItem(PERSONAL_WORKSPACE_STORAGE_KEY);
}

export function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export function createJobFileFromDraft(draft: NewJobDraft, existingCount: number, now = Date.now()): JobFile {
  const company = draft.company.trim();
  const roleTitle = draft.roleTitle.trim();
  const direction = draft.direction.trim();
  const stage = draft.stage.trim();

  return {
    id: `job-user-${existingCount + 1}-${now.toString(36)}`,
    company,
    roleTitle,
    direction,
    jdText: draft.jdText.trim(),
    stage: stage || '准备中',
    status: draft.jdText.trim() ? '待导入面试材料' : '待补充 JD 或面试材料',
    interviewSessionIds: []
  };
}

export function upsertJobFile(jobFiles: JobFile[], nextJob: JobFile) {
  const existingIndex = jobFiles.findIndex((job) => job.id === nextJob.id);
  if (existingIndex === -1) return [nextJob, ...jobFiles];

  return jobFiles.map((job) => (job.id === nextJob.id ? nextJob : job));
}

export function upsertInterviewSession(sessions: InterviewSession[], nextSession: InterviewSession) {
  const existingIndex = sessions.findIndex((session) => session.id === nextSession.id);
  if (existingIndex === -1) return [nextSession, ...sessions];

  return sessions.map((session) => (session.id === nextSession.id ? nextSession : session));
}

export function upsertReviewReport(reports: ReviewReport[], nextReport: ReviewReport) {
  const existingIndex = reports.findIndex((report) => report.id === nextReport.id);
  if (existingIndex === -1) return [nextReport, ...reports];

  return reports.map((report) => (report.id === nextReport.id ? nextReport : report));
}

export function attachInterviewSessionToJob(jobFiles: JobFile[], session: InterviewSession) {
  return jobFiles.map((job) => {
    if (job.id !== session.jobFileId) return job;

    const sessionIds = [session.id, ...job.interviewSessionIds.filter((id) => id !== session.id)];
    return {
      ...job,
      status: `${sessionIds.length} 场面试记录`,
      interviewSessionIds: sessionIds
    };
  });
}

export function removeInterviewRecord(data: PersonalWorkspaceData, sessionId: string): PersonalWorkspaceData {
  const targetSession = data.interviewSessions.find((session) => session.id === sessionId);
  const nextJobFiles = data.jobFiles.map((job) => {
    const nextSessionIds = job.interviewSessionIds.filter((id) => id !== sessionId);
    if (nextSessionIds.length === job.interviewSessionIds.length) return job;

    return {
      ...job,
      status: nextSessionIds.length > 0 ? `${nextSessionIds.length} 场面试记录` : '待导入面试对话',
      interviewSessionIds: nextSessionIds
    };
  });

  return {
    ...data,
    jobFiles: nextJobFiles,
    interviewSessions: data.interviewSessions.filter((session) => session.id !== sessionId),
    reviewReports: data.reviewReports.filter((review) => review.sessionId !== sessionId),
    answerAssets: data.answerAssets.filter((asset) => asset.sourceInterviewId !== sessionId),
    selectedJobId: targetSession?.jobFileId ?? data.selectedJobId,
    updatedAt: new Date().toISOString()
  };
}

export function removeJobFile(data: PersonalWorkspaceData, jobId: string): PersonalWorkspaceData {
  const removedSessionIds = new Set(
    data.interviewSessions.filter((session) => session.jobFileId === jobId).map((session) => session.id)
  );
  const nextJobFiles = data.jobFiles.filter((job) => job.id !== jobId);

  return {
    ...data,
    jobFiles: nextJobFiles,
    interviewSessions: data.interviewSessions.filter((session) => session.jobFileId !== jobId),
    reviewReports: data.reviewReports.filter(
      (review) => review.jobFileId !== jobId && !removedSessionIds.has(review.sessionId)
    ),
    answerAssets: data.answerAssets.filter(
      (asset) =>
        asset.sourceJobId !== jobId &&
        !removedSessionIds.has(asset.sourceInterviewId) &&
        asset.usageFeedback?.usedForJobId !== jobId
    ),
    selectedJobId: data.selectedJobId === jobId ? nextJobFiles[0]?.id ?? '' : data.selectedJobId,
    updatedAt: new Date().toISOString()
  };
}

function isPersonalWorkspaceData(value: unknown): value is PersonalWorkspaceData {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PersonalWorkspaceData>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.jobFiles) &&
    Array.isArray(candidate.answerAssets) &&
    (candidate.interviewSessions === undefined || Array.isArray(candidate.interviewSessions)) &&
    (candidate.reviewReports === undefined || Array.isArray(candidate.reviewReports)) &&
    typeof candidate.selectedJobId === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}
