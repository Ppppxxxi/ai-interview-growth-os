import { describe, expect, it } from 'vitest';
import { jobFiles } from '../../domain/sampleData';
import { buildDemoPipelineResult } from '../demoPipeline';

describe('buildDemoPipelineResult', () => {
  it('turns pasted interview text into a review and answer asset', () => {
    const job = jobFiles[0];
    const result = buildDemoPipelineResult({
      job,
      conversationText:
        '面试官：你如何评估一个 AI 面试成长产品是否有效？\n候选人：可以看用户满意度和使用次数。\n面试官追问：这些指标如何证明准备质量提升？\nAI 点评：回答过于泛化，缺少过程指标和复用指标。',
      fallbackConversationText: ''
    });

    expect(result.session.jobFileId).toBe(job.id);
    expect(result.session.questions[0]?.question).toContain('AI 面试成长产品');
    expect(result.review.sessionId).toBe(result.session.id);
    expect(result.asset.sourceInterviewId).toBe(result.session.id);
    expect(result.asset.sourceReviewId).toBe(result.review.id);
    expect(result.asset.improvedAnswer).toContain('过程');
  });

  it('falls back to the seeded conversation when pasted text cannot be parsed', () => {
    const job = jobFiles[0];
    const result = buildDemoPipelineResult({
      job,
      conversationText: '这是一段无法识别的普通笔记',
      fallbackConversationText: '面试官：如何证明产品有效？\n候选人：看使用次数。\nAI 点评：缺少指标体系。'
    });

    expect(result.session.questions.length).toBeGreaterThan(0);
  });

  it('uses confirmed editable questions instead of reparsing raw text', () => {
    const job = jobFiles[0];
    const result = buildDemoPipelineResult({
      job,
      conversationText: '这段原文格式不重要，因为用户已经确认了解析结果',
      fallbackConversationText: '',
      questionsOverride: [
        {
          id: 'q-confirmed',
          question: '确认后的问题',
          answer: '确认后的回答',
          followUps: ['确认后的追问'],
          feedback: '确认后的点评'
        }
      ]
    });

    expect(result.session.questions[0]).toMatchObject({
      id: 'q-confirmed',
      question: '确认后的问题',
      answer: '确认后的回答'
    });
  });
});
