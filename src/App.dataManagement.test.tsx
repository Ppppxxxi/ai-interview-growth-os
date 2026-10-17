// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { mockBrowserLocks } from './materials/__tests__/browserLocks';
import { createMaterialRepository } from './materials/repository';
import { createEmptyPersonalWorkspaceData, PERSONAL_WORKSPACE_STORAGE_KEY, readPersonalWorkspace } from './workflow/personalWorkspace';
import { response } from './llm/__tests__/fixtures';
import type { RewriteRequest } from './domain/llmContracts';
import { clearAllUserData } from './materials/workspaceDataCoordinator';

beforeEach(() => {
  mockBrowserLocks(); vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false }))));
});
afterEach(async () => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
async function manual() {
  render(<App />); const input = await screen.findByLabelText('面试材料');
  await waitFor(() => expect(input.matches(':disabled')).toBe(false));
  fireEvent.change(input, { target: { value: '面试官：如何分析虚构产品？\n候选人：比较指标。' } });
  fireEvent.click(screen.getByText('解析材料')); fireEvent.click(screen.getByText('生成下次可用回答'));
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '用户手写的待保存回答' } });
  fireEvent.click(screen.getByText('采用'));
}
it('direct_coordinator_refuses_unconfigured_browser_without_web_locks', async () => {
  vi.stubGlobal('navigator', {});
  const write = vi.fn(async () => {});
  await expect(clearAllUserData(createMaterialRepository(), { read: createEmptyPersonalWorkspaceData, write })).rejects.toThrow('不支持');
  expect(write).not.toHaveBeenCalled();
});
it.each(['quota', 'unavailable'])('actual_%s_failure_keeps_answer_unsaved_and_retryable', async failure => {
  const storage = localStorage; await manual();
  const original = Storage.prototype.setItem;
  const problem = failure === 'quota' ? vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === PERSONAL_WORKSPACE_STORAGE_KEY) throw new DOMException('Synthetic quota', 'QuotaExceededError');
    original.call(this, key, value);
  }) : vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Synthetic unavailable', 'SecurityError'); });
  fireEvent.click(screen.getByText('保存到我的回答库'));
  await screen.findByText('保存失败，当前修改尚未保存，请重试');
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('用户手写的待保存回答');
  expect(readPersonalWorkspace(storage, createEmptyPersonalWorkspaceData()).answerAssets).toEqual([]);
  expect(screen.queryByText('已保存')).toBeNull();
  problem.mockRestore(); fireEvent.click(screen.getByText('保存到我的回答库'));
  await waitFor(() => expect(readPersonalWorkspace(storage, createEmptyPersonalWorkspaceData()).answerAssets).toHaveLength(1));
});
it('clear_invalidates_generation_and_keeps_navigation_after_both_stores_are_empty', async () => {
  let input!: RewriteRequest; let signal!: AbortSignal; let resolve!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    if (url === '/api/ai/status') return Promise.resolve(new Response(JSON.stringify({ available: true })));
    input = JSON.parse(options.body); signal = options.signal;
    return new Promise<Response>(done => { resolve = done; });
  }));
  render(<App />); const text = await screen.findByLabelText('面试材料');
  await waitFor(() => expect(text.matches(':disabled')).toBe(false));
  fireEvent.change(text, { target: { value: '面试官：如何分析虚构产品？\n候选人：比较指标。' } });
  fireEvent.click(screen.getByText('解析材料')); fireEvent.click(screen.getByText('生成下次可用回答'));
  await waitFor(() => expect(screen.getByText('生成当前回答').matches(':disabled')).toBe(false));
  fireEvent.click(screen.getByText('生成当前回答')); fireEvent.click(screen.getByText('确认发送'));
  await waitFor(() => expect(resolve).toBeTypeOf('function'));
  fireEvent.click(screen.getByText('清空本地数据'));
  await waitFor(() => expect(signal.aborted).toBe(true));
  await screen.findByLabelText('面试材料');
  await act(async () => resolve(new Response(JSON.stringify({ ...response(input), citations: [] }))));
  const repo = createMaterialRepository();
  await waitFor(async () => expect(await repo.exportSnapshot()).toEqual({ documents: [], chunks: [], drafts: [] }));
  expect(readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData()).answerAssets).toEqual([]);
  expect(screen.getByRole('navigation', { name: '主导航' })).toBeTruthy();
});
it('restore_example_keeps_materials', async () => {
  const repo = createMaterialRepository();
  await repo.saveDocument({ id: 'synthetic-note', kind: 'knowledge', title: 'Synthetic note', text: 'Keep local source', tags: [], sourceFormat: 'paste', version: 1, createdAt: '', updatedAt: '' }, [], null);
  await repo.saveDraft({ id: 'synthetic-import', kind: 'knowledge', title: 'Unconfirmed', text: 'Keep edited text', tags: [], sourceFormat: 'paste', selectedChunks: [], updatedAt: '' });
  const original = await repo.exportSnapshot(); render(<App />); await screen.findByLabelText('面试材料');
  fireEvent.click(screen.getByText('恢复示例'));
  await waitFor(() => expect(readPersonalWorkspace(localStorage, createEmptyPersonalWorkspaceData()).answerAssets.length).toBeGreaterThan(0));
  expect(await repo.exportSnapshot()).toEqual(original);
  expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('我的资料与资料草稿保留');
});
