import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';

export type WorkspaceStatus = 'idle' | 'generating' | 'reviewReady' | 'assetSaved';

export type FlowStep = {
  id: 'parse' | 'review' | 'answer';
  label: string;
  status: 'pending' | 'active' | 'done';
};

export type WorkspaceState = {
  status: WorkspaceStatus;
  job: JobFile;
  session: InterviewSession;
  review: ReviewReport;
  generatedAsset: AnswerAsset;
  savedAssetId?: string;
  steps: FlowStep[];
};

const initialSteps: FlowStep[] = [
  { id: 'parse', label: '识别问题与回答', status: 'pending' },
  { id: 'review', label: '定位回答问题', status: 'pending' },
  { id: 'answer', label: '生成优化回答', status: 'pending' }
];

export function createWorkspaceState(
  job: JobFile,
  session: InterviewSession,
  review: ReviewReport,
  generatedAsset: AnswerAsset
): WorkspaceState {
  return {
    status: 'idle',
    job,
    session,
    review,
    generatedAsset,
    steps: initialSteps
  };
}

export function startAnalysis(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    status: 'generating',
    savedAssetId: undefined,
    steps: state.steps.map((step, index) => ({
      ...step,
      status: index === 0 ? 'active' : 'pending'
    }))
  };
}

export function completeAnalysis(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    status: 'reviewReady',
    steps: state.steps.map((step) => ({
      ...step,
      status: 'done'
    }))
  };
}

export function saveGeneratedAsset(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    status: 'assetSaved',
    savedAssetId: state.generatedAsset.id,
    steps: state.steps.map((step) => ({
      ...step,
      status: 'done'
    }))
  };
}
