// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { mockBrowserLocks } from './materials/__tests__/browserLocks';
import { createMaterialRepository } from './materials/repository';
import { createPersonalWorkspaceData, PERSONAL_WORKSPACE_STORAGE_KEY, writePersonalWorkspace } from './workflow/personalWorkspace';
import { answerAssets } from './domain/sampleData';
import { job } from './llm/__tests__/fixtures';
import type { InterviewSession } from './domain/types';

const session: InterviewSession = { id: 'export-session', jobFileId: job.id, source: 'externalImport', interviewType: 'Synthetic', createdAt: '', rawConversation: '',
  questions: [{ id: 'q1', question: 'Synthetic question?', answer: 'Original answer', feedback: '', followUps: [] }] };
let createURL: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockBrowserLocks(); vi.stubGlobal('indexedDB', new IDBFactory()); localStorage.clear();
  createURL = vi.fn(() => 'blob:synthetic-export');
  vi.stubGlobal('URL', class extends URL { static createObjectURL = createURL; static revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: false }))));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it.each((['job', 'asset', 'material'] as const).flatMap(view => (['success', 'validation-error', 'download-error'] as const).map(result => ({ view, result }))))(
  'actual App export preserves $view edits ($result)', async ({ view, result }) => {
    const repo = createMaterialRepository();
    await repo.saveDocument({ id: 'export-source', title: 'Synthetic source', text: 'Stored material', kind: 'knowledge', sourceFormat: 'paste', tags: [], version: 1, createdAt: '', updatedAt: '' }, [], null);
    if (result === 'validation-error') await repo.saveDocument({ id: 'oversized-source', title: 'x'.repeat(501), text: 'Synthetic invalid stored record', kind: 'experience', sourceFormat: 'paste', tags: [], version: 1, createdAt: '', updatedAt: '' }, [], null);
    if (result === 'download-error') createURL.mockImplementation(() => { throw new Error('Synthetic download unavailable'); });
    const asset = { ...structuredClone(answerAssets[0]), id: 'export-asset', sourceQuestionId: 'q1', sourceJobId: job.id, sourceInterviewId: session.id, originalQuestion: session.questions[0].question, improvedAnswer: 'Stored answer' };
    writePersonalWorkspace(localStorage, createPersonalWorkspaceData([job], [asset], job.id, '', [session], []));
    render(<App />); await screen.findByRole('heading', { name: '工作台' });
    const nav = screen.getByRole('navigation', { name: '主导航' });
    if (view === 'job') {
      fireEvent.click(within(nav).getByRole('button', { name: '目标岗位' }));
      fireEvent.click(await screen.findByRole('tab', { name: '下次可用回答' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: view === 'asset' ? '我的回答库' : '我的资料' }));
      if (view === 'material') {
        fireEvent.click(await screen.findByRole('tab', { name: '知识笔记' }));
        fireEvent.click(await screen.findByText('Synthetic source', { exact: true }));
        fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
      }
    }
    const label = view === 'job' ? '下次可用回答' : view === 'asset' ? '我的回答' : '正文';
    const editor = await screen.findByLabelText(label);
    fireEvent.change(editor, { target: { value: `UNSAVED ${view} handwritten text` } });
    if (view === 'asset') fireEvent.change(screen.getByLabelText('版本说明'), { target: { value: 'UNSAVED version note' } });
    if (view === 'material') await waitFor(async () => expect((await repo.listDrafts())[0]?.text).toBe('UNSAVED material handwritten text'));
    const workspaceBefore = localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY);
    await act(async () => { fireEvent.click(screen.getByText('数据管理')); });
    fireEvent.click(screen.getByRole('button', { name: '导出备份' }));
    if (result === 'success') await waitFor(() => expect(createURL).toHaveBeenCalledTimes(1));
    else await screen.findByText(/数据操作未完成|导出备份失败/);
    await waitFor(() => expect(screen.queryByText('正在检查本地数据')).toBeNull());
    expect(screen.getByLabelText(label)).toBe(editor);
    expect((editor as HTMLTextAreaElement).value).toBe(`UNSAVED ${view} handwritten text`);
    if (view === 'asset') expect((screen.getByLabelText('版本说明') as HTMLInputElement).value).toBe('UNSAVED version note');
    expect(localStorage.getItem(PERSONAL_WORKSPACE_STORAGE_KEY)).toBe(workspaceBefore);
    if (result === 'validation-error') expect(createURL).not.toHaveBeenCalled();
  },
);
