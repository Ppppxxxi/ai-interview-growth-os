import { describe, expect, it } from 'vitest';
import { exportUserBackup, MAX_BACKUP_BYTES, validateUserBackup, type UserBackup } from '../backup';
import { createPersonalWorkspaceData } from '../../workflow/personalWorkspace';
import { answerAssets, jobFiles } from '../../domain/sampleData';
import type { AnswerEvidence } from '../../domain/materialTypes';

const ref: AnswerEvidence = { documentId: 'd', documentVersion: 1, chunkId: 'old', kind: 'experience', titleSnapshot: 'Synthetic', quote: 'Quote', answerParagraphIndex: 0, status: 'source-updated' };
function backup(): UserBackup {
  const workspace = createPersonalWorkspaceData(structuredClone(jobFiles), [structuredClone(answerAssets[0])]);
  const asset = workspace.answerAssets[0];
  asset.sourceQuestionId = 'q'; asset.evidence = [ref]; asset.modelRationale = { rewriteFocus: 'Actual', applicabilityBoundary: 'Limited' };
  asset.answerRationale = { sourceQuestion: 'Q', originalIssue: 'Issue', rewriteFocus: 'Actual', requestedRewriteFocus: 'Requested', applicabilityBoundary: 'Limited' };
  asset.generation = { provider: 'deepseek', model: 'synthetic-model', origin: 'model', generatedAt: '', generationId: 'gen' };
  asset.missingFacts = ['Unconfirmed']; asset.answerVersions = [{ id: 'v1', answer: 'User body', note: 'User note', createdAt: '', source: 'generated',
    modelRationale: asset.modelRationale, answerRationale: asset.answerRationale, evidence: [ref], generation: asset.generation, missingFacts: asset.missingFacts }];
  return { schemaVersion: 1, workspace, snapshot: { documents: [{ id: 'd', kind: 'experience', title: 'Synthetic', text: 'Replacement', tags: [], sourceFormat: 'paste', version: 2, createdAt: '', updatedAt: '' }],
    chunks: [{ id: 'new', documentId: 'd', documentVersion: 2, title: 'Synthetic', text: 'Replacement', kind: 'experience', tags: [], locator: { type: 'paragraph', paragraphIndex: 0 } }],
    drafts: [{ id: 'focus-flow:unconfirmed-job', kind: 'focus-flow', schemaVersion: 1, jobId: 'unconfirmed-job', jobDraft: { company: '', roleTitle: '', direction: '', jdText: '' }, rawText: 'User raw text', stage: 'input', activeItemId: '', work: {}, updatedAt: '' },
      { id: 'editor', kind: 'knowledge', title: 'User draft', text: 'Not confirmed', tags: [], sourceFormat: 'paste', selectedChunks: [], updatedAt: '' }] } };
}
describe('strict user backup', () => {
  it('preserves_legacy_editor_document_metadata_without_allowing_arbitrary_fields', () => {
    const value = backup();
    value.snapshot.drafts[1] = { ...value.snapshot.drafts[1], createdAt: '2026-10-18', version: 1 } as never;
    expect(validateUserBackup(value)).toEqual(value);
  });
  it('roundtrips_all_optional_fields_and_stored_draft_union', () => {
    const value = backup(); expect(exportUserBackup(value.workspace, value.snapshot)).toEqual(value);
    expect(validateUserBackup(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });
  it('accepts_replaced_historical_chunks_deleted_sources_and_unconfirmed_job_identity', () => {
    const value = backup(); expect(validateUserBackup(value)).toEqual(value);
    value.workspace.answerAssets[0].evidence = [{ ...ref, status: 'source-deleted', titleSnapshot: '已删除资料', quote: '' }];
    value.workspace.answerAssets[0].answerVersions![0].evidence = [{ ...ref, status: 'needs-review' }];
    value.snapshot.documents = []; value.snapshot.chunks = [];
    expect(validateUserBackup(value)).toEqual(value);
  });
  it.each(['quote', 'titleSnapshot'] as const)('rejects_oversized_evidence_%s', field => {
    const value = backup(); value.workspace.answerAssets[0].evidence![0] = { ...ref, [field]: 'x'.repeat(field === 'quote' ? 1201 : 501) };
    expect(() => validateUserBackup(value)).toThrow();
  });
  it('rejects_forged_current_selections_before_restore', () => {
    const value = backup(); value.snapshot.drafts[1] = { ...value.snapshot.drafts[1], selectedChunks: [{ documentId: 'd', documentVersion: 2, chunkId: 'forged' }] } as never;
    expect(() => validateUserBackup(value)).toThrow();
  });
  it('rejects_unknown_fields_duplicates_bad_lengths_and_material_relations', () => {
    for (const mutate of [
      (value: UserBackup) => { (value.workspace.answerAssets[0] as unknown as Record<string, unknown>).cloudLogs = []; },
      (value: UserBackup) => { value.snapshot.documents.push(value.snapshot.documents[0]); },
      (value: UserBackup) => { value.snapshot.documents[0].text = 'x'.repeat(50_001); },
      (value: UserBackup) => { value.snapshot.chunks[0].documentId = 'forged'; },
      (value: UserBackup) => { value.workspace.answerAssets[0].evidence![0].documentVersion = 3; },
    ]) { const value = backup(); mutate(value); expect(() => validateUserBackup(value)).toThrow(); }
  });
  it('rejects_over_twenty_mib_before_structural_changes', () => {
    expect(() => validateUserBackup({ padding: 'x'.repeat(MAX_BACKUP_BYTES) })).toThrow('20 MiB');
  });
});
