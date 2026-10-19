// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JobFileDetail } from './JobFileDetail';
import { chunk, job, response } from '../llm/__tests__/fixtures';
import type { RewriteRequest } from '../domain/llmContracts';
import type { InterviewSession } from '../domain/types';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { answerAssets } from '../domain/sampleData';
const session: InterviewSession = { id: 's1', jobFileId: job.id, source: 'externalImport', interviewType: 'test', createdAt: '2026-10-14', rawConversation: '', questions: [
  { id: 'q1', question: 'What did you do?', answer: 'Analyzed data.', followUps: [], feedback: 'Explain actions' },
  { id: 'q2', question: 'What next?', answer: 'Test.', followUps: [], feedback: '' }] };
const calls: { url: string; input: RewriteRequest; resolve: (r: Response) => void; signal: AbortSignal }[] = [];
beforeEach(() => { calls.length = 0; vi.stubGlobal('fetch', vi.fn((url, options) => url === '/api/ai/status'
  ? Promise.resolve(new Response(JSON.stringify({ available: true })))
  : new Promise<Response>(resolve => calls.push({ url, input: JSON.parse(options.body), resolve, signal: options.signal })))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(overrides: Partial<ComponentProps<typeof JobFileDetail>> = {}) {
  const save = vi.fn();
  const ui = render(<JobFileDetail selectedJobId={job.id} jobFiles={[job]} interviewSessions={[session]} reviewReports={[]} answerAssets={[]}
    onSelectJob={vi.fn()} onCreateJob={vi.fn()} onUpdateJob={vi.fn()} onDeleteJob={vi.fn()} onSaveInterviewRecord={vi.fn()}
    onDeleteInterviewRecord={vi.fn()} onSaveAsset={save} materialChunks={[chunk]} {...overrides} />);
  fireEvent.click(screen.getByRole('tab', { name: '下次可用回答' }));
  return { ...ui, save };
}
async function generate() { fireEvent.click(screen.getByText('生成当前回答')); if (screen.queryByText('确认发送')) fireEvent.click(screen.getByText('确认发送')); await waitFor(() => expect(calls).toHaveLength(1)); }
async function finish() { await act(async () => calls[0].resolve(new Response(JSON.stringify({ ...response(calls[0].input), citations: calls[0].input.chunks.length ? response(calls[0].input).citations : [] })))); }
it.each(['manual', 'generated'])('ordinary job tabs retain unadopted %s answers', async mode => {
  const { save } = setup();
  if (mode === 'generated') { await generate(); await finish(); }
  else fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'Synthetic unsaved draft' } });
  const text = (screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value;
  fireEvent.click(screen.getByRole('tab', { name: '岗位准备' }));
  fireEvent.click(screen.getByRole('tab', { name: '下次可用回答' }));
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe(text);
  expect(save).not.toHaveBeenCalled();
});
it('job_generation_uses_same_endpoint', async () => {
  const { save } = setup();
  expect(screen.getByText('参考资料 · 已选 0 / 6')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /Synthetic project/ }));
  fireEvent.click(screen.getByText('生成当前回答'));
  expect(calls).toHaveLength(0); expect(screen.getByRole('dialog').textContent).toContain('DeepSeek');
  fireEvent.click(screen.getByText('确认发送')); await waitFor(() => expect(calls).toHaveLength(1)); await finish();
  expect(calls[0].url).toBe('/api/answers/rewrite'); expect(calls[0].input.questionId).toBe('q1');
  expect(calls[0].input.question).toBe(session.questions[0].question); expect(calls[0].input.chunks).toHaveLength(1);
  expect(save).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ improvedAnswer: 'I measured the result.', generation: { origin: 'model' }, evidence: [{ status: 'validated' }],
    answerRationale: { rewriteFocus: 'Structure', applicabilityBoundary: 'Confirmed only' } });
});
it('unconfigured_and_material_error_allow_handwriting_without_network', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ available: false })))));
  const { save } = setup({ materialsError: '资料加载失败' });
  await screen.findByText('生成暂不可用，可手写回答');
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'manual without references' } });
  fireEvent.click(screen.getByText('修改后采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save.mock.calls[0][0]).toMatchObject({ improvedAnswer: 'manual without references', confirmationStatus: 'edited-accepted' });
  expect(save.mock.calls[0][0].generation?.origin).not.toBe('model');
});
it('failure_keeps_saved_answer_and_never_returns_template', async () => {
  const saved = { ...answerAssets[0], sourceInterviewId: session.id, sourceJobId: job.id, originalQuestion: session.questions[0].question, improvedAnswer: 'already saved' };
  const { save } = setup({ answerAssets: [saved] }); await generate();
  await act(async () => calls[0].resolve(new Response('limited', { status: 429 })));
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('already saved');
  expect(save).not.toHaveBeenCalled(); expect(saved.improvedAnswer).toBe('already saved');
});
it('job_picker_limits_six_and_preview_contains_exact_selection', async () => {
  const chunks = Array.from({ length: 7 }, (_, i) => ({ ...chunk, id: `c${i}`, title: `Material ${i}`, text: `Exact preview ${i}` }));
  setup({ materialChunks: chunks });
  for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`Material ${i}`) }));
  expect((screen.getByRole('checkbox', { name: /Material 6/ }) as HTMLInputElement).disabled).toBe(true);
  const preview = screen.getByText('查看发送内容 · 6 个片段').parentElement!;
  expect(preview.textContent).toContain('Exact preview 5'); expect(preview.textContent).not.toContain('Exact preview 6');
  await generate(); expect(calls[0].input.chunks.map(c => c.text)).toEqual(chunks.slice(0, 6).map(c => c.text));
});
it('saving_edited_question_keeps_asset_identity_and_previous_metadata', () => {
  const saved = { ...answerAssets[0], sourceInterviewId: session.id, sourceJobId: job.id, originalQuestion: session.questions[0].question, improvedAnswer: 'already saved' };
  const { save } = setup({ answerAssets: [saved] });
  fireEvent.change(screen.getByLabelText('识别到的问题'), { target: { value: 'Edited question' } });
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'edited answer' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(save.mock.calls[0][0].id).toBe(saved.id);
  expect(save.mock.calls[0][0].answerVersions[0].answer).toBe(saved.improvedAnswer);
});
it('edited_question_asset_reopens_by_stable_source_question_after_remount', () => {
  const saved = { ...answerAssets[0], sourceInterviewId: session.id, sourceJobId: job.id, originalQuestion: session.questions[0].question, improvedAnswer: 'previous answer' };
  const ui = setup({ answerAssets: [saved] });
  fireEvent.change(screen.getByLabelText('识别到的问题'), { target: { value: 'Corrected question text' } });
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'corrected answer' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  const adopted = ui.save.mock.calls[0][0]; ui.unmount();
  const next = setup({ answerAssets: [adopted] });
  expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('corrected answer');
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'third answer' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(next.save.mock.calls[0][0].id).toBe(saved.id);
  expect(next.save.mock.calls[0][0].answerVersions).toHaveLength(2);
});
it('save_parent_update_does_not_switch_selected_record_or_erase_another_question_draft', async () => {
  const second = { ...session, id: 's2', questions: session.questions.map(q => ({ ...q, id: q.id + '-second', question: q.question + ' second' })) };
  function Harness() {
    const [assets, setAssets] = useState<typeof answerAssets>([]);
    return <JobFileDetail selectedJobId={job.id} jobFiles={[job]} interviewSessions={[session, second]} reviewReports={[]} answerAssets={assets}
      onSelectJob={vi.fn()} onCreateJob={vi.fn()} onUpdateJob={vi.fn()} onDeleteJob={vi.fn()} onSaveInterviewRecord={vi.fn()}
      onDeleteInterviewRecord={vi.fn()} onSaveAsset={asset => setAssets(current => [...current, asset])} />;
  }
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('选择面试记录'), { target: { value: 's2' } });
  fireEvent.click(screen.getByRole('tab', { name: '下次可用回答' }));
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'second record answer' } });
  fireEvent.click(screen.getByText('采用')); fireEvent.click(screen.getByText('保存到我的回答库'));
  await waitFor(() => expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).toBe('second record answer'));
});
it.each(['edit', 'switch', 'cancel', 'pick', 'navigate'])('late_job_response_after_%s_does_not_save', async action => {
  const { save, unmount } = setup(); await generate();
  if (action === 'edit') fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: 'handwritten' } });
  if (action === 'switch') fireEvent.click(screen.getByRole('button', { name: /02/ }));
  if (action === 'cancel') fireEvent.click(screen.getByTitle('取消生成'));
  if (action === 'pick') fireEvent.click(screen.getByRole('checkbox', { name: /Synthetic project/ }));
  if (action === 'navigate') unmount();
  await finish(); expect(save).not.toHaveBeenCalled();
  if (action !== 'navigate') expect((screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value).not.toBe('I measured the result.');
});
