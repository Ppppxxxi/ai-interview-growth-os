import { useEffect, useState } from 'react';
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

type FocusFlowPageProps = {
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
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set()
  );
  const [confirmedItemStatuses, setConfirmedItemStatuses] = useState<
    Map<string, AnswerAssetConfirmationStatus>
  >(() => new Map());
  const [answersGenerated, setAnswersGenerated] = useState(false);
  const [savedSummary, setSavedSummary] = useState<
    { sessionId: string; assetCount: number } | undefined
  >();
  const [activeItemId, setActiveItemId] = useState('');

  useEffect(() => {
    setJobDraft(createFocusJobDraft(selectedJob));
    setMaterialText('');
    setMaterialDraft(undefined);
    setSelectedItemIds(new Set());
    setConfirmedItemStatuses(new Map());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }, [selectedJob.id]);

  const hasMaterial = materialText.trim().length > 0;
  const selectedCount = materialDraft
    ? materialDraft.interviewItems.filter((item) =>
        selectedItemIds.has(item.id)
      ).length
    : 0;
  const confirmedCount = confirmedItemStatuses.size;
  const flowStep = savedSummary
    ? 4
    : answersGenerated
      ? 3
      : materialDraft
        ? 2
        : hasMaterial
          ? 1
          : 0;
  const recognitionSummary = materialDraft
    ? buildRecognitionSummary(materialDraft)
    : undefined;
  const stageItems =
    materialDraft?.interviewItems.filter(
      (item) => !answersGenerated || selectedItemIds.has(item.id)
    ) ?? [];
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
    setSelectedItemIds(
      new Set(
        draft.interviewItems
          .filter(
            (item) => item.answerAssetCandidate && item.confidence !== 'low'
          )
          .map((item) => item.id)
      )
    );
    setConfirmedItemStatuses(new Map());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }

  function handleToggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
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
    if (field === 'improvedAnswer') {
      setConfirmedItemStatuses((current) => {
        if (current.get(itemId) !== 'accepted') return current;
        const next = new Map(current);
        next.set(itemId, 'edited-accepted');
        return next;
      });
    }

    setMaterialDraft((current) =>
      current
        ? {
            ...current,
            interviewItems: current.interviewItems.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    [field]: value
                  }
                : item
            )
          }
        : current
    );
  }

  function handleGenerateAnswers() {
    setAnswersGenerated(true);
    setConfirmedItemStatuses(new Map());
  }

  function handleConfirmItem(
    itemId: string,
    status: Extract<
      AnswerAssetConfirmationStatus,
      'accepted' | 'edited-accepted'
    >
  ) {
    setConfirmedItemStatuses((current) => {
      const next = new Map(current);
      next.set(itemId, status);
      return next;
    });
  }

  function handleSkipItem(itemId: string) {
    setConfirmedItemStatuses((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
  }

  function handleSave() {
    if (!materialDraft || !answersGenerated) return;

    const job = currentJob();
    onUpdateJob(job);
    const payload = buildMaterialImportSavePayload({
      draft: materialDraft,
      selectedItemIds: confirmedItemStatuses.keys(),
      confirmationStatuses: confirmedItemStatuses,
      job,
      rawText: materialText,
      runId: Date.now().toString(36)
    });

    onSaveInterviewRecord(payload.session, payload.review);
    payload.assets.forEach((asset) => onSaveAsset(asset));
    setSavedSummary({
      sessionId: payload.session.id,
      assetCount: payload.assets.length
    });
  }

  function handleStartNext() {
    setMaterialText('');
    setMaterialDraft(undefined);
    setSelectedItemIds(new Set());
    setConfirmedItemStatuses(new Map());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
  }

  return (
    <section className="focus-flow-page">
      <header className="focus-flow-hero">
        <div>
          <p className="eyebrow">面试成长</p>
          <h1>
            {savedSummary
              ? '已保存'
              : answersGenerated
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

      {materialDraft && !savedSummary && (
        <section className="focus-flow-card">
          <div className="focus-draft-heading">
            <div>
              <button
                className="ghost-action"
                type="button"
                onClick={() =>
                  answersGenerated
                    ? setAnswersGenerated(false)
                    : setMaterialDraft(undefined)
                }
              >
                <ArrowLeft size={15} />
                {answersGenerated ? '返回问题' : '编辑材料'}
              </button>
              <h2>
                {answersGenerated
                  ? `${confirmedCount} / ${selectedCount} 条已采用`
                  : `${materialDraft.interviewItems.length} 个问题`}
              </h2>
            </div>
            {answersGenerated ? (
              <button
                className="primary-action"
                type="button"
                onClick={handleSave}
              >
                <CheckCheck size={16} />
                {confirmedCount > 0 ? '保存到我的回答库' : '只保存复盘记录'}
              </button>
            ) : (
              <button
                className="primary-action"
                type="button"
                onClick={handleGenerateAnswers}
                disabled={selectedCount === 0}
              >
                <Sparkles size={16} />
                生成下次可用回答
              </button>
            )}
          </div>
          {recognitionSummary && !answersGenerated && (
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
            !answersGenerated && (
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
            !answersGenerated && (
              <details className="focus-low-confidence-hints">
                <summary>待确认项</summary>
                <ul>
                  {recognitionSummary.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </details>
            )}
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
                {confirmedItemStatuses.has(item.id) && <Check size={13} />}
              </button>
            ))}
          </div>
          <div className="focus-draft-list">
            {activeItem &&
              [activeItem].map((item) => (
                <article className="focus-draft-card" key={item.id}>
                  <div className="focus-draft-card-title">
                    {answersGenerated ? (
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
                    {!answersGenerated && (
                      <label
                        className={
                          item.answerAssetCandidate
                            ? 'material-save-check'
                            : 'material-save-check material-save-check--disabled'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          disabled={!item.answerAssetCandidate}
                          onChange={() => handleToggleItem(item.id)}
                        />
                        <span>
                          {item.answerAssetCandidate ? '生成回答' : '仅复盘'}
                        </span>
                      </label>
                    )}
                  </div>
                  {!answersGenerated && (
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
                  {answersGenerated && selectedItemIds.has(item.id) && (
                    <>
                      <details className="focus-answer-rationale">
                        <summary>改写依据与适用范围</summary>
                        <dl>
                          <div>
                            <dt>来源问题</dt>
                            <dd>{item.question || item.title}</dd>
                          </div>
                          <div>
                            <dt>原回答暴露的问题</dt>
                            <dd>{item.issue || '需要补充具体问题点。'}</dd>
                          </div>
                          <div>
                            <dt>本次改写重点</dt>
                            <dd>
                              {item.improvementSuggestion ||
                                '补充结构、判断依据和可验证指标。'}
                            </dd>
                          </div>
                          <div>
                            <dt>适用边界</dt>
                            <dd>{buildAnswerBoundary(jobDraft, item)}</dd>
                          </div>
                        </dl>
                      </details>
                      <label className="focus-answer-field">
                        <span>下次可用回答</span>
                        <textarea
                          value={item.improvedAnswer ?? ''}
                          onChange={(event) =>
                            handleDraftItemChange(
                              item.id,
                              'improvedAnswer',
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <div
                        className="focus-answer-confirmation"
                        aria-label="回答确认"
                      >
                        <span>
                          {confirmationLabel(
                            confirmedItemStatuses.get(item.id)
                          )}
                        </span>
                        <button
                          type="button"
                          className="secondary-action"
                          aria-pressed={
                            confirmedItemStatuses.get(item.id) === 'accepted'
                          }
                          onClick={() => handleConfirmItem(item.id, 'accepted')}
                        >
                          <Check size={15} />
                          采用
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          aria-pressed={
                            confirmedItemStatuses.get(item.id) ===
                            'edited-accepted'
                          }
                          onClick={() =>
                            handleConfirmItem(item.id, 'edited-accepted')
                          }
                        >
                          修改后采用
                        </button>
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={() => handleSkipItem(item.id)}
                        >
                          暂不保存
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
          </div>
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
    </section>
  );
}

function confirmationLabel(status: AnswerAssetConfirmationStatus | undefined) {
  if (status === 'accepted') return '已确认采用';
  if (status === 'edited-accepted') return '修改后采用';
  return '待确认';
}

function buildAnswerBoundary(
  jobDraft: FocusJobDraft,
  item: { confidence: 'high' | 'medium' | 'low' }
) {
  const direction = jobDraft.direction.trim() || '同方向岗位';
  const confidenceNote =
    item.confidence === 'low'
      ? '这条是低置信草稿，使用前必须补充真实经历。'
      : '使用前仍需核对是否符合你的真实经历。';

  return `优先用于${direction}的同岗位多轮或同方向类似问题；跨岗位使用前需要重新贴合业务场景。${confidenceNote}`;
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
