import type { AnswerAsset, InterviewSession, ReviewReport } from '../domain/types';

type BuildAnswerExplanationInput = {
  asset: AnswerAsset;
  review: ReviewReport;
  session: InterviewSession;
};

export type AnswerExplanation = {
  issue: string;
  evidence: string;
  suggestion: string;
  risk: string;
};

export function buildAnswerExplanation({ asset, review, session }: BuildAnswerExplanationInput): AnswerExplanation {
  const primaryAnswer = session.questions[0]?.answer.trim();
  const primaryScore = review.scores[0];

  return {
    issue: asset.issue,
    evidence: primaryAnswer || primaryScore?.evidence || review.summary,
    suggestion: primaryScore?.suggestion || '先编辑确认这段回答是否符合你的真实经历，再保存为回答资产。',
    risk: '如果优化回答不符合你的真实经历，请先编辑后再保存。'
  };
}
