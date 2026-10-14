import type { RewriteRequest } from '../../../src/domain/llmContracts';
import { readAIConfig } from '../config';

export const request: RewriteRequest = {
  questionId: 'question-1', generationId: 'generation-1', question: 'Describe a project.',
  originalAnswer: '', issue: '', rewriteFocus: '',
  chunks: [{ chunkId: 'chunk-1', documentId: 'doc-1', documentVersion: 1,
    kind: 'experience', title: 'Fictional project', text: 'I tested a fictional feature.',
    locator: { type: 'paragraph', paragraphIndex: 0 }, tags: [] }],
};
export const output = { answer: 'I tested a fictional feature.', rewriteFocus: 'Clarity',
  applicabilityBoundary: '', missingFacts: [], citations: [{ chunkId: 'chunk-1',
    quote: 'tested a fictional feature', answerParagraphIndex: 0 }] };
export const now = () => '2026-10-13T00:00:00.000Z';
export const config = () => readAIConfig({ AI_GENERATION_ENABLED: 'true',
  DEEPSEEK_API_KEY: 'fictional-test-key', DEEPSEEK_MODEL: 'fictional-model',
  VERCEL: '1', NODEJS_HELPERS: '0', VERCEL_URL: 'demo.vercel.app' });
export const upstream = (value: unknown = output, finish = 'stop') => new Response(JSON.stringify({
  choices: [{ finish_reason: finish, message: { content: JSON.stringify(value) } }],
}));
