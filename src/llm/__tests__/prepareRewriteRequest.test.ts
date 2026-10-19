import { describe, expect, it } from 'vitest';
import { prepareRewriteRequest } from '../prepareRewriteRequest';
import { chunk, item, job } from './fixtures';

describe('request boundary', () => {
  it.each(['First confirmed JD', 'Changed confirmed JD'])('uses current input-derived JD, not stale profile: %s', jdText => {
    expect(prepareRewriteRequest(item, { ...job, jdText }, [], 'g1').jobContext?.jdSummary).toBe(jdText);
  });
  it('empty JD cannot revive stale profile and over-limit JD is rejected, not truncated', () => {
    expect(prepareRewriteRequest(item, { ...job, jdText: '' }, [], 'g1').jobContext).not.toHaveProperty('jdSummary');
    expect(() => prepareRewriteRequest(item, { ...job, jdText: 'x'.repeat(8001) }, [], 'g1')).toThrow();
  });
  it('sends_only_selected_chunks', () => {
    const input = prepareRewriteRequest(item, job, [chunk], 'g1');
    expect(input).toEqual({ questionId: 'q1', generationId: 'g1', question: 'What did you do?',
      originalAnswer: 'Analyzed data.', issue: 'Unclear structure', rewriteFocus: 'Clarify actions',
      jobContext: { company: 'Synthetic company', role: 'Analyst', jdSummary: 'Analyze metrics' },
      chunks: [{ chunkId: 'c1', documentId: 'd1', documentVersion: 2, kind: 'experience',
        title: 'Synthetic project', text: 'Measured the result.', locator: { type: 'paragraph', paragraphIndex: 0 }, tags: ['analysis'] }] });
    expect(JSON.stringify(input)).not.toContain('PRIVATE');
    expect(prepareRewriteRequest(item, job, [], 'g2').chunks).toEqual([]);
  });
  it.each(['PRIVATE OLD EVIDENCE', []])('supports_legacy_or_array_evidence_without_sending_it', evidence => {
    const output = prepareRewriteRequest({ ...item, evidence }, job, [], 'g1');
    expect(output).not.toHaveProperty('evidence');
  });
  it.each([
    { ...chunk, text: 'PRIVATE'.repeat(200) },
    { ...chunk, id: '' },
  ])('rejects_invalid_chunks_without_truncation_or_private_errors', selected => {
    expect(() => prepareRewriteRequest(item, job, [selected], 'g1')).toThrow(/[\u4e00-\u9fff]/);
    try { prepareRewriteRequest(item, job, [selected], 'g1'); } catch (error) { expect(String(error)).not.toContain('PRIVATE'); }
  });
  it('rejects_duplicate_chunks_and_excess_context', () => {
    expect(() => prepareRewriteRequest(item, job, [chunk, chunk], 'g1')).toThrow();
    expect(() => prepareRewriteRequest({ ...item, originalAnswer: 'x'.repeat(8000) }, job, [], 'g1')).toThrow();
    expect(() => prepareRewriteRequest(item, job, Array.from({ length: 7 }, (_, i) => ({ ...chunk, id: `c${i}` })), 'g1')).toThrow();
  });
  it('does_not_fabricate_a_missing_question_or_summary', () => {
    expect(() => prepareRewriteRequest({ ...item, question: undefined }, job, [], 'g1')).toThrow();
    expect(prepareRewriteRequest(item, { ...job, jdText: '', profile: undefined }, [], 'g1').jobContext).not.toHaveProperty('jdSummary');
  });
});
