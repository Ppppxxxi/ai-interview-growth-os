import type { AnswerAsset, AnswerAssetUsageFeedback, AnswerAssetUsageStatus } from '../domain/types';

export const usageStatusLabels: Record<AnswerAssetUsageStatus, string> = {
  unused: '待实战验证',
  'used-effective': '已使用，效果不错',
  'used-needs-polish': '已使用，需要微调',
  'needs-rewrite': '需要重写'
};

export type AssetUsageFeedbackDraft = {
  status: AnswerAssetUsageStatus;
  usedAt?: string;
  usedForJobId?: string;
  usedForInterviewId?: string;
  interviewerFollowUp?: string;
  outcomeNote?: string;
};

export function getAssetUsageStatus(asset: AnswerAsset): AnswerAssetUsageStatus {
  if (asset.usageFeedback?.status) return asset.usageFeedback.status;
  return asset.usedInInterview ? 'used-effective' : 'unused';
}

export function updateAnswerAssetUsageFeedback(
  asset: AnswerAsset,
  draft: AssetUsageFeedbackDraft,
  updatedAt = new Date().toISOString()
): AnswerAsset {
  const nextFeedback = buildFeedback(draft, updatedAt);

  return {
    ...asset,
    usedInInterview: nextFeedback.status !== 'unused',
    usageFeedback: nextFeedback,
    usageNote: buildUsageNote(asset.usageNote, nextFeedback)
  };
}

function buildFeedback(draft: AssetUsageFeedbackDraft, updatedAt: string): AnswerAssetUsageFeedback {
  if (draft.status === 'unused') {
    return {
      status: 'unused',
      updatedAt
    };
  }

  return {
    status: draft.status,
    usedAt: clean(draft.usedAt),
    usedForJobId: clean(draft.usedForJobId),
    usedForInterviewId: clean(draft.usedForInterviewId),
    interviewerFollowUp: clean(draft.interviewerFollowUp),
    outcomeNote: clean(draft.outcomeNote),
    updatedAt
  };
}

function buildUsageNote(originalNote: string, feedback: AnswerAssetUsageFeedback) {
  const baseNote = stripFeedback(originalNote);
  if (feedback.status === 'unused') return baseNote;

  const outcome = feedback.outcomeNote ? `使用反馈：${feedback.outcomeNote}` : `使用反馈：${usageStatusLabels[feedback.status]}`;
  return `${baseNote} ${outcome}`;
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function stripFeedback(value: string) {
  return value.replace(/\s*使用反馈：.*/, '');
}
