import { describe, expect, it } from 'vitest';
import type { Experience, JobProfile } from '../../domain/types';
import { generateMockInterview } from '../mockInterview';

describe('generateMockInterview', () => {
  it('creates role-specific questions using JD profile and matched experiences', () => {
    const profile: JobProfile = {
      responsibilities: ['AI Agent 产品需求分析'],
      abilityKeywords: ['AI 产品理解', '数据与指标'],
      hiddenRequirements: ['能说明模型能力边界与失败兜底'],
      likelyQuestions: ['如何评估一个 AI Agent 产品的效果？']
    };
    const experiences: Experience[] = [
      {
        id: 'exp-1',
        title: 'AI Agent 求职助手调研与原型设计',
        context: '准备 AI 产品经理求职时发现复盘割裂。',
        task: '定义 MVP。',
        action: '设计岗位档案和成长图谱。',
        result: '形成产品规格。',
        abilityTags: ['aiProductThinking', 'productAnalysis'],
        evidenceMetrics: ['完成 1 份规格'],
        applicableQuestionTypes: ['AI 产品设计']
      }
    ];

    const session = generateMockInterview('job-1', profile, experiences);

    expect(session.source).toBe('builtInMock');
    expect(session.questions[0].question).toBe('如何评估一个 AI Agent 产品的效果？');
    expect(session.questions.some((item) => item.question.includes('AI Agent 求职助手调研与原型设计'))).toBe(true);
  });
});
