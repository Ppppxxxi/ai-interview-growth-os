import { z } from 'zod';

export const LLM_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxExtractedCharacters: 50_000,
  maxChunks: 6,
  maxChunkCharacters: 1_200,
  maxContextCharacters: 8_000,
  maxTotalCharacters: 20_000,
  maxRequestBytes: 128 * 1024,
  maxTokens: 4_096,
  timeoutMs: 45_000,
} as const;

export const PublicErrorCodeSchema = z.enum([
  'INVALID_REQUEST', 'INVALID_RESPONSE', 'AI_UNAVAILABLE', 'RATE_LIMITED',
  'UPSTREAM_ERROR', 'TIMEOUT', 'REQUEST_TOO_LARGE', 'QUOTA_EXCEEDED',
]);
export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>;

const nonBlank = (max: number) => z.string().max(max).refine(value => value.trim().length > 0, 'Must not be blank');
const identifier = nonBlank(200);
const contextText = z.string().max(LLM_LIMITS.maxContextCharacters);
export const MaterialLocatorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), paragraphIndex: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('page'), pageNumber: z.number().int().positive(), paragraphIndex: z.number().int().nonnegative().optional() }).strict(),
]);
export const RewriteChunkSchema = z.object({
  chunkId: identifier,
  documentId: identifier,
  documentVersion: z.number().int().positive(),
  kind: z.enum(['experience', 'knowledge']),
  title: nonBlank(500),
  text: nonBlank(LLM_LIMITS.maxChunkCharacters),
  locator: MaterialLocatorSchema,
  tags: z.array(nonBlank(100)).max(20),
}).strict();

// Include metadata and every nested string, not only the main question and excerpts.
function countCharacters(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countCharacters(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce<number>((sum, item) => sum + countCharacters(item), 0);
  return 0;
}

export const RewriteRequestSchema = z.object({
  questionId: identifier,
  generationId: identifier,
  question: nonBlank(LLM_LIMITS.maxContextCharacters),
  originalAnswer: contextText,
  issue: contextText,
  rewriteFocus: contextText,
  jobContext: z.object({ company: contextText.optional(), role: contextText.optional(), jdSummary: contextText.optional() }).strict().optional(),
  chunks: z.array(RewriteChunkSchema).max(LLM_LIMITS.maxChunks),
}).strict().superRefine((request, context) => {
  const { questionId: _questionId, generationId: _generationId, chunks, ...questionContext } = request;
  if (countCharacters(questionContext) > LLM_LIMITS.maxContextCharacters) {
    context.addIssue({ code: 'custom', message: 'Question context exceeds character limit' });
  }
  if (countCharacters(request) > LLM_LIMITS.maxTotalCharacters) {
    context.addIssue({ code: 'custom', message: 'Total content exceeds character limit' });
  }
  if (new TextEncoder().encode(JSON.stringify(request)).byteLength > LLM_LIMITS.maxRequestBytes) {
    context.addIssue({ code: 'custom', message: 'JSON request exceeds byte limit' });
  }
  if (new Set(chunks.map(chunk => chunk.chunkId)).size !== chunks.length) {
    context.addIssue({ code: 'custom', path: ['chunks'], message: 'Duplicate chunkId' });
  }
});
export type RewriteRequest = z.infer<typeof RewriteRequestSchema>;

export const AnswerCitationSchema = z.object({
  chunkId: identifier,
  quote: nonBlank(LLM_LIMITS.maxChunkCharacters),
  answerParagraphIndex: z.number().int().nonnegative(),
}).strict();

// The upstream model cannot supply trusted request identity or server metadata.
export const ModelRewriteResponseSchema = z.object({
  answer: nonBlank(20_000),
  rewriteFocus: z.string().max(4_000),
  applicabilityBoundary: z.string().max(4_000),
  missingFacts: z.array(nonBlank(1_200)).max(50),
  citations: z.array(AnswerCitationSchema).max(100),
}).strict();
export type ModelRewriteResponse = z.infer<typeof ModelRewriteResponseSchema>;
export const RewriteResponseSchema = ModelRewriteResponseSchema.extend({
  questionId: identifier,
  generationId: identifier,
  model: nonBlank(200),
  generatedAt: z.string().datetime(),
}).strict();
export type RewriteResponse = z.infer<typeof RewriteResponseSchema>;
