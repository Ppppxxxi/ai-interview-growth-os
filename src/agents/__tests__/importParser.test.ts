import { describe, expect, it } from 'vitest';
import { parseImportedConversation } from '../importParser';

describe('parseImportedConversation', () => {
  it('extracts interviewer question, candidate answer, follow-up, and feedback', () => {
    const parsed = parseImportedConversation(`面试官：请设计一个 AI 面试产品。
候选人：我会生成问题并给反馈。
面试官追问：如何评估效果？
AI 点评：缺少指标和兜底机制。`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].question).toBe('请设计一个 AI 面试产品。');
    expect(parsed[0].answer).toBe('我会生成问题并给反馈。');
    expect(parsed[0].followUps).toEqual(['如何评估效果？']);
    expect(parsed[0].feedback).toBe('缺少指标和兜底机制。');
  });
});
