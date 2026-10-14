import { RewriteRequestSchema, type RewriteRequest } from '../domain/llmContracts';
import type { MaterialChunk } from '../domain/materialTypes';
import type { InterviewMaterialDraftItem, JobFile } from '../domain/types';
import { AIClientError } from './client';

export function prepareRewriteRequest(item: InterviewMaterialDraftItem, job: JobFile, chunks: MaterialChunk[], generationId: string): RewriteRequest {
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
      ...(job.profile ? { jdSummary: job.profile.responsibilities.join('\n') } : {}),
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
