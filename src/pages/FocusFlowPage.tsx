import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  FileText,
  Sparkles
} from 'lucide-react';
import { parseInterviewMaterial } from '../agents/materialImportParser';
import type {
  AnswerAsset,
  AnswerAssetConfirmationStatus,
  InterviewMaterialDraft,
  InterviewSession,
  JobFile,
  ReviewReport
} from '../domain/types';
import { buildMaterialImportSavePayload } from '../workflow/materialImportDraft';
import type { MaterialChunk } from '../domain/materialTypes';
import { FocusAnswersPanel } from '../components/FocusAnswersPanel';
import { emptyFocusWork, reconcileFocusWork, type FocusFlowDraft, type FocusQuestionWorks } from '../domain/focusFlowDraft';
import type { MaterialRepository } from '../materials/repository';
import { getMaterialDraftQueue } from '../materials/draftQueue';

type FocusFlowPageProps = {
  onDraftPersisted?: () => void;
  repository?: MaterialRepository;
  materialsLoading?: boolean;
  materialChunks?: MaterialChunk[];
  selectedJobId: string;
  jobFiles: JobFile[];
  onUpdateJob: (job: JobFile) => void;
  onSaveInterviewRecord: (
    session: InterviewSession,
    review: ReviewReport
  ) => void;
  onSaveAsset: (asset: AnswerAsset) => void;
  onFinish: (target: 'workspace' | 'assets') => void;
};

type FocusJobDraft = {
  company: string;
  roleTitle: string;
  direction: string;
  jdText: string;
};

export function FocusFlowPage({
  onDraftPersisted,
  repository,
  materialsLoading = false,
  materialChunks = [],
  jobFiles,
  onFinish,
  onSaveAsset,
  onSaveInterviewRecord,
  onUpdateJob,
  selectedJobId
}: FocusFlowPageProps) {
  const selectedJob =
    jobFiles.find((job) => job.id === selectedJobId) ?? jobFiles[0];
  const [jobDraft, setJobDraft] = useState<FocusJobDraft>(() =>
    createFocusJobDraft(selectedJob)
  );
  const [materialText, setMaterialText] = useState('');
  const [materialDraft, setMaterialDraft] = useState<
    InterviewMaterialDraft | undefined
  >();
  const [isAnswerStage, setIsAnswerStage] = useState(false);
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(() => new Set());
  const [runId, setRunId] = useState('');
  const [savedSummary, setSavedSummary] = useState<
    { sessionId: string; assetCount: number } | undefined
  >();
  const [activeItemId, setActiveItemId] = useState('');
  const [work, setWork] = useState<FocusQuestionWorks>({});
  const [draftReady, setDraftReady] = useState(!repository);
  const [restored, setRestored] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [retryDraft, setRetryDraft] = useState(0);
  const [retryWrite, setRetryWrite] = useState(0);
  const hydratedJob = useRef('');
  const alive = useRef(true);
  const notifyDraftPersisted = useRef(onDraftPersisted); notifyDraftPersisted.current = onDraftPersisted;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    hydratedJob.current = '';
    setJobDraft(createFocusJobDraft(selectedJob));
    setMaterialText('');
    setMaterialDraft(undefined);
    setIsAnswerStage(false);
    setSavedItemIds(new Set());
    setSavedSummary(undefined);
    setWork({}); setRestored(false);
  }, [selectedJob.id]);

  useEffect(() => {
    if (!repository || materialsLoading) return;
    let cancelled = false;
    setDraftReady(false);
    void getMaterialDraftQueue(repository).run(() => repository.listFlowDrafts()).then(drafts => {
      if (cancelled) return;
      const draft = drafts.find(entry => entry.jobId === selectedJob.id);
      if (draft) {
        const nextWork = Object.fromEntries(Object.entries(draft.work).map(([id, value]) => [id, reconcileFocusWork(value, materialChunks)]));
        setJobDraft(draft.jobDraft); setMaterialText(draft.rawText); setWork(nextWork);
        setMaterialDraft(draft.materialDraft ? { ...draft.materialDraft, interviewItems: draft.materialDraft.interviewItems.map(item => nextWork[item.id] !== draft.work[item.id] && Array.isArray(item.evidence) ? { ...item, evidence: item.evidence.map(entry => ({ ...entry, status: 'needs-review' as const })) } : item) } : undefined);
        setActiveItemId(draft.activeItemId); setIsAnswerStage(draft.stage === 'answers');
        setRunId(crypto.randomUUID()); setSavedItemIds(new Set()); setSavedSummary(undefined); setRestored(true);
      }
      hydratedJob.current = selectedJob.id;
      setDraftReady(true); setDraftError('');
    }).catch(() => { if (!cancelled) setDraftError('草稿加载失败，请重试'); });
    return () => { cancelled = true; };
  }, [repository, selectedJob.id, materialsLoading, retryDraft]);

  useEffect(() => {
    if (!repository || !draftReady || hydratedJob.current !== selectedJob.id) return;
    const pendingItems = materialDraft?.interviewItems.filter(item => !savedItemIds.has(item.id));
    const id = `focus-flow:${selectedJob.id}`;
    const queue = getMaterialDraftQueue(repository);
    const complete = !!savedSummary && !pendingItems?.length;
    const jobEdited = Object.entries(jobDraft).some(([field, value]) => value !== createFocusJobDraft(selectedJob)[field as keyof FocusJobDraft]);
    const draft: FocusFlowDraft = { id, kind: 'focus-flow', schemaVersion: 1, jobId: selectedJob.id, jobDraft,
      rawText: materialText, materialDraft: materialDraft ? { ...materialDraft, interviewItems: pendingItems ?? [] } : undefined,
      stage: isAnswerStage ? 'answers' : materialDraft ? 'questions' : 'input', activeItemId,
      work: Object.fromEntries(Object.entries(work).filter(([id]) => pendingItems?.some(item => item.id === id))), updatedAt: new Date().toISOString() };
    const remove = complete || (!materialText && !materialDraft && !jobEdited);
    void queue.run(() => remove ? repository.deleteDraft(id) : repository.saveFlowDraft(draft)).then(() => {
      if (alive.current) { setDraftError(''); if (!remove) notifyDraftPersisted.current?.(); }
    }).catch(() => { if (alive.current) setDraftError('草稿保存失败，请重试'); });
  }, [repository, draftReady, selectedJob.id, jobDraft, materialText, materialDraft, isAnswerStage, activeItemId, work, savedItemIds, savedSummary, retryWrite]);

  const hasMaterial = materialText.trim().length > 0;
  const flowStep = savedSummary
    ? 4
    : isAnswerStage
      ? 3
      : materialDraft
        ? 2
        : hasMaterial
          ? 1
          : 0;
  const recognitionSummary = materialDraft
    ? buildRecognitionSummary(materialDraft)
    : undefined;
  const stageItems = materialDraft?.interviewItems.filter(item => !savedItemIds.has(item.id)) ?? [];
  const activeItem =
    stageItems.find((item) => item.id === activeItemId) ?? stageItems[0];

  function updateJobDraft(field: keyof FocusJobDraft, value: string) {
    setJobDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function currentJob(): JobFile {
    const isStarterJob = isEmptyStarterJob(selectedJob);
    const jobContext = buildUserJobContext(selectedJob, jobDraft);
    const company =
      jobContext.company || (isStarterJob ? '未填写公司' : selectedJob.company);
    const roleTitle =
      jobContext.roleTitle ||
      (isStarterJob ? '未填写岗位' : selectedJob.roleTitle);
    const direction =
      jobContext.direction ||
      (isStarterJob ? '待确认方向' : selectedJob.direction);

    return {
      ...selectedJob,
      company,
      roleTitle,
      direction,
      jdText: jobDraft.jdText.trim(),
      status:
        selectedJob.status === '待粘贴 JD 和面试对话'
          ? '已开始准备'
          : selectedJob.status
    };
  }

  function handleParseMaterial() {
    if (!hasMaterial) return;

    const fallbackJob = buildParserFallbackJob(selectedJob, jobDraft);
    const draft = parseInterviewMaterial({
      rawText: materialText,
      sourceType: 'auto',
      fallbackJob
    });
    setJobDraft((current) => ({
      company: current.company.trim() || draft.jobContext.company || '',
      roleTitle: current.roleTitle.trim() || draft.jobContext.role || '',
      direction: current.direction.trim() || draft.jobContext.direction || '',
      jdText: current.jdText.trim() || draft.jobContext.jdText || ''
    }));
    setMaterialDraft(draft);
    setWork({}); setRestored(false); setActiveItemId(draft.interviewItems[0]?.id ?? '');
    setRunId(crypto.randomUUID());
    setSavedItemIds(new Set());
    setIsAnswerStage(false);
    setSavedSummary(undefined);
  }

  function handleDraftItemChange(
    itemId: string,
    field:
      | 'title'
      | 'question'
      | 'originalAnswer'
      | 'issue'
      | 'improvementSuggestion'
      | 'improvedAnswer',
    value: string
  ) {
    setWork(current => { const value = current[itemId] ?? emptyFocusWork(); return { ...current, [itemId]: { revision: value.revision + 1, selectedChunks: value.selectedChunks } }; });
    setMaterialDraft((current) =>
      current
        ? {
            ...current,
            interviewItems: current.interviewItems.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    [field]: value,
                    evidence: Array.isArray(item.evidence) ? item.evidence.map(entry => ({ ...entry, status: 'needs-review' as const })) : item.evidence
                  }
                : item
            )
          }
        : current
    );
  }

  function handleGenerateAnswers() {
    setIsAnswerStage(true);
  }

  function handleSave(statuses: Map<string, AnswerAssetConfirmationStatus>) {
    if (!materialDraft || !isAnswerStage) return;

    const job = currentJob();
    onUpdateJob(job);
    const payload = buildMaterialImportSavePayload({
      draft: materialDraft,
      selectedItemIds: statuses.keys(),
      confirmationStatuses: statuses,
      job,
      rawText: materialText,
      runId
    });

    onSaveInterviewRecord(payload.session, payload.review);
    payload.assets.forEach((asset) => onSaveAsset(asset));
    setSavedItemIds(current => new Set([...current, ...statuses.keys()]));
    setSavedSummary({
      sessionId: payload.session.id,
      assetCount: (savedSummary?.assetCount ?? 0) + payload.assets.length
    });
  }

  function handleStartNext() {
    setWork({}); setRestored(false);
    setSavedItemIds(new Set());
    setMaterialText('');
    setMaterialDraft(undefined);
    setIsAnswerStage(false);
    setSavedSummary(undefined);
  }

  return (
    <section className="focus-flow-page">
      {repository && !draftReady && <p role="status">草稿加载中</p>}
      {restored && <p className="material-draft-label">未保存草稿</p>}
      {draftError && <p role="alert">{draftError}<button type="button" onClick={() => draftReady ? setRetryWrite(current => current + 1) : setRetryDraft(current => current + 1)}>重试草稿</button></p>}
      <fieldset className="focus-flow-content" disabled={!!repository && !draftReady}>
      <header className="focus-flow-hero">
        <div>
          <p className="eyebrow">面试成长</p>
          <h1>
            {savedSummary
              ? '已保存'
              : isAnswerStage
                ? '下次可用回答'
                : materialDraft
                  ? '确认识别结果'
                  : '开始新面试'}
          </h1>
        </div>
      </header>

      <div className="focus-flow-steps" aria-label="当前流程">
        <FlowStep
          active={flowStep === 0 || flowStep === 1}
          done={flowStep > 1}
          index={1}
          label="粘贴材料"
        />
        <FlowStep
          active={flowStep === 2}
          done={flowStep > 2}
          index={2}
          label="确认问题"
        />
        <FlowStep
          active={flowStep === 3}
          done={flowStep > 3}
          index={3}
          label="优化回答"
        />
        <FlowStep
          active={flowStep === 4}
          done={Boolean(savedSummary)}
          index={4}
          label="保存"
        />
      </div>

      {!materialDraft && !savedSummary && (
        <>
          <details className="focus-flow-card focus-job-context">
            <summary>
              目标岗位{' '}
              <span>
                {jobDraft.company || jobDraft.roleTitle
                  ? [jobDraft.company, jobDraft.roleTitle]
                      .filter(Boolean)
                      .join(' · ')
                  : '可选'}
              </span>
            </summary>
            <div className="focus-job-grid">
              <label>
                <span>公司</span>
                <input
                  value={jobDraft.company}
                  placeholder="公司名称，可自动识别"
                  onChange={(event) =>
                    updateJobDraft('company', event.target.value)
                  }
                />
              </label>
              <label>
                <span>岗位</span>
                <input
                  value={jobDraft.roleTitle}
                  placeholder="岗位名称，可自动识别"
                  onChange={(event) =>
                    updateJobDraft('roleTitle', event.target.value)
                  }
                />
              </label>
              <label>
                <span>方向</span>
                <input
                  value={jobDraft.direction}
                  placeholder="岗位名称"
                  onChange={(event) =>
                    updateJobDraft('direction', event.target.value)
                  }
                />
              </label>
            </div>
            <label className="focus-full-field">
              <span>JD 或岗位信息</span>
              <textarea
                value={jobDraft.jdText}
                placeholder="岗位职责、任职要求，可选"
                onChange={(event) =>
                  updateJobDraft('jdText', event.target.value)
                }
              />
            </label>
          </details>

          <section className="focus-flow-card focus-flow-card--primary">
            <div className="focus-material-heading">
              <div>
                <h2>
                  <FileText size={19} /> 面试材料
                </h2>
              </div>
              <button
                className="primary-action"
                type="button"
                onClick={handleParseMaterial}
                disabled={!hasMaterial}
              >
                <Sparkles size={16} />
                解析材料
              </button>
            </div>
            <textarea
              className="focus-material-input"
              aria-label="面试材料"
              value={materialText}
              placeholder={
                '粘贴 JD、面试记录或模拟面试对话\n\n面试官：你如何评估产品效果？\n我的回答：……\n追问与复盘：……'
              }
              onChange={(event) => setMaterialText(event.target.value)}
            />
          </section>
        </>
      )}

      {materialDraft && (!savedSummary || stageItems.length > 0) && (
        <section className="focus-flow-card">
          <div className="focus-draft-heading">
            <div>
              <button
                className="ghost-action"
                type="button"
                onClick={() =>
                  isAnswerStage
                    ? setIsAnswerStage(false)
                    : setMaterialDraft(undefined)
                }
              >
                <ArrowLeft size={15} />
                {isAnswerStage ? '返回问题' : '编辑材料'}
              </button>
              <h2>
                {isAnswerStage
                  ? '优化当前回答'
                  : `${materialDraft.interviewItems.length} 个问题`}
              </h2>
            </div>
            {!isAnswerStage && (
              <button
                className="primary-action"
                type="button"
                onClick={handleGenerateAnswers}
                disabled={materialDraft.interviewItems.length === 0}
              >
                <Sparkles size={16} />
                生成下次可用回答
              </button>
            )}
          </div>
          {recognitionSummary && !isAnswerStage && (
            <div className="focus-recognition-summary" aria-label="识别摘要">
              {recognitionSummary.metrics.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          )}
          {materialDraft.missingInfoWarnings.length > 0 &&
            !isAnswerStage && (
              <details className="material-warning-list">
                <summary>
                  有 {materialDraft.missingInfoWarnings.length} 项待补充
                </summary>
                {materialDraft.missingInfoWarnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </details>
            )}
          {recognitionSummary &&
            recognitionSummary.suggestions.length > 0 &&
            !isAnswerStage && (
              <details className="focus-low-confidence-hints">
                <summary>待确认项</summary>
                <ul>
                  {recognitionSummary.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </details>
            )}
          {isAnswerStage && <FocusAnswersPanel key={stageItems.map(item => item.id).join(':')} items={stageItems} job={currentJob()} chunks={materialChunks} initialQuestionId={activeItem?.id}
            work={work} onWorkChange={(id, value) => setWork(current => ({ ...current, [id]: value }))} onActiveChange={setActiveItemId}
            onChange={updated => setMaterialDraft(current => current ? { ...current, interviewItems: current.interviewItems.map(item => item.id === updated.id ? updated : item) } : current)} onSave={handleSave} />}
          {!isAnswerStage && <>
          <div className="question-switcher" aria-label="切换问题">
            {stageItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={activeItem?.id === item.id}
                onClick={() => setActiveItemId(item.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {item.title}
              </button>
            ))}
          </div>
          <div className="focus-draft-list">
            {activeItem &&
              [activeItem].map((item) => (
                <article className="focus-draft-card" key={item.id}>
                  <div className="focus-draft-card-title">
                    {isAnswerStage ? (
                      <h3>
                        <span className="item-number">
                          {String(
                            materialDraft.interviewItems.indexOf(item) + 1
                          ).padStart(2, '0')}
                        </span>
                        {item.question || item.title}
                      </h3>
                    ) : (
                      <label>
                        <span>问题类型</span>
                        <input
                          value={item.title}
                          onChange={(event) =>
                            handleDraftItemChange(
                              item.id,
                              'title',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                  {!isAnswerStage && (
                    <div className="focus-draft-grid">
                      <label>
                        <span>识别到的问题</span>
                        <textarea
                          value={item.question ?? ''}
                          onChange={(event) =>
                            handleDraftItemChange(
                              item.id,
                              'question',
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>你的原回答或材料片段</span>
                        <textarea
                          value={item.originalAnswer ?? ''}
                          onChange={(event) =>
                            handleDraftItemChange(
                              item.id,
                              'originalAnswer',
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>具体问题</span>
                        <textarea
                          value={item.issue ?? ''}
                          onChange={(event) =>
                            handleDraftItemChange(
                              item.id,
                              'issue',
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>建议这样改</span>
                        <textarea
                          value={item.improvementSuggestion ?? ''}
                          onChange={(event) =>
                            handleDraftItemChange(
                              item.id,
                              'improvementSuggestion',
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  )}
                </article>
              ))}
          </div>
          </>}
        </section>
      )}

      {savedSummary && (
        <section className="focus-success-card">
          <p className="eyebrow">已保存</p>
          <CheckCheck size={34} />
          <h2>下一场，更进一步</h2>
          <p>1 场面试 · {savedSummary.assetCount} 条回答</p>
          <div className="focus-success-actions">
            <button
              className="primary-action"
              type="button"
              onClick={() => onFinish('workspace')}
            >
              查看工作台 <ArrowRight size={16} />
            </button>
            <button
              className="secondary-action"
              type="button"
              onClick={() => onFinish('assets')}
            >
              打开我的回答库
            </button>
            <button
              className="ghost-action"
              type="button"
              onClick={handleStartNext}
            >
              开始下一场面试
            </button>
          </div>
        </section>
      )}
      </fieldset>
    </section>
  );
}

function createFocusJobDraft(job: JobFile): FocusJobDraft {
  if (isEmptyStarterJob(job)) {
    return {
      company: '',
      roleTitle: '',
      direction: '',
      jdText: ''
    };
  }

  return {
    company: job.company,
    roleTitle: job.roleTitle,
    direction: job.direction,
    jdText: job.jdText
  };
}

function isEmptyStarterJob(job: JobFile) {
  return (
    job.id.startsWith('job-user-first-') &&
    job.company === '我的目标公司' &&
    (job.roleTitle === '' || job.roleTitle === 'AI 产品经理') &&
    !job.jdText.trim() &&
    job.interviewSessionIds.length === 0
  );
}

function buildUserJobContext(job: JobFile, draft: FocusJobDraft) {
  const isStarterJob = isEmptyStarterJob(job);

  return {
    company: draft.company.trim() || (isStarterJob ? '' : job.company),
    roleTitle: draft.roleTitle.trim() || (isStarterJob ? '' : job.roleTitle),
    direction: draft.direction.trim() || (isStarterJob ? '' : job.direction),
    jdText: draft.jdText.trim()
  };
}

function buildParserFallbackJob(
  job: JobFile,
  draft: FocusJobDraft
): JobFile | undefined {
  const context = buildUserJobContext(job, draft);
  const hasFallbackContext = Boolean(
    context.company || context.roleTitle || context.direction || context.jdText
  );

  if (!hasFallbackContext) return undefined;

  return {
    ...job,
    company: context.company,
    roleTitle: context.roleTitle,
    direction: context.direction,
    jdText: context.jdText
  };
}

function buildRecognitionSummary(draft: InterviewMaterialDraft) {
  const questionCount = draft.interviewItems.filter((item) =>
    item.question?.trim()
  ).length;
  const followUpCount = draft.interviewItems.reduce(
    (count, item) => count + (item.followUps?.length ?? 0),
    0
  );
  const weaknessCount = draft.interviewItems.filter((item) =>
    item.issue?.trim()
  ).length;
  const lowConfidenceItemCount = draft.interviewItems.filter(
    (item) => item.confidence === 'low'
  ).length;
  const lowConfidenceCount =
    lowConfidenceItemCount + draft.missingInfoWarnings.length;
  const targetRole =
    [
      draft.jobContext.company,
      draft.jobContext.role,
      draft.jobContext.direction
    ]
      .filter(Boolean)
      .join(' · ') || '待确认岗位';
  const suggestions = [
    ...(!draft.jobContext.company
      ? ['建议补充目标公司，方便后续查看来源。']
      : []),
    ...(!draft.jobContext.role
      ? ['建议补充目标岗位，避免回答保存到错误岗位。']
      : []),
    ...(!draft.jobContext.direction
      ? ['建议补充岗位方向，方便同方向岗位复用。']
      : []),
    ...(lowConfidenceItemCount > 0
      ? [
          `有 ${lowConfidenceItemCount} 条低置信草稿，保存前建议补充原问题、原回答或复盘判断。`
        ]
      : [])
  ];

  return {
    metrics: [
      { label: '目标岗位', value: targetRole },
      { label: '问题数', value: String(questionCount) },
      { label: '追问数', value: String(followUpCount) },
      { label: '薄弱点', value: String(weaknessCount) },
      { label: '待确认项', value: String(lowConfidenceCount) }
    ],
    suggestions
  };
}

function FlowStep({
  active,
  done,
  index,
  label
}: {
  active: boolean;
  done: boolean;
  index: number;
  label: string;
}) {
  return (
    <article
      className={
        done
          ? 'focus-step focus-step--done'
          : active
            ? 'focus-step focus-step--active'
            : 'focus-step'
      }
    >
      <span>{done ? <Check size={13} /> : index}</span>
      <strong>{label}</strong>
    </article>
  );
}
