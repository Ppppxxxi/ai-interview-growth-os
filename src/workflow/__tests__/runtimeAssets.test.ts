import { describe, expect, it } from 'vitest';
import type { AnswerAsset } from '../../domain/types';
import { upsertAnswerAsset } from '../runtimeAssets';

const baseAsset: AnswerAsset = {
  id: 'asset-a',
  questionType: 'AI 产品效果评估',
  originalQuestion: '如何评估效果？',
  originalAnswer: '看使用次数。',
  issue: '指标体系不完整',
  improvedAnswer: '从过程、结果和长期复用三层评估。',
  applicableRoles: ['AI 产品经理'],
  applicableQuestions: ['如何评估效果？'],
  weaknessTag: '指标体系不完整',
  sourceJobId: 'job-a',
  sourceInterviewId: 'session-a',
  sourceReviewId: 'review-a',
  reuseScope: '同岗位后续轮次',
  usedInInterview: false,
  usageNote: '结合具体业务场景使用。',
  confidence: 'high'
};

describe('upsertAnswerAsset', () => {
  it('appends a new asset to the front', () => {
    expect(upsertAnswerAsset([], baseAsset)).toEqual([baseAsset]);
  });

  it('replaces an existing asset with the same id', () => {
    const updated = { ...baseAsset, improvedAnswer: '新版回答' };

    expect(upsertAnswerAsset([baseAsset], updated)).toEqual([updated]);
  });
});
