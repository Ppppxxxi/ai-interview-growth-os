import type { RewriteRequest, RewriteResponse } from '../../domain/llmContracts';
import type { MaterialChunk } from '../../domain/materialTypes';
import type { InterviewMaterialDraftItem, JobFile } from '../../domain/types';

export const chunk: MaterialChunk = {
  id: 'c1', documentId: 'd1', documentVersion: 2, kind: 'experience',
  title: 'Synthetic project', text: 'Measured the result.',
  locator: { type: 'paragraph', paragraphIndex: 0 }, tags: ['analysis'],
};
export const item: InterviewMaterialDraftItem = {
  id: 'q1', title: 'Project', question: 'What did you do?', originalAnswer: 'Analyzed data.',
  issue: 'Unclear structure', improvementSuggestion: 'Clarify actions',
  answerAssetCandidate: true, confidence: 'high',
};
export const job: JobFile = {
  id: 'j1', company: 'Synthetic company', roleTitle: 'Analyst', direction: 'Product',
  jdText: 'PRIVATE WHOLE FILE', stage: '', status: '', interviewSessionIds: ['PRIVATE CONVERSATION'],
  profile: { responsibilities: ['Analyze metrics'], abilityKeywords: [], hiddenRequirements: [], likelyQuestions: [] },
};
export function request(): RewriteRequest {
  return { questionId: 'q1', generationId: 'g1', question: 'What did you do?', originalAnswer: '',
    issue: '', rewriteFocus: '', chunks: [{ chunkId: 'c1', documentId: 'd1', documentVersion: 2,
      kind: 'experience', title: 'Synthetic project', text: 'Measured the result.',
      locator: { type: 'paragraph', paragraphIndex: 0 }, tags: ['analysis'] }] };
}
export function response(input = request()): RewriteResponse {
  return { questionId: input.questionId, generationId: input.generationId,
    answer: 'I measured the result.', rewriteFocus: 'Structure', applicabilityBoundary: 'Confirmed only',
    missingFacts: [], citations: [{ chunkId: 'c1', quote: 'Measured the result.', answerParagraphIndex: 0 }],
    model: 'deepseek-chat', generatedAt: '2026-10-13T00:00:00.000Z' };
}
