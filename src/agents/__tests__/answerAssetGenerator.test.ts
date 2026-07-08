import { describe, expect, it } from 'vitest';
import type { InterviewSession, JobFile, ReviewReport } from '../../domain/types';
import { generateAnswerAsset } from '../answerAssetGenerator';

describe('generateAnswerAsset', () => {
  it('turns a review weakness into a reusable answer asset with source metadata', () => {
    const job: JobFile = {
      id: 'job-ai-pm-a',
      company: '星河智能',
      roleTitle: 'AI 产品经理实习生',
      direction: 'AI 产品经理',
      jdText: '负责 AI Agent 产品需求分析、指标设计和模型效果评估。',
      stage: '一面准备',
      status: '已导入 1 次外部面试',
      interviewSessionIds: ['session-ai-pm-a-1']
    };
    const session: InterviewSession = {
      id: 'session-ai-pm-a-1',
      jobFileId: job.id,
      source: 'externalImport',
      interviewType: 'AI 产品经理综合面',
      createdAt: '2026-07-01',
      rawConversation: '',
      questions: [
        {
          id: 'q-1',
          question: '你如何评估这个 AI 面试产品的效果？',
          answer: '可以看用户满意度和使用次数。',
          followUps: ['这些指标如何证明面试能力真的提升？'],
          feedback: '回答过于泛化，缺少过程指标、结果指标和长期复用指标。'
        }
      ]
    };
    const report: ReviewReport = {
      id: 'review-ai-pm-a-1',
      jobFileId: job.id,
      sessionId: session.id,
      summary: '指标体系不完整，需要补充可验证的产品效果指标。',
      scores: [],
      strengths: [],
      weaknesses: ['指标体系不完整'],
      nextActions: ['重写 AI 产品效果评估回答']
    };

    const asset = generateAnswerAsset(job, session, report);

    expect(asset.sourceJobId).toBe(job.id);
    expect(asset.sourceInterviewId).toBe(session.id);
    expect(asset.originalQuestion).toBe('你如何评估这个 AI 面试产品的效果？');
    expect(asset.issue).toContain('指标体系不完整');
    expect(asset.improvedAnswer).toContain('过程指标');
    expect(asset.applicableRoles).toEqual(['AI 产品经理', '同方向 AI 产品岗位']);
    expect(asset.applicableQuestions).toContain('如何评估一个 AI 产品是否有效？');
    expect(asset.reuseScope).toBe('同岗位多轮 / 同方向类似岗位');
  });
});
