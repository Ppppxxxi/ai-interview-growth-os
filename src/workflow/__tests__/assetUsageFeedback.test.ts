import { describe, expect, it } from 'vitest';
import { answerAssets } from '../../domain/sampleData';
import { getAssetUsageStatus, updateAnswerAssetUsageFeedback } from '../assetUsageFeedback';

describe('asset usage feedback', () => {
  it('feedback_only_preserves_model_provenance_without_revalidating_or_rewriting', () => {
    const asset = { ...answerAssets[0], generation: { provider: 'deepseek' as const, model: 'test', generatedAt: 'then', generationId: 'g1', origin: 'model' as const }, missingFacts: ['result'] };
    const updated = updateAnswerAssetUsageFeedback(asset, { status: 'needs-rewrite', outcomeNote: 'Clarify scope' });
    expect(updated.generation).toEqual(asset.generation);
    expect(updated.improvedAnswer).toBe(asset.improvedAnswer);
    expect(updated.missingFacts).toEqual(asset.missingFacts);
  });
  it('falls back to legacy usedInInterview state', () => {
    expect(getAssetUsageStatus({ ...answerAssets[0], usedInInterview: true })).toBe('used-effective');
  });

  it('marks an asset as used and stores interview outcome notes', () => {
    const updated = updateAnswerAssetUsageFeedback(
      {
        ...answerAssets[0],
        usedInInterview: false,
        usageFeedback: undefined
      },
      {
        status: 'used-needs-polish',
        usedAt: '2026-07-12',
        usedForJobId: 'job-ai-pm-a',
        usedForInterviewId: 'session-ai-pm-a-1',
        interviewerFollowUp: '面试官追问如何验证长期复用指标。',
        outcomeNote: '主框架可用，但需要补充更具体的业务场景。'
      },
      '2026-07-12T12:00:00.000Z'
    );

    expect(updated.usedInInterview).toBe(true);
    expect(updated.usageFeedback).toMatchObject({
      status: 'used-needs-polish',
      usedForJobId: 'job-ai-pm-a',
      interviewerFollowUp: '面试官追问如何验证长期复用指标。',
      updatedAt: '2026-07-12T12:00:00.000Z'
    });
    expect(updated.usageNote).toContain('使用反馈：主框架可用，但需要补充更具体的业务场景。');
  });

  it('can reset an asset back to unused', () => {
    const updated = updateAnswerAssetUsageFeedback(
      {
        ...answerAssets[0],
        usageNote: `${answerAssets[0].usageNote} 使用反馈：上一场回答效果一般。`
      },
      {
        status: 'unused',
        outcomeNote: 'this should be ignored'
      },
      '2026-07-12T12:00:00.000Z'
    );

    expect(updated.usedInInterview).toBe(false);
    expect(updated.usageFeedback).toEqual({
      status: 'unused',
      updatedAt: '2026-07-12T12:00:00.000Z'
    });
    expect(updated.usageNote).not.toContain('使用反馈：');
  });
});
