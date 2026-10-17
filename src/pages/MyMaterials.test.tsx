// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMaterialRepository } from '../materials/repository';
import { MyMaterials } from './MyMaterials';
import App from '../App';
import { mockBrowserLocks } from '../materials/__tests__/browserLocks';
import { chunkDocument } from '../materials/chunkDocument';
import type { MaterialDocument } from '../domain/materialTypes';
import { File as NodeFile } from 'node:buffer';

beforeEach(() => { mockBrowserLocks(); vi.stubGlobal('indexedDB', new IDBFactory()); window.history.replaceState({}, '', '/'); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
const repository = () => createMaterialRepository(new IDBFactory());
async function add() {
  await screen.findByText('暂无资料');
  fireEvent.click(screen.getByRole('button', { name: '添加资料' }));
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '虚构项目' } });
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: '虚构 React 项目，用户研究。' } });
}
function confirm() { fireEvent.click(screen.getByLabelText('确认正文')); }
async function saved() {
  await screen.findByRole('button', { name: '编辑资料' });
  await waitFor(() => expect((screen.getByRole('button', { name: '编辑资料' }) as HTMLButtonElement).disabled).toBe(false));
}
async function seedPdf(repo: ReturnType<typeof repository>) {
  const document: MaterialDocument = { id: 'fixture-pdf', title: '虚构 PDF', text: '虚构第一页\n\n虚构第二页',
    kind: 'experience', tags: [], sourceFormat: 'pdf', version: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  await repo.saveDocument(document, chunkDocument(document, [{ pageNumber: 1, text: '虚构第一页' }, { pageNumber: 2, text: '虚构第二页' }]), null);
  return document;
}

async function remountDuringDraftWrite() {
  const repo = repository();
  const base = { id: 'remount-fixture', kind: 'experience' as const, title: '虚构跨挂载草稿',
    text: 'Base text', tags: [], sourceFormat: 'paste' as const, selectedChunks: [], updatedAt: '2026-01-01' };
  await repo.saveDraft(base);
  const realSave = repo.saveDraft;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const writes = vi.spyOn(repo, 'saveDraft').mockImplementation(async draft => {
    if (draft.text === 'Old delayed text') await barrier;
    await realSave(draft);
  });
  const first = render(<MyMaterials repository={repo} />);
  fireEvent.click(await screen.findByRole('button', { name: '未保存草稿 · 虚构跨挂载草稿' }));
  await screen.findByLabelText('正文');
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'Old delayed text' } });
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'Old queued text' } });
  first.unmount();
  const reads = vi.spyOn(repo, 'listDrafts');
  try {
    await act(async () => { render(<MyMaterials repository={repo} />); });
    expect(reads).not.toHaveBeenCalled();
  } finally {
    await act(async () => { release(); });
  }
  fireEvent.click(await screen.findByRole('button', { name: '未保存草稿 · 虚构跨挂载草稿' }));
  await screen.findByLabelText('正文');
  expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('Old queued text');
  expect((screen.getByLabelText('确认正文') as HTMLInputElement).checked).toBe(false);
  fireEvent.change(screen.getByLabelText('正文'), { target: { value: 'New current text' } });
  return { repo, writes };
}

describe('MyMaterials', () => {
  it('starts_empty_without_required_setup', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />);
    await screen.findByText('暂无资料');
    await act(async () => { expect(await repo.listDocuments()).toEqual([]); });
    expect(screen.getByRole('tab', { name: '我的经历' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '知识笔记' })).toBeTruthy();
  });
  it('requires_confirmation_before_save_and_does_not_auto_select_tags', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />); await add();
    expect((screen.getByRole('button', { name: '保存资料' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('React') as HTMLInputElement).checked).toBe(false);
    await act(async () => { expect(await repo.listDocuments()).toEqual([]); });
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await saved();
    expect((await repo.listDocuments())[0].tags).toEqual([]);
  });
  it('keeps_editor_after_save_failure', async () => {
    const repo = repository(); vi.spyOn(repo, 'saveDocument').mockRejectedValue(new Error('QUOTA_EXCEEDED'));
    render(<MyMaterials repository={repo} />); await add(); confirm();
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await screen.findByText('保存失败，请重试');
    expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toContain('虚构 React');
    expect(await repo.listDocuments()).toEqual([]);
  });
  it('labels_restored_draft_without_confirming_content', async () => {
    const repo = repository(); const view = render(<MyMaterials repository={repo} />); await add();
    await waitFor(async () => expect((await repo.listDrafts()).length).toBe(1));
    view.unmount(); render(<MyMaterials repository={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: /未保存草稿/ }));
    expect(await screen.findByText('未保存草稿', { selector: 'strong' })).toBeTruthy();
    expect((screen.getByLabelText('确认正文') as HTMLInputElement).checked).toBe(false);
  });
  it('does_not_execute_imported_html', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />); await add();
    const text = '<img src="https://example.invalid/x" onerror="window.fixtureExecuted=true"><script>alert(1)</script>';
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: text } }); confirm();
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await saved();
    expect((await repo.listDocuments())[0].text).toBe(text);
    expect(document.querySelector('img, script')).toBeNull();
  });
  it('guards_category_switch_and_disables_uncoordinated_delete', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />); await add();
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('tab', { name: '知识笔记' }));
    expect(ask).toHaveBeenCalled(); expect(screen.getByLabelText('正文')).toBeTruthy();
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await saved();
    await waitFor(() => expect((screen.getByRole('button', { name: '删除资料' }) as HTMLButtonElement).disabled).toBe(true));
  });
  it('retries_load_failure_without_memory_fallback', async () => {
    const repo = repository(); vi.spyOn(repo, 'listDocuments').mockRejectedValueOnce(new Error('unavailable'));
    render(<MyMaterials repository={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: '重试加载' }));
    await screen.findByText('暂无资料');
  });
  it('guards_app_navigation_and_keeps_empty_workspace_unwritten', async () => {
    localStorage.clear(); render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '我的资料' })); await add();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: '工作台' }));
    expect(screen.getByLabelText('正文')).toBeTruthy();
    expect(localStorage.length).toBe(0);
  });
  it('reopens_pdf_and_saves_matching_new_version_with_real_locators', async () => {
    const repo = repository(); await seedPdf(repo); render(<MyMaterials repository={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: /虚构 PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '虚构 PDF 新标题' } });
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' })); await saved();
    expect((await repo.listDocuments())[0].version).toBe(2);
    expect((await repo.listChunks()).map(chunk => [chunk.id, chunk.documentVersion, chunk.locator])).toEqual([
      ['fixture-pdf:2:0', 2, { type: 'page', pageNumber: 1, paragraphIndex: 0 }],
      ['fixture-pdf:2:1', 2, { type: 'page', pageNumber: 2, paragraphIndex: 0 }],
    ]);
  });
  it('invalidates_pdf_locators_after_any_text_edit_even_if_reverted', async () => {
    const repo = repository(); const document = await seedPdf(repo); render(<MyMaterials repository={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: /虚构 PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: document.text + '修改' } });
    confirm();
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: document.text } });
    expect((screen.getByLabelText('确认正文') as HTMLInputElement).checked).toBe(false);
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' })); await saved();
    expect((await repo.listChunks()).every(chunk => chunk.locator.type === 'paragraph')).toBe(true);
  });
  it('preserves_editor_on_version_conflict', async () => {
    const repo = repository(); const document = await seedPdf(repo); render(<MyMaterials repository={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: /虚构 PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: '编辑资料' }));
    await act(async () => { await repo.saveDocument({ ...document, version: 2 }, chunkDocument({ ...document, version: 2 }), 1); });
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await screen.findByText('保存失败，请重试'); expect(screen.getByLabelText('正文')).toBeTruthy();
    expect((await repo.listDocuments())[0].version).toBe(2);
  });
  it('rejects_tags_beyond_schema_limits', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />); await add();
    fireEvent.change(screen.getByLabelText('自定义标签'), { target: { value: 'x'.repeat(101) } }); confirm();
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await screen.findByText('内容超出上限或为空，请调整');
    await act(async () => { expect(await repo.listDocuments()).toEqual([]); });
  });
  it('lets_users_type_comma_separated_custom_tags', async () => {
    render(<MyMaterials repository={repository()} />); await add();
    fireEvent.change(screen.getByLabelText('自定义标签'), { target: { value: '虚构标签,' } });
    expect((screen.getByLabelText('自定义标签') as HTMLInputElement).value).toBe('虚构标签,');
  });
  it('preview_materials_do_not_read_or_write_original_workspace', async () => {
    const original = createMaterialRepository(); await seedPdf(original);
    localStorage.setItem('fixture-workspace', 'do-not-change');
    window.history.replaceState({}, '', '/?preview=workspace'); render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '我的资料' })); await add(); confirm();
    fireEvent.click(screen.getByRole('button', { name: '保存资料' })); await saved();
    expect((await original.listDocuments()).map(document => document.id)).toEqual(['fixture-pdf']);
    expect((await original.listChunks())[0].documentVersion).toBe(1);
    expect(localStorage.getItem('fixture-workspace')).toBe('do-not-change');
    expect(localStorage.length).toBe(1);
  });
  it('guards_material_switch_and_reports_draft_write_failure', async () => {
    const repo = repository(); await seedPdf(repo);
    vi.spyOn(repo, 'saveDraft').mockRejectedValue(new Error('quota'));
    render(<MyMaterials repository={repo} />);
    await screen.findByRole('button', { name: /虚构 PDF/ }); fireEvent.click(screen.getByRole('button', { name: '添加资料' }));
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: '虚构未保存内容' } });
    await screen.findByText('草稿保存失败，请重试');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: /虚构 PDF/ }));
    expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe('虚构未保存内容');
    expect((await repo.listDocuments()).length).toBe(1);
  });
  it('rejects_oversize_pasted_text_without_truncating_or_saving', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />); await add();
    const text = 'x'.repeat(50_001);
    fireEvent.change(screen.getByLabelText('正文'), { target: { value: text } }); confirm();
    fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
    await screen.findByText('内容超出上限或为空，请调整');
    expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe(text);
    await act(async () => { expect(await repo.listDocuments()).toEqual([]); });
  });
  it('delegates_delete_and_never_claims_success_on_failure', async () => {
    const repo = repository(); await seedPdf(repo);
    render(<MyMaterials repository={repo} onDeleteMaterial={async () => { throw new Error('coordinator'); }} />);
    fireEvent.click(await screen.findByRole('button', { name: /虚构 PDF/ }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '删除资料' }));
    await screen.findByText('删除失败，请重试');
    await act(async () => { expect((await repo.listDocuments()).length).toBe(1); });
  });
  it('imports_real_markdown_with_format_and_requires_fresh_confirmation', async () => {
    const repo = repository(); render(<MyMaterials repository={repo} />); await add(); confirm();
    const text = '<script>window.fixtureExecuted=true</script>\n\n虚构知识 React';
    fireEvent.change(screen.getByLabelText('导入文件'), { target: { files: [new NodeFile([text], 'fixture.md')] } });
    await waitFor(() => expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe(text));
    expect((screen.getByLabelText('确认正文') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('React') as HTMLInputElement).checked).toBe(false);
    expect(document.querySelector('script')).toBeNull();
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' })); await saved();
    expect((await repo.listDocuments())[0]).toMatchObject({ sourceFormat: 'markdown', sourceFileName: 'fixture.md', text, version: 1 });
  });
  it('waits_for_pending_draft_writes_when_switching_categories', async () => {
    const repo = repository(); const realSave = repo.saveDraft;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(repo, 'saveDraft').mockImplementation(async draft => { await pending; await realSave(draft); });
    render(<MyMaterials repository={repo} />); await add();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('tab', { name: '知识笔记' }));
    fireEvent.click(screen.getByRole('tab', { name: '我的经历' }));
    await act(async () => { await repo.listDrafts(); release(); });
    fireEvent.click(await screen.findByRole('button', { name: '未保存草稿 · 虚构项目' }));
    await screen.findByLabelText('正文');
    expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toContain('虚构 React');
  });
  it('orders_old_and_new_mount_draft_writes_without_dropping_edited_text', async () => {
    const { repo, writes } = await remountDuringDraftWrite();
    await waitFor(async () => expect((await repo.listDrafts())[0].text).toBe('New current text'));
    expect(writes.mock.calls.map(([draft]) => draft.text)).toEqual(['Old delayed text', 'Old queued text', 'New current text']);
  });
  it('does_not_resurrect_drafts_after_save_across_mounts', async () => {
    const { repo } = await remountDuringDraftWrite();
    confirm(); fireEvent.click(screen.getByRole('button', { name: '保存资料' })); await saved();
    expect((await repo.listDocuments())[0].text).toBe('New current text');
    expect(await repo.listDrafts()).toEqual([]);
    cleanup(); render(<MyMaterials repository={repo} />);
    await screen.findByRole('button', { name: /虚构跨挂载草稿/ });
    expect(screen.queryByRole('button', { name: /未保存草稿/ })).toBeNull();
  });
});
