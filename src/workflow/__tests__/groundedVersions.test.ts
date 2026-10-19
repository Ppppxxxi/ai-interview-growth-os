import { expect, it } from 'vitest';
import { answerAssets } from '../../domain/sampleData';
import { chunk, request, response } from '../../llm/__tests__/fixtures';
import { validateEvidence } from '../../llm/validateEvidence';
import { saveAnswerAssetVersion, restoreAnswerAssetVersion } from '../answerAssetVersions';
import { FocusFlowDraftSchema } from '../../domain/focusFlowDraft';

const grounded = { ...answerAssets[0], evidence: validateEvidence(request(), response()),
  generation: { provider: 'deepseek' as const, model: 'test', generatedAt: 'then', generationId: 'g1', origin: 'model' as const },
  missingFacts: ['missing result'], modelRationale: { rewriteFocus: 'actual focus', applicabilityBoundary: 'actual boundary' },
  answerRationale: { sourceQuestion: 'question', originalIssue: 'issue', rewriteFocus: 'actual focus', applicabilityBoundary: 'actual boundary', requestedRewriteFocus: 'requested' } };

it('manual_edit_marks_evidence_needs_review', () => {
  const updated = saveAnswerAssetVersion(grounded, { answer: 'manual', note: '' });
  expect(updated.evidence?.[0].status).toBe('needs-review');
  expect(updated.generation?.origin).toBe('manual');
  expect(updated.generation?.generationId).toBe('g1');
  expect(updated.answerVersions?.[0]).toMatchObject({ evidence: grounded.evidence, generation: grounded.generation,
    missingFacts: grounded.missingFacts, modelRationale: grounded.modelRationale, answerRationale: grounded.answerRationale });
});
it('restore_version_restores_its_evidence', () => {
  const updated = saveAnswerAssetVersion(grounded, { answer: 'manual', note: '' }, '2026-10-14');
  const restored = restoreAnswerAssetVersion({ ...updated, evidence: [{ ...grounded.evidence[0], titleSnapshot: chunk.title + ' different' }],
    modelRationale: undefined, answerRationale: undefined }, updated.answerVersions![0].id, '2026-10-15');
  expect(restored).toMatchObject({ improvedAnswer: grounded.improvedAnswer, evidence: grounded.evidence,
    generation: grounded.generation, missingFacts: grounded.missingFacts, modelRationale: grounded.modelRationale, answerRationale: grounded.answerRationale });
});
it('feedback_edit_does_not_claim_new_model_output', () => {
  const updated = saveAnswerAssetVersion(grounded, { answer: 'feedback template', note: '', source: 'usage-feedback' });
  expect(updated.generation?.origin).toBe('manual');
  expect(updated.evidence?.[0].status).toBe('needs-review');
  expect(updated.modelRationale).toEqual(grounded.modelRationale);
});
it('restoring_legacy_version_clears_current_metadata_even_for_same_text', () => {
  const updated = restoreAnswerAssetVersion({ ...grounded, answerVersions: [{ id: 'old', answer: grounded.improvedAnswer, note: '', createdAt: '', source: 'generated' }] }, 'old');
  expect(updated.evidence).toBeUndefined();
  expect(updated.generation).toBeUndefined();
  expect(updated.modelRationale).toBeUndefined();
  expect(updated.answerRationale).toBeUndefined();
});
it('strict_flow_schema_roundtrips_version_rationale_without_loss', () => {
  const asset = saveAnswerAssetVersion(grounded, { answer: 'manual', note: '' });
  const draft = { id: 'focus-flow:j1', kind: 'focus-flow', schemaVersion: 1, jobId: 'j1', jobDraft: { company: '', roleTitle: '', direction: '', jdText: '' },
    rawText: '', stage: 'answers', activeItemId: 'q1', work: {}, updatedAt: '', materialDraft: { sourceType: 'review_notes', jobContext: {}, globalInsights: {}, missingInfoWarnings: [],
      interviewItems: [{ id: 'q1', title: 'question', confidence: 'high', answerAssetCandidate: true, answerVersions: asset.answerVersions }] } };
  expect(FocusFlowDraftSchema.parse(draft)).toEqual(draft);
});
it('same_answer_from_new_model_run_still_versions_its_own_metadata', () => {
  const next = { ...grounded, evidence: [{ ...grounded.evidence[0], titleSnapshot: 'new source' }],
    generation: { ...grounded.generation, generationId: 'g2' }, missingFacts: ['different missing fact'],
    modelRationale: { rewriteFocus: 'new actual focus', applicabilityBoundary: 'new actual boundary' },
    answerRationale: { ...grounded.answerRationale, requestedRewriteFocus: 'new request', rewriteFocus: 'new actual focus', applicabilityBoundary: 'new actual boundary' } };
  const updated = saveAnswerAssetVersion(grounded, { ...next, answer: grounded.improvedAnswer, note: '', source: 'generated' });
  expect(updated.generation?.generationId).toBe('g2'); expect(updated.answerVersions).toHaveLength(1);
  next.evidence[0].titleSnapshot = 'mutated';
  expect(updated.evidence?.[0].titleSnapshot).toBe('new source');
  const restored = restoreAnswerAssetVersion(updated, updated.answerVersions![0].id);
  expect(restored.answerRationale).toEqual(grounded.answerRationale);
  expect(restored.answerVersions![0].answerRationale?.requestedRewriteFocus).toBe('new request');
});
it('new_zero_citation_model_output_does_not_inherit_old_references', () => {
  const updated = saveAnswerAssetVersion(grounded, { answer: 'zero reference output', note: '', source: 'generated',
    generation: { ...grounded.generation, generationId: 'g2' }, evidence: [], missingFacts: [] });
  expect(updated.evidence).toEqual([]); expect(updated.modelRationale).toBeUndefined();
  expect(updated.answerRationale).toBeUndefined(); expect(updated.answerVersions![0].evidence).toEqual(grounded.evidence);
});
