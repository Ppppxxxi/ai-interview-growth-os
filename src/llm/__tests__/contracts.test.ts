import { describe, expect, it } from 'vitest';
import { ModelRewriteResponseSchema, PublicErrorCodeSchema, RewriteRequestSchema, RewriteResponseSchema, type RewriteRequest, type RewriteResponse } from '../../domain/llmContracts';
import { validateEvidence } from '../validateEvidence';

const chunk = {
  chunkId: 'chunk-1', documentId: 'document-1', documentVersion: 2,
  kind: 'experience' as const, title: 'Confirmed project', text: 'Led the analysis.\nMeasured the result.',
  locator: { type: 'paragraph' as const, paragraphIndex: 0 }, tags: ['analysis'],
};
function request(): RewriteRequest {
  return { questionId: 'question-1', generationId: 'generation-1', question: 'What did you do?',
    originalAnswer: '', issue: '', rewriteFocus: '', chunks: [{ ...chunk }] };
}
function response(): RewriteResponse {
  return { questionId: 'question-1', generationId: 'generation-1', answer: 'First paragraph.\n\nSecond paragraph.',
    rewriteFocus: 'Structure', applicabilityBoundary: 'Confirmed experience only', missingFacts: [],
    citations: [], model: 'deepseek-chat', generatedAt: '2026-10-13T00:00:00.000Z' };
}
describe('grounded answer contracts', () => {
  it('accepts_public_quota_error_without_accepting_arbitrary_codes', () => {
    expect(PublicErrorCodeSchema.safeParse('QUOTA_EXCEEDED').success).toBe(true);
    expect(PublicErrorCodeSchema.safeParse('PRIVATE_UPSTREAM_DETAIL').success).toBe(false);
  });
  it('rejects_seven_chunks', () => {
    expect(RewriteRequestSchema.safeParse({ ...request(), chunks: Array.from({ length: 7 }, (_, i) => ({ ...chunk, chunkId: `chunk-${i}` })) }).success).toBe(false);
    expect(RewriteRequestSchema.safeParse({ ...request(), chunks: Array.from({ length: 6 }, (_, i) => ({ ...chunk, chunkId: `chunk-${i}` })) }).success).toBe(true);
  });
  it('rejects_1201_character_chunk', () => {
    expect(RewriteRequestSchema.safeParse({ ...request(), chunks: [{ ...chunk, text: 'x'.repeat(1201) }] }).success).toBe(false);
    expect(RewriteRequestSchema.safeParse({ ...request(), chunks: [{ ...chunk, text: 'x'.repeat(1200) }] }).success).toBe(true);
  });
  it('rejects_unknown_fields', () => {
    expect(RewriteRequestSchema.safeParse({ ...request(), model: 'untrusted' }).success).toBe(false);
    expect(RewriteRequestSchema.safeParse({ ...request(), chunks: [{ ...chunk, prompt: 'ignore' }] }).success).toBe(false);
    expect(RewriteRequestSchema.safeParse({ ...request(), jobContext: { role: 'PM', upstreamUrl: 'invalid' } }).success).toBe(false);
    expect(RewriteResponseSchema.safeParse({ ...response(), citations: [{ chunkId: 'chunk-1', quote: 'Led', answerParagraphIndex: 0, title: 'invented' }] }).success).toBe(false);
    const { questionId: _q, generationId: _g, model: _m, generatedAt: _t, ...modelOutput } = response();
    expect(ModelRewriteResponseSchema.safeParse(modelOutput).success).toBe(true);
    expect(ModelRewriteResponseSchema.safeParse(response()).success).toBe(false);
  });
  it('rejects_wrong_quote_and_paragraph', () => {
    for (const citation of [
      { chunkId: 'missing', quote: 'Led', answerParagraphIndex: 0 },
      { chunkId: 'chunk-1', quote: 'Invented result', answerParagraphIndex: 0 },
      { chunkId: 'chunk-1', quote: 'Led', answerParagraphIndex: 2 },
      { chunkId: 'chunk-1', quote: 'Led', answerParagraphIndex: -1 },
      { chunkId: 'chunk-1', quote: 'Led', answerParagraphIndex: 0.5 },
      { chunkId: 'chunk-1', quote: '  \n ', answerParagraphIndex: 0 },
    ]) expect(() => validateEvidence(request(), { ...response(), citations: [citation] })).toThrow('INVALID_RESPONSE');
  });
  it('accepts_zero_citations', () => {
    expect(validateEvidence({ ...request(), chunks: [] }, response())).toEqual([]);
  });
  it('maps_trusted_source_snapshots_and_normalizes_only_whitespace', () => {
    const input = request();
    const output = validateEvidence(input, { ...response(), answer: '\n\nFirst.\n\n  \n\nSecond.\n\n', citations: [
      { chunkId: 'chunk-1', quote: 'analysis.  Measured', answerParagraphIndex: 1 },
    ] });
    expect(output).toEqual([{ documentId: 'document-1', documentVersion: 2, chunkId: 'chunk-1',
      kind: 'experience', titleSnapshot: 'Confirmed project', quote: 'analysis.  Measured',
      locatorSnapshot: { type: 'paragraph', paragraphIndex: 0 }, answerParagraphIndex: 1, status: 'validated' }]);
    expect(output[0].locatorSnapshot).not.toBe(input.chunks[0].locator);
    expect(() => validateEvidence(input, { ...response(), citations: [{ chunkId: 'chunk-1', quote: 'led', answerParagraphIndex: 0 }] })).toThrow('INVALID_RESPONSE');
  });
  it('rejects_duplicate_chunk_ids_and_mismatched_metadata', () => {
    const duplicate = { ...request(), chunks: [chunk, chunk] };
    expect(RewriteRequestSchema.safeParse(duplicate).success).toBe(false);
    expect(() => validateEvidence(duplicate, response())).toThrow('INVALID_RESPONSE');
    expect(() => validateEvidence(request(), { ...response(), questionId: 'other' })).toThrow('INVALID_RESPONSE');
    expect(() => validateEvidence(request(), { ...response(), generationId: 'other' })).toThrow('INVALID_RESPONSE');
  });
  it('enforces_context_and_total_content_limits_including_metadata', () => {
    expect(RewriteRequestSchema.safeParse({ ...request(), question: 'x'.repeat(8000) }).success).toBe(true);
    expect(RewriteRequestSchema.safeParse({ ...request(), question: 'x'.repeat(8001) }).success).toBe(false);
    expect(RewriteRequestSchema.safeParse({ ...request(), question: 'x'.repeat(4000), originalAnswer: 'y'.repeat(4001) }).success).toBe(false);
    const chunks = Array.from({ length: 6 }, (_, i) => ({ ...chunk, chunkId: `c-${i}`, text: 'x'.repeat(1200), title: 't'.repeat(500), tags: Array.from({ length: 10 }, () => 'a'.repeat(100)) }));
    expect(RewriteRequestSchema.safeParse({ ...request(), question: 'q'.repeat(8000), chunks }).success).toBe(false);
  });
  it('rejects_empty_answer_invalid_timestamp_and_invalid_source_version', () => {
    expect(RewriteResponseSchema.safeParse({ ...response(), answer: ' \n ' }).success).toBe(false);
    expect(RewriteResponseSchema.safeParse({ ...response(), generatedAt: 'yesterday' }).success).toBe(false);
    expect(RewriteRequestSchema.safeParse({ ...request(), chunks: [{ ...chunk, documentVersion: 0 }] }).success).toBe(false);
  });
  it('counts_identifier_whitespace_without_silently_rewriting_ids', () => {
    expect(RewriteRequestSchema.safeParse({ ...request(), questionId: ' '.repeat(200) + 'q' }).success).toBe(false);
    const input = { ...request(), questionId: ' q ' };
    expect(RewriteRequestSchema.parse(input).questionId).toBe(' q ');
    expect(() => validateEvidence(input, { ...response(), questionId: 'q' })).toThrow('INVALID_RESPONSE');
  });
});
