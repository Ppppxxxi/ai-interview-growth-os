import { describe, expect, it } from 'vitest';
import type { Experience, JobProfile } from '../../domain/types';
import { matchExperiences } from '../experienceMatcher';
import { analyzeJd } from '../jdAnalyst';

describe('analyzeJd', () => {
  it('extracts AI PM responsibilities, keywords, hidden requirements, and likely questions', () => {
    const profile = analyzeJd(
      '负责 AI Agent 产品需求分析、用户调研、指标设计、模型效果评估和跨团队协作。',
      'AI 产品经理'
    );

    expect(profile.responsibilities).toContain('AI Agent 产品需求分析');
    expect(profile.abilityKeywords).toContain('AI 产品理解');
    expect(profile.abilityKeywords).toContain('数据与指标');
    expect(profile.hiddenRequirements).toContain('能说明模型能力边界与失败兜底');
    expect(profile.likelyQuestions).toContain('如何评估一个 AI Agent 产品的效果？');
  });
});

describe('matchExperiences', () => {
  it('sorts experiences by matched ability keywords and evidence strength', () => {
    const profile: JobProfile = {
      responsibilities: ['AI Agent 产品需求分析'],
      abilityKeywords: ['AI 产品理解', '用户研究', '数据与指标'],
      hiddenRequirements: [],
      likelyQuestions: []
    };
    const experiences: Experience[] = [
      {
        id: 'exp-weak',
        title: '普通运营复盘',
        context: '整理活动数据。',
        task: '复盘活动表现。',
        action: '输出总结。',
        result: '形成记录。',
        abilityTags: ['structuredCommunication'],
        evidenceMetrics: [],
        applicableQuestionTypes: []
      },
      {
        id: 'exp-strong',
        title: 'AI Agent 求职助手调研与原型设计',
        context: '发现面试复盘信息割裂。',
        task: '定义 AI 面试成长产品。',
        action: '设计用户旅程和复盘体系。',
        result: '形成可交互 Demo 范围。',
        abilityTags: ['aiProductThinking', 'productAnalysis', 'dataMetrics'],
        evidenceMetrics: ['完成 1 份规格', '沉淀 6 个评分维度'],
        applicableQuestionTypes: ['AI 产品设计']
      }
    ];

    const matches = matchExperiences(profile, experiences);

    expect(matches[0].experience.id).toBe('exp-strong');
    expect(matches[0].matchedKeywords).toEqual(['AI 产品理解', '用户研究', '数据与指标']);
    expect(matches[1].missingEvidence).toEqual(['缺少可量化结果或证明材料']);
  });
});
