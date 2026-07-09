import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, reviewReports } from '../../domain/sampleData';
import { buildAnswerExplanation } from '../answerExplanation';

describe('buildAnswerExplanation', () => {
  it('builds evidence, suggestion, issue, and risk copy from generated results', () => {
    const session = interviewSessions[0];
    const review = reviewReports[0];
    const asset = answerAssets[0];

    const explanation = buildAnswerExplanation({ asset, review, session });

    expect(explanation.issue).toBe(asset.issue);
    expect(explanation.evidence).toContain(session.questions[0].answer);
    expect(explanation.suggestion).toBe(review.scores[0].suggestion);
    expect(explanation.risk).toContain('真实经历');
  });

  it('falls back to review summary when score evidence is missing', () => {
    const session = {
      ...interviewSessions[0],
      questions: [{ ...interviewSessions[0].questions[0], answer: '' }]
    };
    const review = { ...reviewReports[0], scores: [] };
    const asset = answerAssets[0];

    const explanation = buildAnswerExplanation({ asset, review, session });

    expect(explanation.evidence).toBe(review.summary);
    expect(explanation.suggestion).toContain('先编辑确认');
  });
});
