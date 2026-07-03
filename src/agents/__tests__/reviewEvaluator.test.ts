import { describe, expect, it } from 'vitest';
import type { InterviewSession, JobFile } from '../../domain/types';
import { evaluateInterview } from '../reviewEvaluator';

describe('evaluateInterview', () => {
  it('scores weak AI PM answers with evidence and suggestions', () => {
    const job: JobFile = {
      id: 'job-1',
      company: '测试公司',
      roleTitle: 'AI 产品经理',
      direction: 'AI 产品经理',
      jdText: '负责 AI Agent、指标设计和效果评估。',
      stage: '一面',
      status: '复盘中',
      interviewSessionIds: ['session-1']
    };
    const session: InterviewSession = {
      id: 'session-1',
      jobFileId: 'job-1',
      source: 'externalImport',
      interviewType: '综合面',
      createdAt: '2026-07-01',
      rawConversation: '',
      questions: [
        {
          id: 'q-1',
          question: '如何评估 AI Agent 产品效果？',
          answer: '看用户满意度和使用次数。',
          followUps: [],
          feedback: '缺少指标体系。'
        }
      ]
    };

    const report = evaluateInterview(job, session);

    expect(report.scores.find((score) => score.dimension === 'aiProductThinking')?.score).toBe(2);
    expect(report.scores.find((score) => score.dimension === 'dataMetrics')?.suggestion).toContain('复盘完成率');
    expect(report.weaknesses).toContain('AI 产品边界表达不足');
  });
});
