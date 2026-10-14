// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FocusFlowPage } from './FocusFlowPage';
import { chunk, job, response } from '../llm/__tests__/fixtures';
import type { RewriteRequest } from '../domain/llmContracts';
import { parseInterviewMaterial } from '../agents/materialImportParser';
import { MaterialReferencePicker } from '../components/materials/MaterialReferencePicker';

const calls: { input: RewriteRequest; resolve: (value: Response) => void; signal?: AbortSignal }[] = [];
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    if (url === '/api/ai/status') return Promise.resolve(new Response(JSON.stringify({ available: true })));
    return new Promise<Response>(resolve => calls.push({ input: JSON.parse(options.body), resolve, signal: options.signal }));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() {
  const save = vi.fn();
  const ui = render(<FocusFlowPage selectedJobId={job.id} jobFiles={[job]} materialChunks={[chunk]}
    onUpdateJob={vi.fn()} onSaveAsset={save} onSaveInterviewRecord={vi.fn()} onFinish={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('面试材料'), { target: { value: '面试官：如何评估产品效果？\n候选人：分析指标。\n面试官：如何设计实验？\n候选人：分流测试。' } });
  fireEvent.click(screen.getByText('解析材料'));
  fireEvent.click(screen.getByText('生成下次可用回答'));
  return { ...ui, save };
}
async function generate() {
  fireEvent.click(screen.getByText('生成当前回答'));
  if (screen.queryByText('确认发送')) fireEvent.click(screen.getByText('确认发送'));
  await waitFor(() => expect(calls.length).toBeGreaterThan(0));
}
async function finish(index = 0) {
  const input = calls[index].input;
  await act(async () => calls[index].resolve(new Response(JSON.stringify({ ...response(input), citations: input.chunks.length ? response(input).citations : [] }))));
  await waitFor(() => expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('I measured the result.'));
}
it('does_not_autoselect_references', () => {
  setup();
  expect(screen.getByText('参考资料 · 已选 0 / 6')).toBeTruthy();
  expect((screen.getByRole('checkbox', { name: /Synthetic project/ }) as HTMLInputElement).checked).toBe(false);
  expect(screen.queryByRole('button', { name: '采用' })).toBeNull();
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('');
});
it('requires_first_send_confirmation', async () => {
  setup(); fireEvent.click(screen.getByText('生成当前回答'));
  expect(calls).toHaveLength(0);
  expect(screen.getByRole('dialog').textContent).toContain('DeepSeek');
  fireEvent.click(screen.getByText('确认发送')); await finish();
  fireEvent.click(screen.getByText('生成当前回答'));
  await waitFor(() => expect(calls).toHaveLength(2));
});
it('generates_only_current_question', async () => {
  setup(); await generate();
  expect(calls).toHaveLength(1); expect(calls[0].input.chunks).toEqual([]);
  expect(calls[0].input.question).not.toContain('如何设计实验');
  await finish();
  expect(screen.getAllByRole('button', { pressed: false }).some(button => button.textContent?.includes('实验'))).toBe(true);
});
it('cannot_save_model_suggestion_before_acceptance', async () => {
  const { save } = setup();
  fireEvent.click(screen.getByRole('checkbox', { name: /Synthetic project/ }));
  await generate(); await finish();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ generation: { generationId: calls[0].input.generationId }, evidence: [{ status: 'validated', chunkId: 'c1' }] });
});
it('ignores_response_after_edit_or_navigation', async () => {
  const ui = setup(); await generate();
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '我的手写答案' } });
  await act(async () => calls[0].resolve(new Response(JSON.stringify({ ...response(calls[0].input), citations: [] }))));
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('我的手写答案');
  fireEvent.click(screen.getByText('生成当前回答')); await waitFor(() => expect(calls).toHaveLength(2));
  ui.unmount(); expect(calls[1].signal?.aborted).toBe(true);
});
it('failed_generation_keeps_accepted_answer', async () => {
  const { save } = setup(); await generate(); await finish(); fireEvent.click(screen.getByText('采用'));
  fireEvent.click(screen.getByText('生成当前回答'));
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => calls[1].resolve(new Response('<html>limited</html>', { status: 429 })));
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('I measured the result.');
  fireEvent.click(screen.getByText('保存到我的回答库')); expect(save).toHaveBeenCalledTimes(1);
});
it('local_parser_keeps_suggestions_but_never_a_model_answer', () => {
  const draft = parseInterviewMaterial({ rawText: '面试官：如何评估指标？\n候选人：看实验结果。', sourceType: 'auto' });
  expect(draft.interviewItems.length).toBeGreaterThan(0);
  expect(draft.interviewItems.every(item => !item.improvedAnswer && !item.generation)).toBe(true);
  expect(draft.interviewItems[0].improvementSuggestion).toBeTruthy();
});
it('ignores_response_after_question_switch_and_uses_empty_selection_for_new_question', async () => {
  setup(); fireEvent.click(screen.getByRole('checkbox', { name: /Synthetic project/ })); await generate();
  fireEvent.click(screen.getAllByRole('button', { pressed: false }).find(button => button.textContent?.includes('02'))!);
  expect(calls[0].signal?.aborted).toBe(true);
  expect(screen.getByText('参考资料 · 已选 0 / 6')).toBeTruthy();
  await act(async () => calls[0].resolve(new Response(JSON.stringify(response(calls[0].input)))));
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('');
});
it('older_question_edit_invalidates_its_own_result_and_requires_new_confirmation', async () => {
  const { save } = setup(); await generate(); await finish(); fireEvent.click(screen.getByText('采用'));
  fireEvent.click(screen.getAllByRole('button', { pressed: false }).find(button => button.textContent?.includes('02'))!);
  fireEvent.click(screen.getByText('生成当前回答')); await waitFor(() => expect(calls).toHaveLength(2)); await finish(1);
  fireEvent.click(screen.getAllByRole('button', { pressed: false }).find(button => button.textContent?.includes('01'))!);
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '用户修订后的答案' } });
  expect((screen.getByText('保存到我的回答库') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByText('修改后采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save.mock.calls[0][0].improvedAnswer).toBe('用户修订后的答案');
  expect(save.mock.calls[0][0].generation.generationId).toBe(calls[0].input.generationId);
});
it('manual_edits_preserve_quotes_as_needs_review_and_remove_acceptance', async () => {
  const { save } = setup(); fireEvent.click(screen.getByRole('checkbox', { name: /Synthetic project/ })); await generate(); await finish(); fireEvent.click(screen.getByText('采用'));
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '我补充了真实职责。' } });
  expect(screen.getByText(/待核对/)).toBeTruthy();
  fireEvent.click(screen.getByText('保存到我的回答库')); expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('修改后采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save.mock.calls[0][0].evidence[0]).toMatchObject({ quote: chunk.text, status: 'needs-review' });
});
it('preparation_errors_are_visible_and_do_not_truncate_or_send', () => {
  setup(); fireEvent.change(screen.getByLabelText('识别到的问题'), { target: { value: '问'.repeat(9000) } });
  fireEvent.click(screen.getByText('生成当前回答'));
  expect(screen.getByRole('alert').textContent).toContain('超限'); expect(calls).toHaveLength(0);
  expect((screen.getByLabelText('识别到的问题') as HTMLTextAreaElement).value.length).toBe(9000);
});
it('picker_limits_selection_to_six', () => {
  const chunks = Array.from({ length: 7 }, (_, index) => ({ ...chunk, id: String(index), title: `虚构${index}` }));
  render(<MaterialReferencePicker chunks={chunks} query="" selectedChunkIds={chunks.slice(0, 6).map(chunk => chunk.id)} onChange={vi.fn()} />);
  expect((screen.getByRole('checkbox', { name: /虚构6/ }) as HTMLInputElement).disabled).toBe(true);
});
it('unavailable_service_allows_manual_answer_without_network_generation', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ available: false })))));
  const { save } = setup(); await screen.findByText('生成暂不可用，可手写回答');
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '虚构手写答案' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save.mock.calls[0][0].improvedAnswer).toBe('虚构手写答案'); expect(calls).toHaveLength(0);
});
it('low_confidence_question_can_be_manually_confirmed_and_saved', () => {
  const save = vi.fn();
  render(<FocusFlowPage selectedJobId={job.id} jobFiles={[job]} materialChunks={[]} onUpdateJob={vi.fn()} onSaveAsset={save} onSaveInterviewRecord={vi.fn()} onFinish={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('面试材料'), { target: { value: '一段虚构的无关键词待确认材料' } });
  fireEvent.click(screen.getByText('解析材料')); fireEvent.click(screen.getByText('生成下次可用回答'));
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '我核对后手写的回答。' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save.mock.calls[0][0].improvedAnswer).toBe('我核对后手写的回答。');
});
it('starts_with_the_question_selected_during_recognition', async () => {
  render(<FocusFlowPage selectedJobId={job.id} jobFiles={[job]} materialChunks={[chunk]} onUpdateJob={vi.fn()} onSaveAsset={vi.fn()} onSaveInterviewRecord={vi.fn()} onFinish={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('面试材料'), { target: { value: '面试官：如何评估效果？\n候选人：看数据。\n面试官：如何协作？\n候选人：记录。' } });
  fireEvent.click(screen.getByText('解析材料'));
  fireEvent.click(screen.getAllByRole('button', { pressed: false }).find(button => button.textContent?.includes('02'))!);
  fireEvent.click(screen.getByText('生成下次可用回答')); await generate();
  expect(calls[0].input.question).toBe('如何协作？');
});
it('material_refresh_cancels_and_invalidates_accepted_evidence', async () => {
  const ui = setup(); fireEvent.click(screen.getByRole('checkbox', { name: /Synthetic project/ })); await generate(); await finish(); fireEvent.click(screen.getByText('采用'));
  ui.rerender(<FocusFlowPage selectedJobId={job.id} jobFiles={[job]} materialChunks={[{ ...chunk, text: '虚构更新内容', documentVersion: 3 }]} onUpdateJob={vi.fn()} onSaveAsset={ui.save} onSaveInterviewRecord={vi.fn()} onFinish={vi.fn()} />);
  expect(screen.getByText(/待核对/)).toBeTruthy();
  fireEvent.click(screen.getByText('保存到我的回答库')); expect(ui.save).not.toHaveBeenCalled();
});
it('one_flight_and_cancel_allow_retry_without_late_overwrite', async () => {
  setup(); await generate();
  fireEvent.click(screen.getByText('生成中')); expect(calls).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /^取消$/ }));
  fireEvent.click(screen.getByText('生成当前回答')); await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => calls[0].resolve(new Response(JSON.stringify({ ...response(calls[0].input), citations: [], answer: '迟到内容' }))));
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('');
  await finish(1);
});
it('saving_keeps_unconfirmed_questions_available_without_saving_them', async () => {
  const { save } = setup(); await generate(); await finish(); fireEvent.click(screen.getByText('采用'));
  fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(screen.getByLabelText('切换问题')).toBeTruthy();
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('');
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: '第二题手写回答' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0].sourceInterviewId).toBe(save.mock.calls[0][0].sourceInterviewId);
});
