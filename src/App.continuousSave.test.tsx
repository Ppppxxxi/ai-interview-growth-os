// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { mockBrowserLocks } from './materials/__tests__/browserLocks';
import * as repositories from './materials/repository';
import { getMaterialDraftQueue } from './materials/draftQueue';
import { createPersonalWorkspaceData, PERSONAL_WORKSPACE_STORAGE_KEY, writePersonalWorkspace, type PersonalWorkspaceData } from './workflow/personalWorkspace';
import { job, item } from './llm/__tests__/fixtures';

const target = { ...job, interviewSessionIds: [] };
const firstAnswer = 'Synthetic confirmed first answer';
const secondAnswer = 'Synthetic confirmed second answer';
let repo: repositories.MaterialRepository;
const durable = (): PersonalWorkspaceData => JSON.parse(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)!);
const idle = () => act(async () => { await getMaterialDraftQueue(repo).whenIdle(); });
beforeEach(async () => {
  mockBrowserLocks(); vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false }))));
  repo = repositories.createMaterialRepository(); vi.spyOn(repositories, 'createMaterialRepository').mockReturnValue(repo);
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([target], [], target.id));
  await repo.saveFlowDraft({ id: `focus-flow:${target.id}`, kind: 'focus-flow', schemaVersion: 1, jobId: target.id,
    jobDraft: { company: target.company, roleTitle: target.roleTitle, direction: target.direction, jdText: target.jdText },
    rawText: 'Synthetic two-question source', stage: 'answers', activeItemId: 'q1', work: {}, updatedAt: '',
    materialDraft: { sourceType: 'review_notes', jobContext: {}, interviewItems: [
      { ...item, id: 'q1', title: 'First', question: 'First synthetic question?', improvedAnswer: '' },
      { ...item, id: 'q2', title: 'Second', question: 'Second synthetic question?', improvedAnswer: '' },
    ], globalInsights: {}, missingInfoWarnings: [] } });
});
afterEach(async () => { cleanup(); await getMaterialDraftQueue(repo).whenIdle(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
async function open() {
  render(<App />); await screen.findByRole('heading', { name: '工作台' });
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: '开始新面试' }));
  await screen.findByText('未保存草稿'); await idle();
}
async function adopt(answer: string) {
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: answer } });
  fireEvent.click(screen.getByRole('button', { name: /^采用$/ })); await idle();
}
async function save() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存到我的回答库' })); await getMaterialDraftQueue(repo).whenIdle(); });
}
function expectLinked(count: number) {
  const stored = durable();
  expect(stored.interviewSessions).toHaveLength(1); expect(stored.reviewReports).toHaveLength(1);
  expect(stored.interviewSessions[0].questions.map(q => q.question)).toEqual(['First synthetic question?', 'Second synthetic question?']);
  expect(stored.interviewSessions[0].rawConversation).toBe('Synthetic two-question source');
  expect(stored.jobFiles[0].interviewSessionIds).toEqual([stored.interviewSessions[0].id]);
  expect(stored.jobFiles[0].status).toBe('1 场面试记录'); expect(stored.answerAssets).toHaveLength(count);
  for (const asset of stored.answerAssets) expect(asset).toMatchObject({ sourceJobId: target.id, sourceInterviewId: stored.interviewSessions[0].id,
    sourceReviewId: stored.reviewReports[0].id, originalAnswer: item.originalAnswer, issue: item.issue,
    confirmationStatus: 'accepted', answerRationale: { requestedRewriteFocus: item.improvementSuggestion } });
  return stored;
}
it('actual App saves two questions consecutively and starts another interview without losing durable links', async () => {
  await open(); await adopt(firstAnswer); await save();
  await waitFor(() => expectLinked(1));
  const firstSessionId = durable().interviewSessions[0].id;
  await screen.findByRole('heading', { name: 'Second synthetic question?' }); await adopt(secondAnswer); await save();
  await waitFor(() => expect(durable().answerAssets).toHaveLength(2));
  const stored = expectLinked(2);
  expect(stored.interviewSessions[0].id).toBe(firstSessionId);
  expect(stored.answerAssets.map(asset => asset.improvedAnswer).sort()).toEqual([firstAnswer, secondAnswer].sort());
  expect(new Set(stored.answerAssets.map(asset => asset.id)).size).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: '开始下一场面试' }));
  fireEvent.change(screen.getByLabelText('面试材料'), { target: { value: '面试官：如何分析虚构新场景？\n候选人：比较指标。' } });
  fireEvent.click(screen.getByRole('button', { name: '解析材料' })); fireEvent.click(screen.getByRole('button', { name: '生成下次可用回答' }));
  await adopt('Synthetic next interview answer'); await save();
  await waitFor(() => expect(durable().answerAssets).toHaveLength(3));
  const next = durable(); expect(next.interviewSessions).toHaveLength(2); expect(next.reviewReports).toHaveLength(2);
  expect(next.jobFiles[0].interviewSessionIds).toHaveLength(2); expect(next.jobFiles[0].status).toBe('2 场面试记录');
  expect(new Set(next.jobFiles[0].interviewSessionIds)).toEqual(new Set(next.interviewSessions.map(session => session.id)));
  expect(next.interviewSessions.find(session => session.id === firstSessionId)?.questions).toEqual(stored.interviewSessions[0].questions);
  expect(next.answerAssets.filter(asset => asset.sourceInterviewId === firstSessionId).map(asset => asset.improvedAnswer).sort()).toEqual([firstAnswer, secondAnswer].sort());
});
it.each(['session', 'asset'] as const)('actual App retries a failed %s write with stable identities and no false baseline advance', async failure => {
  await open(); await adopt(firstAnswer);
  const original = Storage.prototype.setItem; const attempts: PersonalWorkspaceData[] = [];
  const fault = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === PERSONAL_WORKSPACE_STORAGE_KEY) {
      const next = JSON.parse(value) as PersonalWorkspaceData;
      if (failure === 'session' ? next.interviewSessions.length > 0 : next.answerAssets.length > 0) {
        attempts.push(next); throw new DOMException('Synthetic persistence failure', 'QuotaExceededError');
      }
    }
    original.call(this, key, value);
  });
  await save(); await screen.findByText('保存失败，请重试');
  expect(attempts.length).toBeGreaterThan(0); const attempted = attempts[0];
  const partial = durable(); expect(partial.answerAssets).toEqual([]);
  if (failure === 'session') {
    expect(partial.interviewSessions).toEqual([]); expect(partial.reviewReports).toEqual([]);
    expect(partial.jobFiles[0].interviewSessionIds).toEqual([]);
  } else { expectLinked(0); expect(partial.interviewSessions[0].id).toBe(attempted.interviewSessions[0].id); }
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe(firstAnswer);
  fault.mockRestore(); await save();
  await waitFor(() => expect(durable().answerAssets).toHaveLength(1));
  const retried = expectLinked(1);
  expect(retried.interviewSessions[0].id).toBe(attempted.interviewSessions[0].id);
  expect(retried.reviewReports[0].id).toBe(attempted.reviewReports[0].id);
  expect(retried.answerAssets[0].improvedAnswer).toBe(firstAnswer);
  if (failure === 'asset') expect(retried.answerAssets[0].id).toBe(attempted.answerAssets[0].id);
  await screen.findByRole('heading', { name: 'Second synthetic question?' }); await adopt(secondAnswer); await save();
  await waitFor(() => expect(durable().answerAssets).toHaveLength(2)); expectLinked(2);
  expect(new Set(durable().answerAssets.map(asset => asset.id)).size).toBe(2);
});
it.each(['company', 'session-link'])('actual App still rejects a true external %s change after its own partial save and retains confirmed input', async change => {
  await open(); await adopt(firstAnswer); await save(); await waitFor(() => expectLinked(1));
  const external = durable(); external.jobFiles[0] = change === 'company' ? { ...external.jobFiles[0], company: 'External synthetic edit' }
    : { ...external.jobFiles[0], interviewSessionIds: [...external.jobFiles[0].interviewSessionIds, 'external-session'], status: 'External session status' };
  writePersonalWorkspace(localStorage, external);
  await screen.findByRole('heading', { name: 'Second synthetic question?' }); await adopt(secondAnswer);
  // Identity autosave reads the external props; that must not rebase this dirty session.
  const before = localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY);
  await save(); await screen.findByText(/另一页面已修改相同数据/);
  expect(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(before);
  expect(durable().jobFiles[0]).toEqual(external.jobFiles[0]); expect(durable().answerAssets).toHaveLength(1);
  expect(durable().answerAssets[0].improvedAnswer).toBe(firstAnswer);
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe(secondAnswer);
});
