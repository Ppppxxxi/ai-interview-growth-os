// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import App from '../App';
import * as repositories from '../materials/repository';
import { getMaterialDraftQueue } from '../materials/draftQueue';
import { createEmptyPersonalWorkspaceData, readPersonalWorkspace, writePersonalWorkspace } from '../workflow/personalWorkspace';
import { parseInterviewMaterial } from '../agents/materialImportParser';
import { chunk, job, response } from '../llm/__tests__/fixtures';
import { prepareRewriteRequest } from '../llm/prepareRewriteRequest';
import { validateEvidence } from '../llm/validateEvidence';
import type { FocusFlowDraft } from '../domain/focusFlowDraft';
import type { RewriteRequest } from '../domain/llmContracts';

let rewrites = 0;
beforeEach(() => {
  localStorage.clear(); rewrites = 0; vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/ai/status') return Promise.resolve(new Response(JSON.stringify({ available: true })));
    rewrites++; throw new Error('Unexpected synthetic rewrite');
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function seed() {
  const workspace = createEmptyPersonalWorkspaceData(); writePersonalWorkspace(localStorage, workspace);
  const repository = repositories.createMaterialRepository();
  const doc = { id: chunk.documentId, kind: chunk.kind, title: chunk.title, tags: chunk.tags, text: chunk.text,
    sourceFormat: 'paste' as const, version: 1, createdAt: '2026-10-15', updatedAt: '2026-10-15' };
  await repository.saveDocument(doc, [], null); await repository.saveDocument(doc, [chunk], 1);
  const materialDraft = parseInterviewMaterial({ rawText: '面试官：如何评估？\n候选人：指标。', sourceType: 'auto' });
  const item = materialDraft.interviewItems[0]; const input = prepareRewriteRequest(item, job, [chunk], 'synthetic-recovery-id'); const output = response(input);
  Object.assign(item, { improvedAnswer: output.answer, evidence: validateEvidence(input, output),
    modelRationale: { rewriteFocus: output.rewriteFocus, applicabilityBoundary: output.applicabilityBoundary },
    generation: { provider: 'deepseek', model: output.model, generatedAt: output.generatedAt, generationId: output.generationId, origin: 'model' } });
  const draft: FocusFlowDraft = { id: `focus-flow:${workspace.selectedJobId}`, jobId: workspace.selectedJobId, kind: 'focus-flow', schemaVersion: 1,
    jobDraft: { company: '', roleTitle: '', direction: '', jdText: '' }, rawText: '虚构原文', materialDraft, stage: 'answers', activeItemId: item.id, updatedAt: '2026-10-15',
    work: { [item.id]: { revision: 1, selectedChunks: [{ chunkId: chunk.id, documentId: chunk.documentId, documentVersion: chunk.documentVersion }],
      provenance: { kind: 'model', revision: 1, request: input, response: output } } } };
  await repository.saveFlowDraft(draft);
  vi.spyOn(repositories, 'createMaterialRepository').mockReturnValue(repository);
  return { repository, draft, item };
}
function failChunksRead() {
  const original = IDBObjectStore.prototype.getAll;
  return vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
    if (this.name === 'chunks') throw new DOMException('Synthetic temporary failure', 'UnknownError');
    return original.apply(this, args);
  });
}
it('empty_library_read_failure_does_not_disable_real_app_input_or_manual_adoption_and_save', async () => {
  const repository = repositories.createMaterialRepository();
  vi.spyOn(repositories, 'createMaterialRepository').mockReturnValue(repository);
  failChunksRead(); render(<App />);
  await screen.findByText('资料加载失败');
  const input = screen.getByLabelText('面试材料');
  expect(input.matches(':disabled')).toBe(false);
  fireEvent.change(input, { target: { value: '面试官：如何评估虚构产品？\n候选人：观察指标。' } });
  const parse = screen.getByRole('button', { name: '解析材料' });
  expect(parse.matches(':disabled')).toBe(false); fireEvent.click(parse);
  fireEvent.click(screen.getByRole('button', { name: '生成下次可用回答' }));
  const answer = screen.getByLabelText('下次可用回答');
  expect(answer.matches(':disabled')).toBe(false);
  fireEvent.change(answer, { target: { value: '虚构手写回答：先定义指标，再比较实验结果。' } });
  fireEvent.click(await screen.findByRole('button', { name: /^采用$/ }));
  const save = screen.getByRole('button', { name: '保存到我的回答库' });
  expect(save.matches(':disabled')).toBe(false); fireEvent.click(save);
  await screen.findByRole('heading', { name: '下一场，更进一步' });
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  const workspace = readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData());
  expect(workspace.answerAssets).toHaveLength(1);
  expect(workspace.answerAssets[0].improvedAnswer).toContain('虚构手写回答');
  expect(workspace.answerAssets[0].modelRationale).toBeUndefined();
  expect(rewrites).toBe(0);
});
it('failed_library_allows_zero_reference_real_client_generation_but_requires_explicit_adoption', async () => {
  const repository = repositories.createMaterialRepository();
  vi.spyOn(repositories, 'createMaterialRepository').mockReturnValue(repository);
  const requests: RewriteRequest[] = [];
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    if (url === '/api/ai/status') return Promise.resolve(new Response(JSON.stringify({ available: true })));
    expect(url).toBe('/api/answers/rewrite');
    const input: RewriteRequest = JSON.parse(options.body); requests.push(input);
    return Promise.resolve(new Response(JSON.stringify({ ...response(input), citations: [] })));
  }));
  failChunksRead(); render(<App />); await screen.findByText('资料加载失败');
  const input = screen.getByLabelText('面试材料'); expect(input.matches(':disabled')).toBe(false);
  fireEvent.change(input, { target: { value: '面试官：如何评估虚构产品？\n候选人：观察指标。' } });
  fireEvent.click(screen.getByRole('button', { name: '解析材料' }));
  fireEvent.click(screen.getByRole('button', { name: '生成下次可用回答' }));
  const generate = screen.getByRole('button', { name: '生成当前回答' });
  await waitFor(() => expect(generate.matches(':disabled')).toBe(false)); fireEvent.click(generate);
  expect(requests).toHaveLength(0); fireEvent.click(screen.getByRole('button', { name: '确认发送' }));
  await screen.findByRole('button', { name: /^采用$/ }); expect(requests).toHaveLength(1); expect(requests[0].chunks).toEqual([]);
  expect(readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData()).answerAssets).toEqual([]);
  expect(screen.getByRole('button', { name: '保存到我的回答库' }).matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^采用$/ })); fireEvent.click(screen.getByRole('button', { name: '保存到我的回答库' }));
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  const assets = readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData()).answerAssets;
  expect(assets).toHaveLength(1); expect(assets[0].generation?.origin).toBe('model');
  expect(assets[0].reuseScope).toBe('Confirmed only'); expect(assets[0].evidence).toEqual([]);
});
it('a_separate_no_reference_interview_cannot_overwrite_the_protected_draft_even_after_retry_and_save', async () => {
  const { repository, draft } = await seed(); const failure = failChunksRead(); const writes = vi.spyOn(repository, 'saveFlowDraft'); render(<App />);
  await screen.findByText('资料加载失败'); await screen.findByText('未保存草稿');
  fireEvent.click(screen.getByRole('button', { name: '不使用资料继续' }));
  expect(screen.getByText('原草稿已保留')).toBeTruthy();
  const input = screen.getByLabelText('面试材料'); expect(input.matches(':disabled')).toBe(false);
  fireEvent.change(input, { target: { value: '面试官：如何设计虚构实验？\n候选人：分流比较。' } });
  fireEvent.click(screen.getByRole('button', { name: '解析材料' })); fireEvent.click(screen.getByRole('button', { name: '生成下次可用回答' }));
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '独立手写答案' } });
  failure.mockRestore(); fireEvent.click(screen.getByRole('button', { name: '重试资料' }));
  await waitFor(() => expect(screen.queryByText('资料加载失败')).toBeNull());
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('独立手写答案');
  fireEvent.click(screen.getByRole('button', { name: /^采用$/ })); fireEvent.click(screen.getByRole('button', { name: '保存到我的回答库' }));
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  expect(await repository.listFlowDrafts()).toEqual([draft]); expect(writes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '返回原草稿' })); await screen.findByText('未保存草稿');
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe(draft.materialDraft!.interviewItems[0].improvedAnswer);
  expect((screen.getByRole('checkbox', { name: /Synthetic project/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('button', { name: '保存到我的回答库' }).matches(':disabled')).toBe(true);
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  expect(writes.mock.calls.every(([entry]) => entry.rawText === draft.rawText)).toBe(true);
  expect(rewrites).toBe(0);
});
it('a_reference_free_draft_can_reopen_during_failure_and_partial_save_keeps_only_remaining_questions', async () => {
  const repository = repositories.createMaterialRepository(); vi.spyOn(repositories, 'createMaterialRepository').mockReturnValue(repository);
  failChunksRead(); const ui = render(<App />); await screen.findByText('资料加载失败');
  fireEvent.change(screen.getByLabelText('面试材料'), { target: { value: '面试官：如何分析虚构实验？\n候选人：比较指标。' } });
  fireEvent.click(screen.getByRole('button', { name: '解析材料' })); fireEvent.click(screen.getByRole('button', { name: '生成下次可用回答' }));
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '可恢复的无资料手写回答' } });
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  const before = (await repository.listFlowDrafts())[0]; const savedId = before.activeItemId;
  ui.unmount(); render(<App />);
  await screen.findByText('未保存草稿'); expect(screen.getByRole('button', { name: '保存到我的回答库' }).matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^采用$/ })); fireEvent.click(screen.getByRole('button', { name: '保存到我的回答库' }));
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  const remaining = (await repository.listFlowDrafts())[0];
  expect(remaining.materialDraft!.interviewItems.map(item => item.id)).toEqual(before.materialDraft!.interviewItems.filter(item => item.id !== savedId).map(item => item.id));
  expect(remaining.work[savedId]).toBeUndefined(); expect(rewrites).toBe(0);
});
it.each(['input', 'questions', 'answers'] as const)('explicit_return_locks_%s_until_deferred_real_draft_restore_finishes_during_material_failure', async stage => {
  const { repository, draft, item } = await seed();
  const realRead = repository.listFlowDrafts;
  const writes = vi.spyOn(repository, 'saveFlowDraft');
  const deletes = vi.spyOn(repository, 'deleteDraft');
  failChunksRead(); render(<App />);
  await screen.findByText('资料加载失败'); await screen.findByText('未保存草稿');
  fireEvent.click(screen.getByRole('button', { name: '不使用资料继续' }));
  const input = screen.getByLabelText('面试材料');
  expect(input.matches(':disabled')).toBe(false);
  fireEvent.change(input, { target: { value: '面试官：如何设计虚构实验？\n候选人：比较实验组。' } });
  if (stage !== 'input') fireEvent.click(screen.getByRole('button', { name: '解析材料' }));
  if (stage === 'answers') {
    fireEvent.click(screen.getByRole('button', { name: '生成下次可用回答' }));
    const answer = screen.getByLabelText('下次可用回答');
    expect(answer.matches(':disabled')).toBe(false);
    fireEvent.change(answer, { target: { value: '返回前主动放弃的独立回答' } });
  }
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const reading = new Promise<void>(resolve => { started = resolve; });
  vi.spyOn(repository, 'listFlowDrafts').mockImplementationOnce(async () => { started(); await gate; return realRead(); });
  try {
    fireEvent.click(screen.getByRole('button', { name: '返回原草稿' }));
    await act(async () => { await reading; });
    const editor = screen.getByLabelText(stage === 'input' ? '面试材料' : stage === 'questions' ? '识别到的问题' : '下次可用回答');
    expect(editor.matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '不使用资料继续' }).matches(':disabled')).toBe(true);
    // Do not synthesize changes on native-disabled controls.
    expect(await realRead()).toEqual([draft]);
    expect(writes).not.toHaveBeenCalled(); expect(deletes).not.toHaveBeenCalled();
    await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); });
    const restored = screen.getByLabelText('下次可用回答') as HTMLTextAreaElement;
    expect(restored.value).toBe(item.improvedAnswer);
    expect(restored.matches(':disabled')).toBe(false);
    expect(screen.getByRole('button', { name: '保存到我的回答库' }).matches(':disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /^采用$/ })).toBeNull();
    expect(readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData()).answerAssets).toEqual([]);
    fireEvent.change(restored, { target: { value: '恢复完成后明确手写的新回答' } });
    expect(restored.value).toBe('恢复完成后明确手写的新回答');
    await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
    expect(await realRead()).toEqual([draft]);
    expect(writes).not.toHaveBeenCalled(); expect(deletes).not.toHaveBeenCalled(); expect(rewrites).toBe(0);
  } finally { await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); }); }
});
it('typing_before_delayed_draft_read_finishes_keeps_the_old_referenced_draft_and_new_input_separate', async () => {
  const { repository, draft } = await seed(); const read = repository.listFlowDrafts;
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(repository, 'listFlowDrafts').mockImplementationOnce(async () => { await gate; return read(); });
  const writes = vi.spyOn(repository, 'saveFlowDraft'); failChunksRead(); render(<App />);
  try {
    await screen.findByText('资料加载失败'); const input = screen.getByLabelText('面试材料'); expect(input.matches(':disabled')).toBe(false);
    fireEvent.change(input, { target: { value: '虚构新输入，不应覆盖旧引用草稿' } });
    await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); });
    expect((screen.getByLabelText('面试材料') as HTMLTextAreaElement).value).toContain('虚构新输入');
    expect(screen.getByText('原草稿已保留')).toBeTruthy(); expect(await read()).toEqual([draft]); expect(writes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '返回原草稿' })); await screen.findByText('未保存草稿');
    await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
    expect(await read()).toEqual([draft]); expect(writes).not.toHaveBeenCalled(); expect(rewrites).toBe(0);
  } finally { await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); }); }
});
it('failed_material_read_preserves_the_entire_draft_until_a_real_retry_succeeds', async () => {
  const { repository, draft } = await seed(); const failure = failChunksRead(); const writes = vi.spyOn(repository, 'saveFlowDraft'); render(<App />);
  await screen.findByText('资料加载失败'); await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  expect(await repository.listFlowDrafts()).toEqual([draft]); expect(writes).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '采用' })).toBeNull(); expect(rewrites).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '重试资料' })); await screen.findByText('资料加载失败');
  expect(await repository.listFlowDrafts()).toEqual([draft]);
  failure.mockRestore(); fireEvent.click(screen.getByRole('button', { name: '重试资料' })); await screen.findByText('未保存草稿');
  await waitFor(() => expect((screen.getByRole('checkbox', { name: /Synthetic project/ }) as HTMLInputElement).checked).toBe(true));
  expect(screen.getByRole('button', { name: '采用' })).toBeTruthy();
  expect((screen.getByRole('button', { name: '保存到我的回答库' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { await getMaterialDraftQueue(repository).whenIdle(); });
  expect((await repository.listFlowDrafts())[0].work).toEqual(draft.work); expect(rewrites).toBe(0);
});
it('a_successful_empty_library_reconciles_only_after_the_failed_read_has_recovered', async () => {
  const { repository, draft, item } = await seed(); const failure = failChunksRead(); render(<App />);
  await screen.findByText('资料加载失败'); expect((await repository.listFlowDrafts())[0].work).toEqual(draft.work);
  failure.mockRestore(); await repository.deleteDocumentAndChunks(chunk.documentId);
  fireEvent.click(screen.getByRole('button', { name: '重试资料' })); await screen.findByText('未保存草稿');
  await waitFor(async () => expect((await repository.listFlowDrafts())[0].work[item.id]).toEqual({ revision: 2, selectedChunks: [] }));
  expect(screen.queryByRole('button', { name: '采用' })).toBeNull(); expect(screen.getByText(/待核对/)).toBeTruthy(); expect(rewrites).toBe(0);
});
async function delayedFirstWrite() {
  const repository = repositories.createMaterialRepository(); const actualSave = repository.saveFlowDraft;
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const startedPromise = new Promise<void>(resolve => { started = resolve; });
  vi.spyOn(repository, 'saveFlowDraft').mockImplementation(async draft => { started(); await gate; await actualSave(draft); });
  vi.spyOn(repositories, 'createMaterialRepository').mockReturnValue(repository);
  const ui = render(<App />);
  await waitFor(() => expect((document.querySelector('.focus-flow-content') as HTMLFieldSetElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('面试材料'), { target: { value: '虚构首次未保存输入' } }); await startedPromise;
  return { repository, release, ui };
}
it('first_write_finishing_after_real_app_navigation_preserves_identity_and_restores_without_rewrite', async () => {
  const { repository, release, ui } = await delayedFirstWrite();
  try {
    fireEvent.click(screen.getByRole('button', { name: /^工作台$/ })); expect(document.querySelector('.focus-flow-content')).toBeNull();
    await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); });
    const jobId = (await repository.listFlowDrafts())[0].jobId;
    expect(readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData()).selectedJobId).toBe(jobId);
    ui.unmount(); vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10000); render(<App />); await screen.findByText('未保存草稿');
    expect((screen.getByLabelText('面试材料') as HTMLTextAreaElement).value).toBe('虚构首次未保存输入'); expect(rewrites).toBe(0);
  } finally { await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); }); }
});
it('late_old_app_write_cannot_replace_a_new_users_workspace', async () => {
  const { repository, release, ui } = await delayedFirstWrite();
  try {
    ui.unmount();
    const newer = createEmptyPersonalWorkspaceData('2026-10-16T00:00:00Z'); newer.jobFiles[0].company = '虚构最新用户数据'; writePersonalWorkspace(localStorage, newer);
    await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); });
    expect(readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData())).toEqual(newer);
    expect(await repository.listFlowDrafts()).toHaveLength(1); expect(rewrites).toBe(0);
  } finally { await act(async () => { release(); await getMaterialDraftQueue(repository).whenIdle(); }); }
});
