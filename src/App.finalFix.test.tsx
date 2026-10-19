// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { mockBrowserLocks } from './materials/__tests__/browserLocks';
import { createPersonalWorkspaceData, PERSONAL_WORKSPACE_STORAGE_KEY, writePersonalWorkspace } from './workflow/personalWorkspace';
import { job } from './llm/__tests__/fixtures';
import { createMaterialRepository } from './materials/repository';
import * as materialRepositories from './materials/repository';
import { getMaterialDraftQueue } from './materials/draftQueue';
import { answerAssets } from './domain/sampleData';
import type { RewriteRequest } from './domain/llmContracts';

beforeEach(() => {
  mockBrowserLocks(); vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false }))));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
const stored = () => JSON.parse(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)!);
async function app() {
  const repository = createMaterialRepository();
  vi.spyOn(materialRepositories, 'createMaterialRepository').mockReturnValueOnce(repository);
  const ui = render(<App />); const q = within(ui.container);
  await q.findByRole('heading', { name: '工作台' }); return { ...ui, q, repository };
}
it('two actual Apps preserve an adopted answer when a stale job editor saves', async () => {
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([job], [], job.id));
  const a = await app(); const b = await app();
  fireEvent.click(b.q.getByRole('button', { name: '目标岗位' }));
  const company = within(b.container.querySelector('.job-edit-panel')!).getByLabelText('公司');
  fireEvent.change(company, { target: { value: 'Synthetic B edit' } });
  fireEvent.click(within(a.q.getByRole('navigation')).getByRole('button', { name: '开始新面试' }));
  const input = await a.q.findByLabelText('面试材料');
  await waitFor(() => expect(input.matches(':disabled')).toBe(false));
  fireEvent.change(input, { target: { value: '面试官：如何分析虚构产品？\n候选人：比较指标。' } });
  fireEvent.click(a.q.getByText('解析材料')); fireEvent.click(a.q.getByText('生成下次可用回答'));
  fireEvent.change(a.q.getByLabelText('下次可用回答'), { target: { value: 'Synthetic adopted A answer' } });
  fireEvent.click(a.q.getByText('采用'));
  await act(async () => { fireEvent.click(a.q.getByText('保存到我的回答库')); await getMaterialDraftQueue(a.repository).whenIdle(); });
  await a.q.findByRole('heading', { name: '下一场，更进一步' });
  await act(async () => { fireEvent.click(b.q.getByText('保存岗位信息')); });
  await b.q.findByText(/另一页面已修改相同数据/);
  expect(stored().answerAssets).toHaveLength(1);
  expect((company as HTMLInputElement).value).toBe('Synthetic B edit');
  if (stored().jobFiles[0].company !== 'Synthetic B edit') expect(b.q.getAllByRole('alert').length).toBeGreaterThan(0);
});
it('two actual Apps reject conflicting edits without losing either edit', async () => {
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([job], [], job.id));
  const a = await app(); const b = await app();
  for (const [ui, text] of [[a, 'Synthetic A'], [b, 'Synthetic B']] as const) {
    fireEvent.click(ui.q.getByRole('button', { name: '目标岗位' }));
    fireEvent.change(within(ui.container.querySelector('.job-edit-panel')!).getByLabelText('公司'), { target: { value: text } });
  }
  fireEvent.click(a.q.getByText('保存岗位信息'));
  await waitFor(() => expect(stored().jobFiles[0].company).toBe('Synthetic A'));
  // A harmless selection refresh must not rebase B's already-dirty form silently.
  fireEvent.click(b.container.querySelector('.file-tab')!);
  await waitFor(() => expect(b.container.querySelector('.file-tab')?.textContent).toContain('Synthetic A'));
  await act(async () => { fireEvent.click(b.q.getByText('保存岗位信息')); });
  await b.q.findByText(/另一页面已修改相同数据/);
  expect(stored().jobFiles[0].company).toBe('Synthetic A');
  expect((within(b.container.querySelector('.job-edit-panel')!).getByLabelText('公司') as HTMLInputElement).value).toBe('Synthetic B');
  expect(b.q.getAllByRole('alert').length).toBeGreaterThan(0);
});
it('actual App rejects an empty-job backup before either store changes and remains usable', async () => {
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([job], [], job.id));
  const ui = await app(); const before = localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY);
  const repo = createMaterialRepository(); const snapshot = await repo.exportSnapshot();
  const invalid = { schemaVersion: 1, workspace: createPersonalWorkspaceData([], [], ''), snapshot };
  const file = new File([], 'invalid.json'); Object.defineProperty(file, 'text', { value: async () => JSON.stringify(invalid) });
  fireEvent.change(ui.q.getByLabelText('恢复备份'), { target: { files: [file] } });
  await ui.q.findByText('备份无效或超过 20 MiB，当前数据未更改');
  expect(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(before);
  expect(await repo.exportSnapshot()).toEqual(snapshot);
  fireEvent.click(within(ui.q.getByRole('navigation')).getByRole('button', { name: '开始新面试' }));
  expect(await ui.q.findByLabelText('面试材料')).toBeTruthy();
  const valid = { ...invalid, workspace: createPersonalWorkspaceData([{ ...job, company: 'Restored synthetic company' }], [], job.id) };
  const validFile = new File([], 'valid.json'); Object.defineProperty(validFile, 'text', { value: async () => JSON.stringify(valid) });
  fireEvent.change(ui.q.getByLabelText('恢复备份'), { target: { files: [validFile] } });
  await ui.q.findByRole('heading', { name: '工作台' });
  expect(stored().jobFiles[0].company).toBe('Restored synthetic company');
  fireEvent.click(within(ui.q.getByRole('navigation')).getByRole('button', { name: '开始新面试' }));
  const restoredInput = await ui.q.findByLabelText('面试材料');
  await waitFor(() => expect(restoredInput.matches(':disabled')).toBe(false));
});
it.each(['unavailable', 'open-throws'])('DB %s exposes read-only history and independent no-ref editing; retry keeps edits', async failure => {
  const factory = indexedDB; const repo = createMaterialRepository();
  await repo.saveFlowDraft({ id: `focus-flow:${job.id}`, kind: 'focus-flow', schemaVersion: 1, jobId: job.id,
    jobDraft: { company: '', roleTitle: '', direction: '', jdText: '' }, rawText: 'Protected original draft', stage: 'input', activeItemId: '', work: {}, updatedAt: '' });
  const before = await repo.exportSnapshot();
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([job], [{ ...answerAssets[0], improvedAnswer: 'Synthetic historical answer' }], job.id));
  const original = localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY);
  vi.stubGlobal('indexedDB', failure === 'unavailable' ? undefined : { open() { throw new Error('Synthetic open failure'); } });
  const ui = render(<App />); const q = within(ui.container);
  await q.findByText(/日志状态未知/);
  expect(q.getByRole('heading', { name: '工作台' })).toBeTruthy();
  expect(q.queryByText('正在检查本地数据')).toBeNull();
  fireEvent.click(q.getByRole('button', { name: '我的回答库' }));
  const history = await q.findByLabelText('我的回答');
  expect((history as HTMLTextAreaElement).value).toBe('Synthetic historical answer');
  expect(history.matches(':disabled')).toBe(true);
  fireEvent.click(q.getByText('独立无参考编辑'));
  const input = q.getByLabelText('面试材料');
  fireEvent.change(input, { target: { value: 'Synthetic isolated unsaved input' } });
  await waitFor(() => expect(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(original));
  vi.stubGlobal('indexedDB', factory);
  fireEvent.click(q.getByText('重试恢复'));
  await waitFor(() => expect(q.queryByText('重试恢复')).toBeNull());
  expect((q.getByLabelText('面试材料') as HTMLTextAreaElement).value).toBe('Synthetic isolated unsaved input');
  expect(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(original);
  expect(await repo.exportSnapshot()).toEqual(before);
  fireEvent.change(input, { target: { value: '面试官：如何分析虚构产品？\n候选人：比较指标。' } });
  fireEvent.click(q.getByText('解析材料')); fireEvent.click(q.getByText('生成下次可用回答'));
  fireEvent.change(q.getByLabelText('下次可用回答'), { target: { value: 'Synthetic temporary answer' } });
  fireEvent.click(q.getByText('采用')); fireEvent.click(q.getByText('保存到我的回答库'));
  await q.findByText('保存失败，请重试');
  expect((q.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('Synthetic temporary answer');
  expect(await repo.exportSnapshot()).toEqual(before);
  expect(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(original);
});
it('actual App job navigation refuses to discard an unadopted answer', async () => {
  const session = { id: 'synthetic-session', jobFileId: job.id, source: 'externalImport' as const, interviewType: 'Synthetic', createdAt: '', rawConversation: '',
    questions: [{ id: 'q1', question: 'Synthetic question?', answer: '', followUps: [], feedback: '' }] };
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([job, { ...job, id: 'j2', company: 'Other synthetic company' }], [], job.id, '', [session]));
  const ui = await app(); fireEvent.click(ui.q.getByRole('button', { name: '目标岗位' }));
  fireEvent.click(ui.q.getByRole('tab', { name: '下次可用回答' }));
  fireEvent.change(ui.q.getByLabelText('下次可用回答'), { target: { value: 'Keep this unadopted answer' } });
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(ui.q.getByRole('button', { name: '我的回答库' }));
  expect((ui.q.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('Keep this unadopted answer');
  fireEvent.click(ui.q.getByRole('button', { name: /Other synthetic company Analyst/ }));
  expect(stored().selectedJobId).toBe(job.id);
  expect(stored().answerAssets).toEqual([]);
  expect(window.confirm).toHaveBeenCalledTimes(2);
});
it.each(['First current JD', 'Changed current JD', '', 'x'.repeat(2001)])('actual App current JD preview and payload agree (%#. synthetic case)', async jdText => {
  const sends: RewriteRequest[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url === '/api/ai/status') return new Response(JSON.stringify({ available: true }));
    const input = JSON.parse(options.body) as RewriteRequest; sends.push(input);
    return new Response(JSON.stringify({ questionId: input.questionId, generationId: input.generationId, answer: 'Synthetic answer',
      rewriteFocus: '', applicabilityBoundary: '', missingFacts: [], citations: [], model: 'synthetic', generatedAt: '2026-10-19T00:00:00.000Z' }));
  }));
  writePersonalWorkspace(localStorage, createPersonalWorkspaceData([{ ...job, jdText: 'Old input', profile: { ...job.profile!, responsibilities: ['STALE_PROFILE'] } }], [], job.id));
  const ui = await app();
  fireEvent.click(within(ui.q.getByRole('navigation')).getByRole('button', { name: '开始新面试' }));
  const input = await ui.q.findByLabelText('面试材料'); await waitFor(() => expect(input.matches(':disabled')).toBe(false));
  fireEvent.change(ui.q.getByLabelText('JD 或岗位信息'), { target: { value: jdText } });
  fireEvent.change(input, { target: { value: '面试官：如何分析虚构产品？\n候选人：比较指标。' } });
  fireEvent.click(ui.q.getByText('解析材料')); fireEvent.click(ui.q.getByText('生成下次可用回答'));
  const preview = ui.q.getByText('查看发送内容 · 0 个片段').parentElement!;
  expect(preview.textContent).not.toContain('STALE_PROFILE');
  if (jdText.length <= 2000 && jdText) expect(preview.textContent).toContain(jdText);
  await waitFor(() => expect(ui.q.getByText('生成当前回答').matches(':disabled')).toBe(false));
  fireEvent.click(ui.q.getByText('生成当前回答'));
  if (jdText.length > 2000) { await ui.q.findByText(/请求内容过长/); expect(sends).toEqual([]); return; }
  fireEvent.click(ui.q.getByText('确认发送'));
  await waitFor(() => expect(sends).toHaveLength(1));
  expect(sends[0].jobContext?.jdSummary).toBe(jdText || undefined);
  expect(sends[0].chunks).toEqual([]);
  expect(JSON.stringify(sends[0])).not.toContain('STALE_PROFILE');
});
