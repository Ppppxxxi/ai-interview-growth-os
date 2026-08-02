import { useEffect, useState } from 'react';
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
  onSaveInterviewRecord: (session: InterviewSession, review: ReviewReport) => void;
  onSaveAsset: (asset: AnswerAsset) => void;
  onFinish: (target: 'workspace' | 'assets') => void;
  onUseExample: () => void;
};

type FocusJobDraft = {
  company: string;
  roleTitle: string;
  direction: string;
  jdText: string;
};

const focusMaterialExample = `公司：晴川智能
岗位：AI 产品经理
方向：AI + 企业知识库助手

JD 摘要：
负责企业知识库助手的需求分析、用户反馈闭环、效果评估和跨团队协作。

面试记录：
面试官问我如何判断 AI 助手是否真的提升知识检索效率。我当时只回答可以看满意度和使用次数。
面试官追问：这些指标如何证明员工真的更快解决问题？
我的复盘：回答没有拆过程指标、结果指标和长期复用指标，也没有说明低置信回答如何兜底。`;

export function FocusFlowPage({
  jobFiles,
  onFinish,
  onSaveAsset,
  onSaveInterviewRecord,
  onUpdateJob,
  onUseExample,
  selectedJobId
}: FocusFlowPageProps) {
  const selectedJob = jobFiles.find((job) => job.id === selectedJobId) ?? jobFiles[0];
  const [jobDraft, setJobDraft] = useState<FocusJobDraft>(() => createFocusJobDraft(selectedJob));
  const [materialText, setMaterialText] = useState('');
  const [materialDraft, setMaterialDraft] = useState<InterviewMaterialDraft | undefined>();
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => new Set());
  const [confirmedItemStatuses, setConfirmedItemStatuses] = useState<Map<string, AnswerAssetConfirmationStatus>>(() => new Map());
  const [answersGenerated, setAnswersGenerated] = useState(false);
  const [savedSummary, setSavedSummary] = useState<{ sessionId: string; assetCount: number } | undefined>();

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
  const selectedCount = materialDraft ? materialDraft.interviewItems.filter((item) => selectedItemIds.has(item.id)).length : 0;
  const confirmedCount = confirmedItemStatuses.size;
  const flowStep = savedSummary ? 4 : answersGenerated ? 3 : materialDraft ? 2 : hasMaterial ? 1 : 0;
  const recognitionSummary = materialDraft ? buildRecognitionSummary(materialDraft) : undefined;

  function updateJobDraft(field: keyof FocusJobDraft, value: string) {
    setJobDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function currentJob(): JobFile {
    const isStarterJob = isEmptyStarterJob(selectedJob);
    const jobContext = buildUserJobContext(selectedJob, jobDraft);
    const company = jobContext.company || (isStarterJob ? '未填写公司' : selectedJob.company);
    const roleTitle = jobContext.roleTitle || (isStarterJob ? '未填写岗位' : selectedJob.roleTitle);
    const direction = jobContext.direction || (isStarterJob ? '待确认方向' : selectedJob.direction);

    return {
      ...selectedJob,
      company,
      roleTitle,
      direction,
      jdText: jobDraft.jdText.trim(),
      status: selectedJob.status === '待粘贴 JD 和面试对话' ? '已开始准备' : selectedJob.status
    };
  }

  function handleFillExample() {
    setJobDraft({
      company: '晴川智能',
      roleTitle: 'AI 产品经理',
      direction: 'AI + 企业知识库助手',
      jdText: '负责企业知识库助手的需求分析、用户反馈闭环、效果评估和跨团队协作。'
    });
    setMaterialText(focusMaterialExample);
    setMaterialDraft(undefined);
    setSelectedItemIds(new Set());
    setConfirmedItemStatuses(new Map());
    setAnswersGenerated(false);
    setSavedSummary(undefined);
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
      new Set(draft.interviewItems.filter((item) => item.answerAssetCandidate && item.confidence !== 'low').map((item) => item.id))
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
    field: 'title' | 'question' | 'originalAnswer' | 'issue' | 'improvementSuggestion' | 'improvedAnswer',
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

  function handleConfirmItem(itemId: string, status: Extract<AnswerAssetConfirmationStatus, 'accepted' | 'edited-accepted'>) {
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
          <p className="eyebrow">开始新一场面试</p>
          <h1>粘贴 JD、面试记录或模拟面试对话</h1>
          <p>先生成可确认草稿，再把下次能用的回答保存到我的回答库。首次使用不需要进入工作台配置。</p>
        </div>
        <div className="focus-flow-hero-actions">
          <button className="ghost-action" type="button" onClick={handleFillExample}>
            填入示例
          </button>
          <button className="secondary-action" type="button" onClick={onUseExample}>
            使用完整示例数据
          </button>
        </div>
      </header>

      <div className="focus-flow-steps" aria-label="当前流程">
        <FlowStep active={flowStep === 0 || flowStep === 1} done={flowStep > 1} index={1} label="粘贴材料" />
        <FlowStep active={flowStep === 2} done={flowStep > 2} index={2} label="确认识别结果" />
        <FlowStep active={flowStep === 3} done={flowStep > 3} index={3} label="生成回答" />
        <FlowStep active={flowStep === 4} done={Boolean(savedSummary)} index={4} label="保存到我的回答库" />
      </div>

      <section className="focus-flow-card">
        <div className="section-heading">
          <p className="eyebrow">目标岗位</p>
          <h2>这场材料保存到哪个岗位</h2>
          <p>用于保存后归档和检索。不确定可以先留空，系统会优先从粘贴材料中识别。</p>
        </div>
        <div className="focus-job-grid">
          <label>
            <span>公司</span>
            <input
              value={jobDraft.company}
              placeholder="例如：晴川智能"
              onChange={(event) => updateJobDraft('company', event.target.value)}
            />
          </label>
          <label>
            <span>岗位</span>
            <input
              value={jobDraft.roleTitle}
              placeholder="例如：AI 产品经理"
              onChange={(event) => updateJobDraft('roleTitle', event.target.value)}
            />
          </label>
          <label>
            <span>方向</span>
            <input
              value={jobDraft.direction}
              placeholder="例如：AI + 企业知识库助手"
              onChange={(event) => updateJobDraft('direction', event.target.value)}
            />
          </label>
        </div>
        <label className="focus-full-field">
          <span>JD 或岗位信息</span>
          <textarea
            value={jobDraft.jdText}
            placeholder="可选。粘贴岗位职责、任职要求或你自己整理的岗位信息。"
            onChange={(event) => updateJobDraft('jdText', event.target.value)}
          />
        </label>
      </section>

      <section className="focus-flow-card focus-flow-card--primary">
        <div className="focus-material-heading">
          <div>
            <p className="eyebrow">面试材料</p>
            <h2>把你手头的材料直接粘贴进来</h2>
            <p>可以混合包含 JD、面试官问题、你的回答、追问、AI 点评和复盘笔记。</p>
          </div>
          <button className="primary-action" type="button" onClick={handleParseMaterial} disabled={!hasMaterial}>
            解析材料
          </button>
        </div>
        <div className="focus-privacy-note" aria-label="隐私与本地保存说明">
          <strong>本地处理：</strong>
          当前版本仅保存在本机浏览器，不接真实 LLM，不上传服务器。保存前请确认材料已去除真实公司、姓名和联系方式。
        </div>
        <textarea
          className="focus-material-input"
          value={materialText}
          placeholder={'例如：\n公司/岗位/JD\n面试官问了什么\n我当时怎么答\n面试官追问了什么\nAI 或我自己的复盘点评'}
          onChange={(event) => setMaterialText(event.target.value)}
        />
      </section>

      {materialDraft && (
        <section className="focus-flow-card">
          <div className="focus-draft-heading">
            <div>
              <p className="eyebrow">确认识别结果</p>
              <h2>{materialDraft.globalInsights.summary}</h2>
              <p>
                {answersGenerated
                  ? `已生成 ${selectedCount} 条下次可用回答，其中 ${confirmedCount} 条已确认采用。`
                  : '先确认系统识别是否正确，再生成下次可用回答。'}
              </p>
            </div>
            {answersGenerated ? (
              <button className="primary-action" type="button" onClick={handleSave}>
                {confirmedCount > 0 ? '保存到我的回答库' : '只保存复盘记录'}
              </button>
            ) : (
              <button className="primary-action" type="button" onClick={handleGenerateAnswers} disabled={selectedCount === 0}>
                生成下次可用回答
              </button>
            )}
          </div>
          {recognitionSummary && (
            <div className="focus-recognition-summary" aria-label="识别摘要">
              {recognitionSummary.metrics.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          )}
          {materialDraft.missingInfoWarnings.length > 0 && (
            <div className="material-warning-list">
              {materialDraft.missingInfoWarnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}
          {recognitionSummary && recognitionSummary.suggestions.length > 0 && (
            <div className="focus-low-confidence-hints">
              <strong>建议先确认</strong>
              <ul>
                {recognitionSummary.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="focus-draft-list">
            {materialDraft.interviewItems.map((item, index) => (
              <article className="focus-draft-card" key={item.id}>
                <div className="focus-draft-card-title">
                  <label>
                    <span>问题类型 {index + 1}</span>
                    <input value={item.title} onChange={(event) => handleDraftItemChange(item.id, 'title', event.target.value)} />
                  </label>
                  <label className={item.answerAssetCandidate ? 'material-save-check' : 'material-save-check material-save-check--disabled'}>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id)}
                      disabled={!item.answerAssetCandidate}
                      onChange={() => handleToggleItem(item.id)}
                    />
                    <span>{item.answerAssetCandidate ? '保存这条回答' : '只保存为复盘记录'}</span>
                  </label>
                </div>
                <div className="focus-draft-grid">
                  <label>
                    <span>识别到的问题</span>
                    <textarea value={item.question ?? ''} onChange={(event) => handleDraftItemChange(item.id, 'question', event.target.value)} />
                  </label>
                  <label>
                    <span>你的原回答或材料片段</span>
                    <textarea
                      value={item.originalAnswer ?? ''}
                      onChange={(event) => handleDraftItemChange(item.id, 'originalAnswer', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>具体问题</span>
                    <textarea value={item.issue ?? ''} onChange={(event) => handleDraftItemChange(item.id, 'issue', event.target.value)} />
                  </label>
                  <label>
                    <span>建议这样改</span>
                    <textarea
                      value={item.improvementSuggestion ?? ''}
                      onChange={(event) => handleDraftItemChange(item.id, 'improvementSuggestion', event.target.value)}
                    />
                  </label>
                </div>
                {answersGenerated && selectedItemIds.has(item.id) && (
                  <>
                    <div className="focus-answer-rationale">
                      <strong>改动依据</strong>
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
                          <dd>{item.improvementSuggestion || '补充结构、判断依据和可验证指标。'}</dd>
                        </div>
                        <div>
                          <dt>适用边界</dt>
                          <dd>{buildAnswerBoundary(jobDraft, item)}</dd>
                        </div>
                      </dl>
                    </div>
                    <label className="focus-answer-field">
                      <span>下次可用回答</span>
                      <textarea
                        value={item.improvedAnswer ?? ''}
                        onChange={(event) => handleDraftItemChange(item.id, 'improvedAnswer', event.target.value)}
                      />
                    </label>
                    <div className="focus-answer-confirmation" aria-label="回答确认">
                      <span>{confirmationLabel(confirmedItemStatuses.get(item.id))}</span>
                      <button type="button" className="secondary-action" onClick={() => handleConfirmItem(item.id, 'accepted')}>
                        采用
                      </button>
                      <button type="button" className="secondary-action" onClick={() => handleConfirmItem(item.id, 'edited-accepted')}>
                        修改后采用
                      </button>
                      <button type="button" className="ghost-action" onClick={() => handleSkipItem(item.id)}>
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
          <h2>这场面试已经沉淀下来</h2>
          <p>
            已保存 1 场面试记录和 {savedSummary.assetCount} 条回答。你可以继续管理这场复盘，也可以直接查看我的回答库。
          </p>
          <div className="focus-success-actions">
            <button className="primary-action" type="button" onClick={() => onFinish('workspace')}>
              查看工作台
            </button>
            <button className="secondary-action" type="button" onClick={() => onFinish('assets')}>
              打开我的回答库
            </button>
            <button className="ghost-action" type="button" onClick={handleStartNext}>
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
  if (status === 'edited-accepted') return '已标记为修改后采用';
  return '尚未确认，默认不会保存到我的回答库';
}

function buildAnswerBoundary(jobDraft: FocusJobDraft, item: { confidence: 'high' | 'medium' | 'low' }) {
  const direction = jobDraft.direction.trim() || '同方向岗位';
  const confidenceNote = item.confidence === 'low' ? '这条是低置信草稿，使用前必须补充真实经历。' : '使用前仍需核对是否符合你的真实经历。';

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
    job.roleTitle === 'AI 产品经理' &&
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

function buildParserFallbackJob(job: JobFile, draft: FocusJobDraft): JobFile | undefined {
  const context = buildUserJobContext(job, draft);
  const hasFallbackContext = Boolean(context.company || context.roleTitle || context.direction || context.jdText);

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
  const questionCount = draft.interviewItems.filter((item) => item.question?.trim()).length;
  const followUpCount = draft.interviewItems.reduce((count, item) => count + (item.followUps?.length ?? 0), 0);
  const weaknessCount = draft.interviewItems.filter((item) => item.issue?.trim()).length;
  const lowConfidenceItemCount = draft.interviewItems.filter((item) => item.confidence === 'low').length;
  const lowConfidenceCount = lowConfidenceItemCount + draft.missingInfoWarnings.length;
  const targetRole = [draft.jobContext.company, draft.jobContext.role, draft.jobContext.direction].filter(Boolean).join(' · ') || '待确认岗位';
  const suggestions = [
    ...(!draft.jobContext.company ? ['建议补充目标公司，方便后续查看来源。'] : []),
    ...(!draft.jobContext.role ? ['建议补充目标岗位，避免回答保存到错误岗位。'] : []),
    ...(!draft.jobContext.direction ? ['建议补充岗位方向，方便同方向岗位复用。'] : []),
    ...(lowConfidenceItemCount > 0 ? [`有 ${lowConfidenceItemCount} 条低置信草稿，保存前建议补充原问题、原回答或复盘判断。`] : [])
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

function FlowStep({ active, done, index, label }: { active: boolean; done: boolean; index: number; label: string }) {
  return (
    <article className={done ? 'focus-step focus-step--done' : active ? 'focus-step focus-step--active' : 'focus-step'}>
      <span>{done ? '完成' : index}</span>
      <strong>{label}</strong>
    </article>
  );
}
