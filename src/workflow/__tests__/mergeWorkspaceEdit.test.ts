import { expect, it } from 'vitest';
import { mergeWorkspaceEdit } from '../mergeWorkspaceEdit';
import { createPersonalWorkspaceData } from '../personalWorkspace';
import { job } from '../../llm/__tests__/fixtures';
import { answerAssets } from '../../domain/sampleData';

it('merges unrelated job edits onto the latest durable assets without mutating inputs', () => {
  const base = createPersonalWorkspaceData([job], [], job.id, 'base');
  const latest = { ...base, answerAssets: [answerAssets[0]], updatedAt: 'latest' };
  const edit = { ...base, jobFiles: [{ ...job, company: 'Synthetic edit' }] };
  const original = structuredClone({ base, latest, edit });
  expect(mergeWorkspaceEdit(base, edit, latest)).toMatchObject({ jobFiles: edit.jobFiles, answerAssets: latest.answerAssets });
  expect({ base, latest, edit }).toEqual(original);
});
it('rejects concurrent deletion with newly added dependencies and same entity conflicts', () => {
  const base = createPersonalWorkspaceData([job, { ...job, id: 'j2' }], [], job.id);
  const latest = { ...base, answerAssets: [{ ...answerAssets[0], sourceJobId: job.id }] };
  expect(() => mergeWorkspaceEdit(base, { ...base, jobFiles: [base.jobFiles[1]], selectedJobId: 'j2' }, latest)).toThrow('另一页面');
  expect(() => mergeWorkspaceEdit(base, { ...base, jobFiles: [{ ...job, company: 'B' }] }, { ...base, jobFiles: [{ ...job, company: 'A' }] })).toThrow('另一页面');
});
