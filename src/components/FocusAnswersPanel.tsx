import { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Pencil, Sparkles, X } from 'lucide-react';
import type { AnswerAssetConfirmationStatus, InterviewMaterialDraftItem, JobFile } from '../domain/types';
import type { MaterialChunk } from '../domain/materialTypes';
import type { RewriteRequest } from '../domain/llmContracts';
import { AIClientError, getAIStatus } from '../llm/client';
import { prepareRewriteRequest } from '../llm/prepareRewriteRequest';
import { useAnswerGeneration } from '../llm/useAnswerGeneration';
import { validateEvidence } from '../llm/validateEvidence';
import { manualAnswerMetadata } from '../workflow/answerAssetVersions';
import { MaterialReferencePicker } from './materials/MaterialReferencePicker';
import { AnswerEvidence } from './AnswerEvidence';
import { emptyFocusWork, isFocusAnswerReady, reconcileFocusWork, type FocusQuestionWork, type FocusQuestionWorks } from '../domain/focusFlowDraft';

type Props = { items: InterviewMaterialDraftItem[]; job: JobFile; chunks: MaterialChunk[];
  materialsReady?: boolean;
  initialQuestionId?: string;
  work: FocusQuestionWorks;
  onWorkChange: (id: string, work: FocusQuestionWork) => void;
  onActiveChange: (id: string) => void;
  onChange: (item: InterviewMaterialDraftItem) => void;
  onSave: (statuses: Map<string, AnswerAssetConfirmationStatus>) => void };
type Run = { request: RewriteRequest; revision: number; applied?: string };
export function FocusAnswersPanel({ items, job, chunks, materialsReady = true, initialQuestionId, work, onWorkChange, onActiveChange, onChange, onSave }: Props) {
  const generation = useAnswerGeneration();
  const [activeId, setActiveId] = useState(initialQuestionId ?? items[0]?.id);
  const item = items.find(entry => entry.id === activeId) ?? items[0];
  const workRef = useRef(work); workRef.current = work;
  const currentWork = work[item.id] ?? emptyFocusWork();
  function updateWork(id: string, value: FocusQuestionWork) {
    workRef.current = { ...workRef.current, [id]: value };
    onWorkChange(id, value);
  }
  const revisions = useRef<Record<string, number>>({});
  for (const [id, value] of Object.entries(work)) revisions.current[id] = value.revision;
  const runs = useRef<Record<string, Run>>({});
  const [confirmed, setConfirmed] = useState<Record<string, { revision: number; status: AnswerAssetConfirmationStatus }>>({});
  const [firstSend, setFirstSend] = useState(false);
  const [confirmation, setConfirmation] = useState<RewriteRequest>();
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean>();
  const selectedIds = currentWork.selectedChunks.map(selected => selected.chunkId);
  const selectedChunks = currentWork.selectedChunks.map(selected => chunks.find(chunk => chunk.id === selected.chunkId && chunk.documentId === selected.documentId && chunk.documentVersion === selected.documentVersion)).filter((chunk): chunk is MaterialChunk => !!chunk);
  const state = generation.getState(item.id);
  const revision = revisions.current[item.id] ?? 0;
  const run = runs.current[item.id];
  const canProceed = materialsReady || (!currentWork.selectedChunks.length &&
    !(Array.isArray(item.evidence) && item.evidence.length) &&
    !(currentWork.provenance?.kind === 'model' && currentWork.provenance.request.chunks.length));
  const answerReady = canProceed && isFocusAnswerReady(item, currentWork);
  const accepted = confirmed[item.id]?.revision === revision;
  useEffect(() => {
    const controller = new AbortController();
    void getAIStatus(controller.signal).then(status => { if (!controller.signal.aborted) setConfigured(status.available); }).catch(() => { if (!controller.signal.aborted) setConfigured(false); });
    return () => controller.abort();
  }, []);
  const chunkSnapshot = JSON.stringify(chunks);
  const previousChunks = useRef(chunkSnapshot);
  useEffect(() => {
    if (!materialsReady) { if (!canProceed) { generation.cancel(); setConfirmation(undefined); setConfirmed({}); } return; }
    if (previousChunks.current === chunkSnapshot) return;
    previousChunks.current = chunkSnapshot;
    generation.cancel(); setConfirmation(undefined); setConfirmed({});
    for (const entry of items) {
      const before = workRef.current[entry.id] ?? emptyFocusWork();
      const after = reconcileFocusWork(before, chunks);
      if (after !== before) {
        revisions.current[entry.id] = after.revision;
        updateWork(entry.id, after);
        if (Array.isArray(entry.evidence)) onChange({ ...entry, evidence: entry.evidence.map(e => ({ ...e, status: 'needs-review' })) });
      }
    }
  }, [chunkSnapshot, chunks, materialsReady, canProceed, generation.cancel, items, onChange]);
  useEffect(() => {
    const result = state.result;
    if (!canProceed || state.status !== 'success' || !result || !run || run.revision !== (revisions.current[item.id] ?? 0) || run.applied === result.generationId) return;
    // The hook owns the final ID; all other fields come from the exact send snapshot.
    const evidence = validateEvidence({ ...run.request, generationId: result.generationId }, result);
    run.applied = result.generationId;
    updateWork(item.id, { ...currentWork, provenance: { kind: 'model', revision, request: { ...run.request, generationId: result.generationId }, response: result } });
    setConfirmed(current => { const next = { ...current }; delete next[item.id]; return next; });
    onChange({ ...item, modelRationale: { rewriteFocus: result.rewriteFocus, applicabilityBoundary: result.applicabilityBoundary }, answerAssetCandidate: true, improvedAnswer: result.answer, evidence, missingFacts: result.missingFacts,
      generation: { provider: 'deepseek', model: result.model, generatedAt: result.generatedAt, generationId: result.generationId, origin: 'model' } });
  }, [state, run, revision, item, onChange, canProceed]);

  function invalidate() {
    generation.cancel(); setConfirmation(undefined); setError('');
    const nextRevision = (revisions.current[item.id] ?? 0) + 1;
    revisions.current[item.id] = nextRevision;
    updateWork(item.id, { revision: nextRevision, selectedChunks: currentWork.selectedChunks });
    setConfirmed(current => { const next = { ...current }; delete next[item.id]; return next; });
    return nextRevision;
  }
  function edit(field: 'question' | 'originalAnswer' | 'issue' | 'improvementSuggestion' | 'improvedAnswer', value: string) {
    const nextRevision = invalidate();
    if (field === 'improvedAnswer') updateWork(item.id, { revision: nextRevision, selectedChunks: currentWork.selectedChunks, provenance: { kind: 'manual', revision: nextRevision, answer: value } });
    onChange({ ...item, generation: field === 'improvedAnswer' ? manualAnswerMetadata({ generation: item.generation }).generation : item.generation,
      [field]: value, answerAssetCandidate: field === 'improvedAnswer' ? true : item.answerAssetCandidate, evidence: Array.isArray(item.evidence) ? item.evidence.map(e => ({ ...e, status: e.status === 'source-deleted' ? 'source-deleted' : 'needs-review' })) : item.evidence });
  }
  let preview: RewriteRequest | undefined;
  try { preview = prepareRewriteRequest(item, job, selectedChunks, 'preview'); } catch { /* Show the public preparation error on generate, without truncating. */ }
  function start(request: RewriteRequest) {
    if (!canProceed) return;
    runs.current[item.id] = { request, revision };
    setConfirmation(undefined); setFirstSend(true); setError('');
    void generation.generate(request);
  }
  function generate() {
    if (!canProceed) return;
    try {
      const request = prepareRewriteRequest(item, job, selectedChunks, crypto.randomUUID());
      if (!firstSend) setConfirmation(request); else start(request);
    } catch (reason) { setError(reason instanceof AIClientError ? reason.message : '暂时无法生成，请稍后重试。'); }
  }
  function confirm(status: AnswerAssetConfirmationStatus) {
    if (!item.improvedAnswer?.trim() || revision !== (revisions.current[item.id] ?? 0) || !answerReady || state.status === 'pending') return;
    setConfirmed(current => ({ ...current, [item.id]: { revision, status } }));
  }
  function save() {
    const statuses = new Map<string, AnswerAssetConfirmationStatus>();
    for (const entry of items) {
      const confirmation = confirmed[entry.id];
      const value = workRef.current[entry.id] ?? emptyFocusWork();
      const referencesAvailable = materialsReady || (!value.selectedChunks.length && !(Array.isArray(entry.evidence) && entry.evidence.length) && !(value.provenance?.kind === 'model' && value.provenance.request.chunks.length));
      if (referencesAvailable && confirmation && confirmation.revision === (revisions.current[entry.id] ?? 0) && isFocusAnswerReady(entry, value)) statuses.set(entry.id, confirmation.status);
    }
    if (statuses.size) { generation.cancel(); onSave(statuses); }
  }
  return <div className="focus-answers-panel">
    <div className="question-switcher" aria-label="切换问题">{items.map((entry, index) => <button type="button" key={entry.id} aria-pressed={item.id === entry.id} onClick={() => {
      generation.cancel(); setActiveId(entry.id); onActiveChange(entry.id); setConfirmation(undefined); setError('');
    }}>{String(index + 1).padStart(2, '0')} {entry.title}{confirmed[entry.id] && <Check size={13} />}</button>)}</div>
    <h3>{item.question || item.title}</h3>
    <details className="focus-answer-rationale"><summary>问题与改写重点</summary>
      {([['question', '识别到的问题'], ['originalAnswer', '你的原回答或材料片段'], ['issue', '具体问题'], ['improvementSuggestion', '建议这样改']] as const).map(([field, label]) => <label className="focus-answer-field" key={field}><span>{label}</span><textarea aria-label={label} value={item[field] ?? ''} onChange={event => edit(field, event.target.value)} /></label>)}
    </details>
    <fieldset className="focus-flow-content" aria-label="参考资料选择" disabled={!materialsReady}><MaterialReferencePicker chunks={chunks} query={item.question ?? ''} selectedChunkIds={selectedIds} onChange={ids => {
      const nextRevision = invalidate();
      updateWork(item.id, { revision: nextRevision, selectedChunks: ids.map(id => chunks.find(chunk => chunk.id === id)!).map(chunk => ({ chunkId: chunk.id, documentId: chunk.documentId, documentVersion: chunk.documentVersion })) });
      onChange({ ...item, evidence: Array.isArray(item.evidence) ? item.evidence.map(e => ({ ...e, status: 'needs-review' })) : item.evidence });
    }} /></fieldset>
    <details className="focus-send-preview"><summary>查看发送内容 · {selectedChunks.length} 个片段</summary>{preview ? <div className="focus-send-content">
      {([['本次问题', preview.question], ['原回答', preview.originalAnswer], ['具体问题', preview.issue], ['改写重点', preview.rewriteFocus], ['公司', preview.jobContext?.company ?? ''], ['岗位', preview.jobContext?.role ?? ''], ['岗位要求', preview.jobContext?.jdSummary ?? '']] as const).map(([label, text]) => <div key={label}><strong>{label}</strong><p>{text || '未填写'}</p></div>)}
      {preview.chunks.map(chunk => <div key={chunk.chunkId}><strong>{chunk.title} · {chunk.kind === 'knowledge' ? '知识笔记' : '项目经历'}</strong><small>{chunk.locator.type === 'page' ? `第 ${chunk.locator.pageNumber} 页` : `第 ${chunk.locator.paragraphIndex + 1} 段`}{chunk.tags.length > 0 && ` · ${chunk.tags.join('、')}`}</small><p>{chunk.text}</p></div>)}
    </div> : <p>内容超出限制或问题为空，请调整后重试。</p>}</details>
    <div className="focus-generation-actions"><button type="button" className="primary-action" disabled={!canProceed || state.status === 'pending' || configured === false} onClick={generate}><Sparkles size={16} />{state.status === 'pending' ? '生成中' : '生成当前回答'}</button>
      {state.status === 'pending' && <button type="button" className="ghost-action" title="取消生成" onClick={() => generation.cancel()}><X size={16} />取消</button>}
      {configured === false && <span>生成暂不可用，可手写回答</span>}
    </div>
    {(error || state.error) && <p role="alert">{error || state.error?.message}</p>}
    {confirmation && <div role="dialog" aria-label="发送确认" className="focus-send-confirmation"><p>将本次问题和选中的 {confirmation.chunks.length} 个资料片段发送至 DeepSeek？</p><strong>{confirmation.question}</strong><button autoFocus type="button" className="primary-action" onClick={() => start(confirmation)}>确认发送</button><button type="button" className="ghost-action" onClick={() => setConfirmation(undefined)}>取消</button></div>}
    <label className="focus-answer-field"><span>下次可用回答</span><textarea aria-label="下次可用回答" value={item.improvedAnswer ?? ''} onChange={event => edit('improvedAnswer', event.target.value)} /></label>
    {item.modelRationale && <details className="focus-answer-rationale"><summary>生成依据与适用边界</summary><strong>模型改写重点</strong><p>{item.modelRationale.rewriteFocus}</p><strong>模型适用边界</strong><p>{item.modelRationale.applicabilityBoundary}</p></details>}
    <AnswerEvidence evidence={Array.isArray(item.evidence) ? item.evidence : []} missingFacts={item.missingFacts} />
    {canProceed && item.improvedAnswer?.trim() && (answerReady || accepted) && <div className="focus-answer-confirmation" aria-label="回答确认">
      <span>{accepted ? '已确认采用' : '待确认'}</span><button type="button" className="secondary-action" onClick={() => confirm('accepted')}><Check size={15} />采用</button><button type="button" className="secondary-action" onClick={() => confirm('edited-accepted')}><Pencil size={15} />修改后采用</button><button type="button" className="ghost-action" onClick={() => setConfirmed(current => { const next = { ...current }; delete next[item.id]; return next; })}>暂不保存</button>
    </div>}
    <button type="button" className="primary-action" disabled={!canProceed || !Object.keys(confirmed).length || state.status === 'pending'} onClick={save}><CheckCheck size={16} />保存到我的回答库</button>
  </div>;
}
