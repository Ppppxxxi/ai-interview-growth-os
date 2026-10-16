import { z } from 'zod';
import type { InterviewMaterialDraft, InterviewMaterialDraftItem } from './types';
import type { MaterialChunk } from './materialTypes';
import { MaterialLocatorSchema, RewriteRequestSchema, RewriteResponseSchema } from './llmContracts';
import { validateEvidence } from '../llm/validateEvidence';

const text = z.string();
const strings = z.array(text);
const identifier = z.string().min(1).max(200);
const revision = z.number().int().nonnegative();
const evidence = z.object({
  documentId: identifier, documentVersion: z.number().int().positive(), chunkId: identifier,
  kind: z.enum(['experience', 'knowledge']), titleSnapshot: text, quote: text,
  locatorSnapshot: MaterialLocatorSchema.optional(), answerParagraphIndex: revision,
  status: z.enum(['validated', 'source-updated', 'source-deleted', 'needs-review']),
}).strict();
const generation = z.object({ provider: z.literal('deepseek'), model: text, generatedAt: text,
  generationId: identifier, origin: z.enum(['model', 'sample', 'manual']) }).strict();
const modelRationale = z.object({ rewriteFocus: text, applicabilityBoundary: text }).strict();
const answerRationale = z.object({ sourceQuestion: text, originalIssue: text, rewriteFocus: text,
  applicabilityBoundary: text, requestedRewriteFocus: text.optional() }).strict();
const version = z.object({ id: identifier, answer: text, note: text, createdAt: text,
  source: z.enum(['generated', 'manual-edit', 'usage-feedback']), evidence: z.array(evidence).optional(),
  generation: generation.optional(), missingFacts: strings.optional(),
  modelRationale: modelRationale.optional(), answerRationale: answerRationale.optional() }).strict();
const draftItem = z.object({
  id: identifier, title: text, question: text.optional(), originalAnswer: text.optional(), followUps: strings.optional(),
  issue: text.optional(), evidence: z.union([text, z.array(evidence)]).optional(), generation: generation.optional(),
  missingFacts: strings.optional(), improvementSuggestion: text.optional(), improvedAnswer: text.optional(),
  modelRationale: modelRationale.optional(), answerVersions: z.array(version).optional(),
  answerAssetCandidate: z.boolean(), assetCandidateReason: text.optional(), confidence: z.enum(['high', 'medium', 'low']), rejectedReason: text.optional(),
}).strict();
const interviewDraft: z.ZodType<InterviewMaterialDraft> = z.object({
  sourceType: z.enum(['mock_interview_dialogue', 'real_interview_memory', 'review_notes', 'mixed_material']),
  jobContext: z.object({ company: text.optional(), role: text.optional(), direction: text.optional(), jdText: text.optional() }).strict(),
  interviewItems: z.array(draftItem), globalInsights: z.object({ summary: text.optional(), strengths: strings.optional(), weaknesses: strings.optional(), nextPrepTopics: strings.optional() }).strict(),
  missingInfoWarnings: strings,
}).strict();
const selection = z.object({ chunkId: identifier, documentId: identifier, documentVersion: z.number().int().positive() }).strict();
export const FocusQuestionWorkSchema = z.object({
  revision,
  selectedChunks: z.array(selection).max(6).refine(chunks => new Set(chunks.map(chunk => chunk.chunkId)).size === chunks.length),
  provenance: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('manual'), revision, answer: text }).strict(),
    z.object({ kind: z.literal('model'), revision, request: RewriteRequestSchema, response: RewriteResponseSchema }).strict(),
  ]).optional(),
}).strict();
export type FocusQuestionWork = z.infer<typeof FocusQuestionWorkSchema>;
export type FocusQuestionWorks = Record<string, FocusQuestionWork>;
export const FocusFlowDraftSchema = z.object({
  id: identifier, kind: z.literal('focus-flow'), schemaVersion: z.literal(1), jobId: identifier,
  jobDraft: z.object({ company: text, roleTitle: text, direction: text, jdText: text }).strict(),
  rawText: text, materialDraft: interviewDraft.optional(), stage: z.enum(['input', 'questions', 'answers']),
  activeItemId: text, work: z.record(identifier, FocusQuestionWorkSchema), updatedAt: text,
}).strict().superRefine((draft, context) => {
  const ids = new Set(draft.materialDraft?.interviewItems.map(item => item.id) ?? []);
  if (draft.id !== `focus-flow:${draft.jobId}` || ids.size !== (draft.materialDraft?.interviewItems.length ?? 0) || Object.keys(draft.work).some(id => !ids.has(id)))
    context.addIssue({ code: 'custom', message: 'Work must belong to a unique draft question' });
});
export type FocusFlowDraft = z.infer<typeof FocusFlowDraftSchema>;
export const emptyFocusWork = (): FocusQuestionWork => ({ revision: 0, selectedChunks: [] });

export function isFocusAnswerReady(item: InterviewMaterialDraftItem, work: FocusQuestionWork): boolean {
  const source = work.provenance;
  if (!item.improvedAnswer?.trim() || !source || source.revision !== work.revision) return false;
  if (source.kind === 'manual') return source.answer === item.improvedAnswer;
  const { request, response } = source;
  if (item.generation?.origin !== 'model') return false;
  if (item.modelRationale?.rewriteFocus !== response.rewriteFocus || item.modelRationale.applicabilityBoundary !== response.applicabilityBoundary) return false;
  if (response.answer !== item.improvedAnswer || response.generationId !== item.generation?.generationId || request.questionId !== item.id ||
      request.question !== item.question || request.originalAnswer !== (item.originalAnswer ?? '') || request.issue !== (item.issue ?? '') || request.rewriteFocus !== (item.improvementSuggestion ?? '') ||
      request.chunks.length !== work.selectedChunks.length || request.chunks.some(chunk => !work.selectedChunks.some(selected => selected.chunkId === chunk.chunkId && selected.documentId === chunk.documentId && selected.documentVersion === chunk.documentVersion))) return false;
  try { validateEvidence(request, response); return true; } catch { return false; }
}

export function reconcileFocusWork(work: FocusQuestionWork, chunks: MaterialChunk[]): FocusQuestionWork {
  const selectedChunks = work.selectedChunks.filter(selected => chunks.some(chunk => chunk.id === selected.chunkId && chunk.documentId === selected.documentId && chunk.documentVersion === selected.documentVersion));
  return selectedChunks.length === work.selectedChunks.length ? work : { revision: work.revision + 1, selectedChunks };
}
