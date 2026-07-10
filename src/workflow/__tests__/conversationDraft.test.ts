import { describe, expect, it } from 'vitest';
import {
  createEditableQuestions,
  hasUsableQuestion,
  updateQuestionField,
  updateQuestionFollowUps
} from '../conversationDraft';

describe('conversationDraft', () => {
  it('creates editable questions from pasted interview text', () => {
    const questions = createEditableQuestions(`面试官：如何评估 AI 面试产品效果？
候选人：看满意度和使用次数。
面试官追问：如何证明面试准备质量提升？
AI 点评：缺少过程指标和复用指标。`);

    expect(questions).toHaveLength(1);
    expect(questions[0].question).toContain('AI 面试产品效果');
    expect(questions[0].answer).toContain('满意度');
    expect(questions[0].followUps[0]).toContain('质量提升');
    expect(questions[0].feedback).toContain('复用指标');
  });

  it('falls back to existing questions when raw text cannot be parsed', () => {
    const fallback = [
      {
        id: 'q-existing',
        question: '已有问题',
        answer: '已有回答',
        followUps: ['已有追问'],
        feedback: '已有点评'
      }
    ];

    const questions = createEditableQuestions('无法识别的普通笔记', fallback);

    expect(questions).toEqual(fallback);
    expect(questions[0]).not.toBe(fallback[0]);
  });

  it('updates editable question fields and follow-ups', () => {
    const questions = createEditableQuestions('');
    const questionId = questions[0].id;

    const withQuestion = updateQuestionField(questions, questionId, 'question', '新问题');
    const withAnswer = updateQuestionField(withQuestion, questionId, 'answer', '新回答');
    const withFollowUps = updateQuestionFollowUps(withAnswer, questionId, '追问一\n追问二');

    expect(withFollowUps[0].question).toBe('新问题');
    expect(withFollowUps[0].answer).toBe('新回答');
    expect(withFollowUps[0].followUps).toEqual(['追问一', '追问二']);
    expect(hasUsableQuestion(withFollowUps)).toBe(true);
  });

  it('marks blank drafts as unusable', () => {
    expect(hasUsableQuestion(createEditableQuestions(''))).toBe(false);
  });
});
