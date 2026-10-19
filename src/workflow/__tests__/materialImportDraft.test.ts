import { describe, expect, it } from 'vitest';
import { jobFiles } from '../../domain/sampleData';
import type { InterviewMaterialDraft } from '../../domain/types';
import { buildMaterialImportSavePayload } from '../materialImportDraft';

const draft: InterviewMaterialDraft = {
  sourceType: 'mixed_material',
  jobContext: {
    company: '晴川智能',
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
  it('preserves evidence generation missing facts and history without saving empty answers', () => {
    const evidence = [{ documentId: 'fiction', documentVersion: 1, chunkId: 'c', kind: 'experience' as const, titleSnapshot: '虚构资料', quote: '虚构行动', answerParagraphIndex: 0, status: 'validated' as const }];
    const generation = { provider: 'deepseek' as const, model: 'deepseek-chat', generationId: 'actual', generatedAt: '2026-10-13T00:00:00Z', origin: 'model' as const };
    const answerVersions = [{ id: 'v1', answer: '旧回答', note: '', createdAt: '2026-10-13', source: 'generated' as const, evidence, generation, missingFacts: ['职责'] }];
    const result = buildMaterialImportSavePayload({ draft: { ...draft, interviewItems: [{ ...draft.interviewItems[0], evidence, generation, missingFacts: ['成果'], answerVersions }, { ...draft.interviewItems[1], answerAssetCandidate: true, improvedAnswer: '' }] }, job: jobFiles[0], rawText: '', selectedItemIds: ['item-metrics', 'item-note'] });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({ evidence, generation, missingFacts: ['成果'], answerVersions });
  });
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
      confidence: 'high',
      confirmationStatus: 'accepted',
      answerRationale: {
        sourceQuestion: '如何评估 AI 产品是否有效？',
        originalIssue: '指标不完整。',
        rewriteFocus: '拆成过程、结果、长期指标。'
      }
    });
  });

  it('marks answers accepted after editing when confirmation status is provided', () => {
    const payload = buildMaterialImportSavePayload({
      draft,
      job: jobFiles[0],
      rawText: 'raw material',
      runId: 'test-confirmation',
      selectedItemIds: ['item-metrics'],
      confirmationStatuses: new Map([['item-metrics', 'edited-accepted']])
    });

    expect(payload.assets[0]).toMatchObject({
      confirmationStatus: 'edited-accepted',
      usageNote: '这条回答已经修改后采用，使用前仍建议补充具体业务场景。'
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
