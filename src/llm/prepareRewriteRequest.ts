import { RewriteRequestSchema, type RewriteRequest } from '../domain/llmContracts';
import type { MaterialChunk } from '../domain/materialTypes';
import type { InterviewMaterialDraftItem, JobFile } from '../domain/types';
import { AIClientError } from './client';

export function prepareRewriteRequest(item: InterviewMaterialDraftItem, job: JobFile, chunks: MaterialChunk[], generationId: string): RewriteRequest {
  // An input-derived excerpt, never a rule-generated profile or a truncated JD.
  const jdSummary = job.jdText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n');
  if (job.jdText.length > 8000 || jdSummary.length > 2000) throw new AIClientError('REQUEST_TOO_LARGE');
  const request = {
    questionId: item.id,
    generationId,
    question: item.question,
    originalAnswer: item.originalAnswer ?? '',
    issue: item.issue ?? '',
    rewriteFocus: item.improvementSuggestion ?? '',
    jobContext: {
      company: job.company,
      role: job.roleTitle,
      ...(jdSummary ? { jdSummary } : {}),
    },
    chunks: chunks.map(chunk => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentVersion: chunk.documentVersion,
      kind: chunk.kind,
      title: chunk.title,
      text: chunk.text,
      locator: chunk.locator,
      tags: chunk.tags,
    })),
  };
  const parsed = RewriteRequestSchema.safeParse(request);
  if (!parsed.success) throw new AIClientError('INVALID_REQUEST');
  return parsed.data;
}
