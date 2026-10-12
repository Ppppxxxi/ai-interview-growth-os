import { RewriteRequestSchema, RewriteResponseSchema, type PublicErrorCode, type RewriteRequest, type RewriteResponse } from '../domain/llmContracts';
import type { AnswerEvidence } from '../domain/materialTypes';

export class InvalidResponseError extends Error {
  readonly code: PublicErrorCode = 'INVALID_RESPONSE';
  constructor() {
    super('INVALID_RESPONSE');
    this.name = 'InvalidResponseError';
  }
}

const normalizeWhitespace = (text: string): string => text.replace(/\s+/gu, ' ').trim();

export function validateEvidence(request: RewriteRequest, response: RewriteResponse): AnswerEvidence[] {
  const parsedRequest = RewriteRequestSchema.safeParse(request);
  const parsedResponse = RewriteResponseSchema.safeParse(response);
  if (!parsedRequest.success || !parsedResponse.success) throw new InvalidResponseError();
  const input = parsedRequest.data;
  const output = parsedResponse.data;
  if (input.questionId !== output.questionId || input.generationId !== output.generationId) throw new InvalidResponseError();
  const chunks = new Map(input.chunks.map(chunk => [chunk.chunkId, chunk]));
  const paragraphs = output.answer.split(/\r?\n[\t ]*\r?\n/).filter(paragraph => paragraph.trim().length > 0);
  return output.citations.map(citation => {
    const chunk = chunks.get(citation.chunkId);
    if (!chunk || citation.answerParagraphIndex >= paragraphs.length ||
        !normalizeWhitespace(chunk.text).includes(normalizeWhitespace(citation.quote))) {
      throw new InvalidResponseError();
    }
    return {
      documentId: chunk.documentId,
      documentVersion: chunk.documentVersion,
      chunkId: chunk.chunkId,
      kind: chunk.kind,
      titleSnapshot: chunk.title,
      quote: citation.quote,
      locatorSnapshot: { ...chunk.locator },
      answerParagraphIndex: citation.answerParagraphIndex,
      status: 'validated',
    };
  });
}
