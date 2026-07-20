import { describe, expect, it } from 'vitest';
import { jobFiles } from '../../domain/sampleData';
import { parseInterviewMaterial } from '../materialImportParser';

describe('parseInterviewMaterial', () => {
  it('turns mixed interview material into editable draft items', () => {
    const draft = parseInterviewMaterial({
      fallbackJob: jobFiles[0],
      sourceType: 'auto',
      rawText: `公司：新国都
岗位：AI 产品经理
方向：AI + 支付商户服务
面试复盘：我对新国都支付商户业务理解不够，只说了看好 AI。
AB 实验分流机制答得比较空，只提到看转化率。
评测口径和指标体系没有分层。
AI Agent 链路拆解时没有讲清楚输入输出、用户确认和兜底。`
    });

    expect(draft.sourceType).toBe('review_notes');
    expect(draft.jobContext.company).toBe('新国都');
    expect(draft.jobContext.role).toBe('AI 产品经理');
    expect(draft.interviewItems.map((item) => item.title)).toEqual(
      expect.arrayContaining(['AB 实验设计', '评测口径设计', '公司业务理解', 'AI Agent 链路拆解'])
    );
    expect(draft.interviewItems.some((item) => item.answerAssetCandidate)).toBe(true);
  });

  it('keeps low confidence warnings when source material is vague', () => {
    const draft = parseInterviewMaterial({
      sourceType: 'auto',
      rawText: '今天面试有点乱，需要之后再整理。'
    });

    expect(draft.interviewItems[0]?.confidence).toBe('low');
    expect(draft.missingInfoWarnings.length).toBeGreaterThan(0);
  });

  it('parses structured AI mock interview dialogue', () => {
    const draft = parseInterviewMaterial({
      fallbackJob: jobFiles[0],
      sourceType: 'auto',
      rawText: `面试官：你会如何评估 AI 产品是否有效？
候选人：看用户满意度和使用次数。
面试官追问：如何证明质量提升？
AI 点评：缺少过程指标和长期复用指标。`
    });

    expect(draft.sourceType).toBe('mock_interview_dialogue');
    expect(draft.interviewItems[0]).toMatchObject({
      question: '你会如何评估 AI 产品是否有效？',
      originalAnswer: '看用户满意度和使用次数。'
    });
  });
});
