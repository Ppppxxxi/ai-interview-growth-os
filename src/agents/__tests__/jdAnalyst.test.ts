import { describe, expect, it } from 'vitest';
import { analyzeJd } from '../jdAnalyst';

describe('analyzeJd', () => {
  it('extracts AI PM responsibilities, keywords, hidden requirements, and likely questions', () => {
    const profile = analyzeJd('负责 AI Agent 产品需求分析、用户调研、指标设计、模型效果评估和跨团队协作。', 'AI 产品经理');

    expect(profile.responsibilities).toContain('AI Agent 产品需求分析');
    expect(profile.abilityKeywords).toContain('AI 产品理解');
    expect(profile.abilityKeywords).toContain('数据与指标');
    expect(profile.hiddenRequirements).toContain('能说明模型能力边界与失败兜底');
    expect(profile.likelyQuestions).toContain('如何评估一个 AI Agent 产品的效果？');
  });
});
