import { describe, expect, it } from 'vitest';
import { jobFiles } from '../../domain/sampleData';
import type { InterviewMaterialDraft } from '../../domain/types';
import { buildMaterialImportSavePayload } from '../materialImportDraft';

const draft: InterviewMaterialDraft = {
  sourceType: 'mixed_material',
  jobContext: {
    company: '新国都',
    role: 'AI 产品经理'
  },
  interviewItems: [
    {
      id: 'item-metrics',
      title: '评测口径设计',
      question: '如何评估 AI 产品是否有效？',
      originalAnswer: '看满意度。',
      issue: '指标不完整。',
      improvementSuggestion: '拆成过程、结果、长期指标。',
      improvedAnswer: '我会从过程指标、结果指标和长期指标三层评估。',
      answerAssetCandidate: true,
      confidence: 'high'
    },
    {
      id: 'item-note',
      title: '普通复盘笔记',
      question: '其他问题',
      originalAnswer: '待补充',
      issue: '信息不完整。',
      answerAssetCandidate: false,
      confidence: 'low'
    }
  ],
  globalInsights: {
    summary: '识别到指标短板。',
    nextPrepTopics: ['如何评估 AI 产品是否有效？']
  },
  missingInfoWarnings: []
};

describe('buildMaterialImportSavePayload', () => {
  it('saves one interview session and selected answer assets', () => {
    const payload = buildMaterialImportSavePayload({
      draft,
      job: jobFiles[0],
      rawText: 'raw material',
      runId: 'test',
      selectedItemIds: ['item-metrics', 'item-note']
    });

    expect(payload.session.id).toBe(`session-${jobFiles[0].id}-material-test`);
    expect(payload.session.questions).toHaveLength(2);
    expect(payload.review.sessionId).toBe(payload.session.id);
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets[0]).toMatchObject({
      questionType: '评测口径设计',
      originalQuestion: '如何评估 AI 产品是否有效？',
      improvedAnswer: '我会从过程指标、结果指标和长期指标三层评估。',
      sourceInterviewId: payload.session.id,
      confidence: 'high'
    });
  });

  it('does not save unselected answer candidates', () => {
    const payload = buildMaterialImportSavePayload({
      draft,
      job: jobFiles[0],
      rawText: 'raw material',
      runId: 'test-unselected',
      selectedItemIds: []
    });

    expect(payload.assets).toEqual([]);
  });
});
