// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JobAnswersPanel } from './JobAnswersPanel';
import { answerAssets } from '../domain/sampleData';
import { job } from '../llm/__tests__/fixtures';
import type { AnswerAsset, InterviewSession, ReviewReport } from '../domain/types';
import { upsertAnswerAsset } from '../workflow/runtimeAssets';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ available: false }))))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const session: InterviewSession = { id: 's1', jobFileId: job.id, source: 'externalImport', interviewType: 'synthetic', createdAt: '', rawConversation: '',
  questions: ['q1', 'q2'].map(id => ({ id, question: 'Describe your project', answer: `Original ${id}`, feedback: '', followUps: [] })) };
const review: ReviewReport = { id: 'r1', jobFileId: job.id, sessionId: session.id, summary: '', scores: [], strengths: [], weaknesses: [], nextActions: [] };
const legacy: AnswerAsset = { ...answerAssets[0], id: 'legacy-q1', sourceJobId: job.id, sourceInterviewId: session.id,
  originalQuestion: session.questions[0].question, originalAnswer: 'Original q1', improvedAnswer: 'Legacy first' };
const exact: AnswerAsset = { ...legacy, id: 'exact-q2', sourceQuestionId: 'q2', originalAnswer: 'Original q2', improvedAnswer: 'Exact second' };

function mount(seed: AnswerAsset[], target = session) {
  let persisted = seed;
  const saved: AnswerAsset[] = [];
  function Harness() {
    const [assets, setAssets] = useState(seed);
    persisted = assets;
    return <JobAnswersPanel job={job} session={target} review={review} assets={assets} chunks={[]} materialsReady
      onSave={asset => { saved.push(asset); setAssets(current => upsertAnswerAsset(current, asset)); }} />;
  }
  return { ...render(<Harness />), saved, read: () => persisted };
}
function answer() { return (screen.getByLabelText('下次可用回答') as HTMLTextAreaElement).value; }
function accept(text: string) {
  fireEvent.change(screen.getByLabelText('下次可用回答'), { target: { value: text } });
  fireEvent.click(screen.getByText('采用'));
}
function switchQuestion(index: number) { fireEvent.click(screen.getByRole('button', { name: new RegExp(`0${index}`) })); }

it('legacy_same_text_questions_keep_both_answers_after_real_upsert_without_reassigning_legacy', () => {
  const ui = mount([legacy]);
  accept('Answer q1'); switchQuestion(2); accept('Answer q2');
  fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(new Set(ui.saved.map(asset => asset.id)).size).toBe(2);
  expect(ui.read()).toHaveLength(3);
  expect(ui.read().find(asset => asset.id === legacy.id)).toEqual(legacy);
  for (const [index, question] of session.questions.entries()) {
    expect(ui.read().filter(asset => asset.sourceQuestionId === question.id)).toHaveLength(1);
    expect(ui.read().find(asset => asset.sourceQuestionId === question.id)).toMatchObject({
      improvedAnswer: `Answer q${index + 1}`, originalAnswer: question.answer, sourceJobId: job.id, sourceInterviewId: session.id });
  }
});

it('exact_id_wins_over_earlier_legacy_and_does_not_disambiguate_remaining_same_text_question', () => {
  const ui = mount([legacy, exact]);
  switchQuestion(2); expect(answer()).toBe('Exact second');
  switchQuestion(1); expect(answer()).toBe('');
  accept('New first'); switchQuestion(2); accept('Updated second');
  fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(ui.read()).toHaveLength(3);
  expect(ui.read().find(asset => asset.id === legacy.id)).toEqual(legacy);
  expect(ui.read().find(asset => asset.sourceQuestionId === 'q1')).toMatchObject({ improvedAnswer: 'New first', originalAnswer: 'Original q1' });
  expect(ui.read().find(asset => asset.id === exact.id)).toMatchObject({ sourceQuestionId: 'q2', improvedAnswer: 'Updated second', originalAnswer: 'Original q2',
    answerVersions: [{ answer: 'Exact second' }] });
});

const distinctSession = { ...session, questions: [session.questions[0], { ...session.questions[1], question: 'Another question' }] };
it('unique_legacy_binding_survives_question_and_original_answer_correction_and_remount', () => {
  const ui = mount([legacy], distinctSession);
  expect(answer()).toBe('Legacy first');
  fireEvent.change(screen.getByLabelText('识别到的问题'), { target: { value: 'Another question' } });
  fireEvent.change(screen.getByLabelText('你的原回答或材料片段'), { target: { value: 'Corrected original' } });
  accept('Corrected first'); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(ui.read()[0]).toMatchObject({ id: legacy.id, sourceQuestionId: 'q1', originalQuestion: 'Another question', originalAnswer: 'Corrected original' });
  const adopted = ui.read(); ui.unmount();
  const next = mount(adopted, distinctSession);
  expect(answer()).toBe('Corrected first');
  expect((screen.getByLabelText('你的原回答或材料片段') as HTMLTextAreaElement).value).toBe('Corrected original');
  switchQuestion(2); expect(answer()).toBe(''); accept('Independent second');
  switchQuestion(1); accept('Revised first'); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(next.read()).toHaveLength(2);
  expect(next.read().find(asset => asset.id === legacy.id)).toMatchObject({ sourceQuestionId: 'q1', originalAnswer: 'Corrected original', improvedAnswer: 'Revised first' });
  expect(next.read().find(asset => asset.sourceQuestionId === 'q2')).toMatchObject({ originalAnswer: 'Original q2', improvedAnswer: 'Independent second' });
});

it.each([
  ['other job', [{ ...legacy, sourceJobId: 'another-job', sourceQuestionId: 'q1' }]],
  ['other session', [{ ...legacy, sourceInterviewId: 'another-session', sourceQuestionId: 'q1' }]],
  ['explicit owner elsewhere', [{ ...legacy, sourceQuestionId: 'unknown-question' }]],
  ['multiple legacy candidates', [legacy, { ...legacy, id: 'second-legacy' }]],
  ['multiple exact candidates', [legacy, { ...exact, sourceQuestionId: 'q1' }, { ...exact, id: 'second-exact', sourceQuestionId: 'q1' }]],
] as const)('does_not_guess_binding_for_%s', (_name, assets) => {
  const seed = [...assets]; const ui = mount(seed, distinctSession);
  expect(answer()).toBe(''); accept('Independent answer'); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(ui.read()).toHaveLength(seed.length + 1);
  for (const asset of seed) expect(ui.read().find(entry => entry.id === asset.id)).toEqual(asset);
});

it('unbound_candidate_id_cannot_overwrite_an_explicit_owner_and_repeated_save_keeps_new_identity', () => {
  const first = mount([]); accept('Original candidate'); fireEvent.click(screen.getByText('保存到我的回答库'));
  const claimed = { ...first.read()[0], sourceQuestionId: 'q2' }; first.unmount();
  const ui = mount([claimed]); expect(answer()).toBe('');
  accept('Independent q1'); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(ui.read()).toHaveLength(2); expect(ui.read().find(asset => asset.id === claimed.id)).toEqual(claimed);
  const own = ui.read().find(asset => asset.sourceQuestionId === 'q1')!;
  expect(own.id).not.toBe(claimed.id);
  accept('Revised q1'); fireEvent.click(screen.getByText('保存到我的回答库'));
  expect(ui.read()).toHaveLength(2);
  expect(ui.read().find(asset => asset.id === own.id)).toMatchObject({ improvedAnswer: 'Revised q1', sourceQuestionId: 'q1', answerVersions: [{ answer: 'Independent q1' }] });
  expect(ui.read().find(asset => asset.id === claimed.id)).toEqual(claimed);
});
