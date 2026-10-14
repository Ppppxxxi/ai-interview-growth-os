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
