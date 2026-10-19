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
function currentBackup(): UserBackup {
  const value = backup(); const asset = value.workspace.answerAssets[0];
  asset.improvedAnswer = 'First paragraph.\r\nSecond line.\r\n \r\nSecond paragraph.';
  asset.evidence = [{ ...ref, documentVersion: 2, chunkId: 'new', quote: 'Replacement', status: 'validated', locatorSnapshot: { type: 'paragraph', paragraphIndex: 0 } }];
  asset.answerVersions = [{ ...asset.answerVersions![0], answer: 'One historical paragraph.', evidence: structuredClone(asset.evidence) }];
  return value;
}
describe('strict user backup', () => {
  it.each([
    { titleSnapshot: 'Forged title' },
    { locatorSnapshot: { type: 'page' as const, pageNumber: 999 } },
    { locatorSnapshot: undefined },
    { locatorSnapshot: { type: 'paragraph' as const, paragraphIndex: 999 } },
  ])('rejects_forged_current_validated_source_metadata_%j', patch => {
    const value = currentBackup(); Object.assign(value.workspace.answerAssets[0].evidence![0], patch);
    expect(() => validateUserBackup(value)).toThrow();
  });
  it.each(['', '  \r\n\t'])('rejects_empty_or_whitespace_current_validated_quote_%j', quote => {
    const value = currentBackup(); value.workspace.answerAssets[0].evidence![0].quote = quote;
    expect(() => validateUserBackup(value)).toThrow();
  });
  it('matches_page_locator_fields_without_relying_on_object_key_order', () => {
    const value = currentBackup(); const asset = value.workspace.answerAssets[0];
    value.snapshot.chunks[0].locator = { type: 'page', pageNumber: 3, paragraphIndex: 0 };
    const locator = { paragraphIndex: 0, pageNumber: 3, type: 'page' as const };
    asset.evidence![0].locatorSnapshot = locator; asset.answerVersions![0].evidence![0].locatorSnapshot = locator;
    expect(validateUserBackup(value)).toEqual(value);
    asset.evidence![0].locatorSnapshot = { ...locator, paragraphIndex: 1 };
    expect(() => validateUserBackup(value)).toThrow();
  });
  it('validates_answer_paragraph_against_its_own_asset_version_and_flow_item_body', () => {
    const value = currentBackup(); value.workspace.answerAssets[0].evidence![0].answerParagraphIndex = 1;
    expect(validateUserBackup(value)).toEqual(value);
    const badCurrent = structuredClone(value); badCurrent.workspace.answerAssets[0].evidence![0].answerParagraphIndex = 2;
    expect(() => validateUserBackup(badCurrent)).toThrow();
    const emptyBody = structuredClone(value); emptyBody.workspace.answerAssets[0].improvedAnswer = ' \r\n\t'; emptyBody.workspace.answerAssets[0].evidence![0].answerParagraphIndex = 0;
    expect(() => validateUserBackup(emptyBody)).toThrow();
    const badVersion = structuredClone(value); badVersion.workspace.answerAssets[0].answerVersions![0].evidence![0].answerParagraphIndex = 1;
    expect(() => validateUserBackup(badVersion)).toThrow();
    const flow = value.snapshot.drafts[0]; if (flow.kind !== 'focus-flow') throw new Error('fixture');
    flow.stage = 'answers'; flow.activeItemId = 'q'; flow.materialDraft = { sourceType: 'mixed_material', jobContext: {}, globalInsights: {}, missingInfoWarnings: [], interviewItems: [{
      id: 'q', title: 'Synthetic', improvedAnswer: 'One flow paragraph.', answerAssetCandidate: true, confidence: 'high', evidence: structuredClone(value.workspace.answerAssets[0].evidence),
    }] };
    expect(() => validateUserBackup(value)).toThrow();
    flow.materialDraft.interviewItems[0].evidence = [{ ...value.workspace.answerAssets[0].evidence![0], answerParagraphIndex: 0 }];
    expect(validateUserBackup(value)).toEqual(value);
    flow.materialDraft.interviewItems[0].answerVersions = [{ ...value.workspace.answerAssets[0].answerVersions![0], evidence: [{ ...value.workspace.answerAssets[0].evidence![0] }] }];
    expect(() => validateUserBackup(value)).toThrow();
  });
  it('preserves_historical_and_needs_review_metadata_without_reattaching_to_current_chunks', () => {
    const value = currentBackup(); const asset = value.workspace.answerAssets[0];
    asset.evidence = [{ ...asset.evidence![0], status: 'needs-review', titleSnapshot: 'Earlier title', locatorSnapshot: { type: 'page', pageNumber: 999 }, answerParagraphIndex: 999 }];
    asset.answerVersions![0].evidence = [{ ...ref, status: 'validated', titleSnapshot: 'Historical title', locatorSnapshot: { type: 'page', pageNumber: 3 } }];
    expect(validateUserBackup(value)).toEqual(value);
  });
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
