import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { analyzeJd } from '../agents/jdAnalyst';
import { matchExperiences } from '../agents/experienceMatcher';
import { parseInterviewMaterial } from '../agents/materialImportParser';
import { generateMockInterview } from '../agents/mockInterview';
import { coldStartDemo, experiences, jobFiles as sampleJobFiles, trainingTasks } from '../domain/sampleData';
import type {
  AnswerAsset,
  InterviewMaterialDraft,
  InterviewMaterialInputType,
  InterviewSession,
  JobFile,
  ReviewReport
} from '../domain/types';
import { completeAnalysis, createWorkspaceState, saveGeneratedAsset, startAnalysis } from '../workflow/demoFlow';
import { buildAnswerExplanation } from '../workflow/answerExplanation';
import {
  createEditableQuestions,
  hasUsableQuestion,
  updateQuestionField,
  updateQuestionFollowUps
} from '../workflow/conversationDraft';
import { buildDemoPipelineResult } from '../workflow/demoPipeline';
import { downloadMarkdown } from '../workflow/downloadMarkdown';
import {
  buildInterviewReviewMarkdown,
  buildJobPrepMarkdown,
  createMarkdownFileName
} from '../workflow/markdownExport';
import { buildMaterialImportSavePayload } from '../workflow/materialImportDraft';
import type { NewJobDraft } from '../workflow/personalWorkspace';

type JobFileDetailProps = {
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  jobFiles: JobFile[];
  interviewSessions: InterviewSession[];
  reviewReports: ReviewReport[];
  answerAssets: AnswerAsset[];
  onCreateJob: (draft: NewJobDraft) => void;
  onUpdateJob: (job: JobFile) => void;
  onDeleteJob: (jobId: string) => void;
  onSaveInterviewRecord: (session: InterviewSession, review: ReviewReport) => void;
  onDeleteInterviewRecord: (sessionId: string) => void;
  onSaveAsset: (asset: AnswerAsset) => void;
  onOpenAssets?: () => void;
};

type JobEditDraft = {
  company: string;
  roleTitle: string;
  direction: string;
  stage: string;
};

const emptyJobForm: NewJobDraft = {
  company: '',
  roleTitle: '',
  direction: 'AI 产品经理',
  jdText: '',
  stage: '准备中'
};

const demoJobDraft: NewJobDraft = {
  company: sampleJobFiles[0]?.company ?? '星河智能',
  roleTitle: sampleJobFiles[0]?.roleTitle ?? 'AI 产品经理实习生',
  direction: sampleJobFiles[0]?.direction ?? 'AI 产品经理',
  jdText: sampleJobFiles[0]?.jdText ?? '',
  stage: '准备中'
};

const materialTypeOptions: Array<{ value: InterviewMaterialInputType; label: string }> = [
  { value: 'auto', label: '自动识别' },
  { value: 'mock_interview_dialogue', label: 'AI 模拟面试对话' },
  { value: 'real_interview_memory', label: '真实面试回忆' },
  { value: 'review_notes', label: '复盘笔记' },
  { value: 'mixed_material', label: '混合材料' }
];

const materialExample = `公司：新国都
岗位：AI 产品经理
方向：AI + 支付商户服务

面试复盘：
面试官问我为什么投递新国都，我只回答了自己看好 AI + 支付方向，没有把商户服务场景、公司业务和岗位职责连起来。

AB 实验分流机制答得比较空。我只说可以看转化率，没有说明实验目标、实验组/对照组、核心指标、护栏指标和异常处理。

评测口径和指标体系没有分层。面试官追问如何证明 AI 助手真的提升商户服务效率，我只说满意度和使用次数。

AI Agent 链路拆解也不完整。我讲了“导入材料、生成回答”，但没有讲清楚输入输出、用户确认点、低置信兜底和保存后的复用边界。`;

export function JobFileDetail({
  answerAssets,
  selectedJobId,
  jobFiles,
  interviewSessions,
  reviewReports,
  onCreateJob,
  onDeleteJob,
  onDeleteInterviewRecord,
  onSaveAsset,
  onSaveInterviewRecord,
  onSelectJob,
  onUpdateJob,
  onOpenAssets
}: JobFileDetailProps) {
  const selectedJob = jobFiles.find((jobFile) => jobFile.id === selectedJobId) ?? jobFiles[0];
  const [newJobForm, setNewJobForm] = useState(emptyJobForm);
  const [jobEditForm, setJobEditForm] = useState<JobEditDraft>(() => createJobEditDraft(selectedJob));
  const jobSessions = useMemo(() => {
    const sessionsById = new Map(interviewSessions.map((session) => [session.id, session]));
    const linkedSessions = selectedJob.interviewSessionIds
      .map((sessionId) => sessionsById.get(sessionId))
      .filter((session): session is InterviewSession => Boolean(session));
    const orphanSessions = interviewSessions.filter(
      (session) => session.jobFileId === selectedJob.id && !selectedJob.interviewSessionIds.includes(session.id)
    );

    return [...linkedSessions, ...orphanSessions];
  }, [interviewSessions, selectedJob.id, selectedJob.interviewSessionIds]);
  const primarySession = useMemo(
    () => jobSessions[0] ?? createDraftSession(selectedJob),
    [jobSessions, selectedJob]
  );
  const primaryReview = useMemo(
    () => reviewReports.find((report) => report.sessionId === primarySession.id) ?? createDraftReview(selectedJob, primarySession),
    [primarySession, selectedJob]
  );
  const primaryAsset = useMemo(
    () =>
      answerAssets.find((asset) => asset.sourceInterviewId === primarySession.id) ??
      answerAssets.find((asset) => asset.sourceJobId === selectedJob.id) ??
      createDraftAsset(selectedJob, primarySession.id, primaryReview.id),
    [answerAssets, primaryReview.id, primarySession.id, selectedJob]
  );
  const initialConversationText = primarySession.rawConversation || (primarySession.id.endsWith('-draft') ? '' : coldStartDemo.importedConversation);
  const profile = selectedJob.profile ?? analyzeJd(selectedJob.jdText, selectedJob.direction);
  const matches = matchExperiences(profile, experiences);
  const mockSession = generateMockInterview(selectedJob.id, profile, experiences);
  const initialState = useMemo(
    () => createWorkspaceState(selectedJob, primarySession, primaryReview, primaryAsset),
    [primaryAsset, primaryReview, primarySession, selectedJob]
  );
  const [workspaceState, setWorkspaceState] = useState(initialState);
  const [jdText, setJdText] = useState(selectedJob.jdText);
  const [conversationText, setConversationText] = useState(initialConversationText);
  const [generatedSession, setGeneratedSession] = useState(primarySession);
  const [generatedReview, setGeneratedReview] = useState(primaryReview);
  const [generatedAsset, setGeneratedAsset] = useState(primaryAsset);
  const [editableAnswer, setEditableAnswer] = useState(primaryAsset.improvedAnswer);
  const [editableQuestions, setEditableQuestions] = useState(() => createEditableQuestions(initialConversationText, primarySession.questions));
  const [selectedRecordId, setSelectedRecordId] = useState(primarySession.id);
  const [materialType, setMaterialType] = useState<InterviewMaterialInputType>('auto');
  const [materialText, setMaterialText] = useState('');
  const [materialDraft, setMaterialDraft] = useState<InterviewMaterialDraft | undefined>();
  const [selectedMaterialItemIds, setSelectedMaterialItemIds] = useState<Set<string>>(() => new Set());
  const answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setJobEditForm(createJobEditDraft(selectedJob));
    setWorkspaceState(initialState);
    setJdText(selectedJob.jdText);
    setConversationText(initialConversationText);
    setGeneratedSession(primarySession);
    setGeneratedReview(primaryReview);
    setGeneratedAsset(primaryAsset);
    setEditableAnswer(primaryAsset.improvedAnswer);
    setEditableQuestions(createEditableQuestions(initialConversationText, primarySession.questions));
    setSelectedRecordId(primarySession.id);
    setMaterialText('');
    setMaterialDraft(undefined);
    setSelectedMaterialItemIds(new Set());
  }, [initialConversationText, initialState, primaryAsset, primaryReview, primarySession, selectedJob]);

  const linkedAssets = answerAssets.filter(
    (asset) => asset.sourceJobId === selectedJob.id || asset.applicableRoles.includes(selectedJob.direction)
  );
  const linkedTrainingTasks = trainingTasks.filter((task) => task.jobFileId === selectedJob.id);
  const onboardingSteps = [
    {
      title: '确认岗位档案',
      description: selectedJob.jdText ? `${selectedJob.company} · ${selectedJob.roleTitle}` : '先保存岗位 JD，后续复盘会绑定到这个岗位。'
    },
    {
      title: '粘贴面试对话',
      description: conversationText.trim() ? '已填入外部 AI 模拟面试对话。' : '复制 ChatGPT、Claude 或其他 AI 工具里的模拟面试记录。'
    },
    {
      title: '生成复盘与回答',
      description: generatedReview.summary || '系统会整理原问题、原回答、问题点和优化回答。'
    },
    {
      title: '沉淀回答资产',
      description: linkedAssets.length > 0 ? `${linkedAssets.length} 条回答资产可在资产库检索复用。` : '确认后保存为回答资产，供下一场面试复用。'
    }
  ];
  const answerExplanation = buildAnswerExplanation({
    asset: generatedAsset,
    review: generatedReview,
    session: generatedSession
  });
  const relatedRecordAssets = answerAssets.filter((asset) => asset.sourceInterviewId === generatedSession.id);
  const detailAssets =
    relatedRecordAssets.length > 0 || generatedAsset.sourceInterviewId !== generatedSession.id
      ? relatedRecordAssets
      : [generatedAsset];
  const canDeleteSelectedRecord = jobSessions.some((session) => session.id === selectedRecordId);
  const hasConversationText = conversationText.trim().length > 0;
  const hasMaterialText = materialText.trim().length > 0;
  const materialSelectedCount = materialDraft
    ? materialDraft.interviewItems.filter((item) => selectedMaterialItemIds.has(item.id)).length
    : 0;
  const hasGeneratedResult = !generatedSession.id.endsWith('-draft');
  const canGenerate = jdText.trim().length > 0 && hasConversationText && workspaceState.status !== 'generating';
  const isExampleJob = sampleJobFiles.some((job) => job.id === selectedJob.id);

  function handleGenerate() {
    if (!canGenerate) return;

    const runId = `generated-${Date.now().toString(36)}`;
    const generated = buildDemoPipelineResult({
      job: { ...selectedJob, jdText },
      conversationText,
      fallbackConversationText: coldStartDemo.importedConversation,
      questionsOverride: hasUsableQuestion(editableQuestions) ? editableQuestions : undefined,
      runId
    });
    const generating = startAnalysis(workspaceState);
    setWorkspaceState(generating);
    window.setTimeout(() => {
      setGeneratedSession(generated.session);
      setGeneratedReview(generated.review);
      setGeneratedAsset(generated.asset);
      setEditableAnswer(generated.asset.improvedAnswer);
      setSelectedRecordId(generated.session.id);
      onSaveInterviewRecord(generated.session, generated.review);
      setWorkspaceState((current) =>
        completeAnalysis({
          ...current,
          session: generated.session,
          review: generated.review,
          generatedAsset: generated.asset
        })
      );
    }, 600);
  }

  function handleConfirmSaveAsset() {
    onSaveAsset({
      ...generatedAsset,
      improvedAnswer: editableAnswer
    });
    setWorkspaceState((current) => saveGeneratedAsset(current));
  }

  function handleSelectInterviewRecord(sessionId: string) {
    const session = jobSessions.find((item) => item.id === sessionId);
    if (!session) return;

    const review = reviewReports.find((item) => item.sessionId === session.id) ?? createDraftReview(selectedJob, session);
    const asset =
      answerAssets.find((item) => item.sourceInterviewId === session.id) ??
      createDraftAsset(selectedJob, session.id, review.id);
    const rawConversation = session.rawConversation || '';

    setSelectedRecordId(session.id);
    setGeneratedSession(session);
    setGeneratedReview(review);
    setGeneratedAsset(asset);
    setEditableAnswer(asset.improvedAnswer);
    setConversationText(rawConversation);
    setEditableQuestions(createEditableQuestions(rawConversation, session.questions));
    setWorkspaceState(
      completeAnalysis({
        ...createWorkspaceState(selectedJob, session, review, asset),
        session,
        review,
        generatedAsset: asset
      })
    );
  }

  function handleDeleteSelectedRecord() {
    const nextSession = jobSessions.find((session) => session.id !== selectedRecordId);
    onDeleteInterviewRecord(selectedRecordId);

    if (nextSession) {
      handleSelectInterviewRecord(nextSession.id);
      return;
    }

    const draftSession = createDraftSession(selectedJob);
    const draftReview = createDraftReview(selectedJob, draftSession);
    const draftAsset = createDraftAsset(selectedJob, draftSession.id, draftReview.id);

    setSelectedRecordId(draftSession.id);
    setGeneratedSession(draftSession);
    setGeneratedReview(draftReview);
    setGeneratedAsset(draftAsset);
    setEditableAnswer(draftAsset.improvedAnswer);
    setConversationText('');
    setEditableQuestions(createEditableQuestions('', draftSession.questions));
    setWorkspaceState(createWorkspaceState(selectedJob, draftSession, draftReview, draftAsset));
  }

  function handleContinueEditing() {
    answerTextareaRef.current?.focus();
  }

  function handleSkipSave() {
    setWorkspaceState((current) => ({
      ...current,
      status: 'idle'
    }));
  }

  function handleFillExample() {
    setJdText(selectedJob.jdText || demoJobDraft.jdText);
    setConversationText(coldStartDemo.importedConversation);
    setEditableQuestions(createEditableQuestions(coldStartDemo.importedConversation, primarySession.questions));
  }

  function handleFillMaterialExample() {
    setMaterialType('auto');
    setMaterialText(materialExample);
    setMaterialDraft(undefined);
    setSelectedMaterialItemIds(new Set());
  }

  function handleParseMaterial() {
    if (!hasMaterialText) return;

    const draft = parseInterviewMaterial({
      rawText: materialText,
      sourceType: materialType,
      fallbackJob: { ...selectedJob, jdText }
    });
    const defaultSelectedIds = draft.interviewItems
      .filter((item) => item.answerAssetCandidate && item.confidence !== 'low')
      .map((item) => item.id);
    setMaterialDraft(draft);
    setSelectedMaterialItemIds(new Set(defaultSelectedIds));
  }

  function handleToggleMaterialItem(itemId: string) {
    setSelectedMaterialItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleMaterialDraftItemChange(
    itemId: string,
    field: 'title' | 'question' | 'originalAnswer' | 'issue' | 'improvementSuggestion' | 'improvedAnswer',
    value: string
  ) {
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

  function handleSaveMaterialDraft() {
    if (!materialDraft) return;

    const payload = buildMaterialImportSavePayload({
      draft: materialDraft,
      selectedItemIds: selectedMaterialItemIds,
      job: { ...selectedJob, jdText },
      rawText: materialText,
      runId: Date.now().toString(36)
    });
    const nextAsset = payload.assets[0] ?? createDraftAsset(selectedJob, payload.session.id, payload.review.id);

    onSaveInterviewRecord(payload.session, payload.review);
    payload.assets.forEach((asset) => onSaveAsset(asset));
    setGeneratedSession(payload.session);
    setGeneratedReview(payload.review);
    setGeneratedAsset(nextAsset);
    setEditableAnswer(nextAsset.improvedAnswer);
    setSelectedRecordId(payload.session.id);
    setConversationText(materialText);
    setEditableQuestions(payload.session.questions);
    setWorkspaceState((current) => {
      const completed = completeAnalysis({
        ...current,
        session: payload.session,
        review: payload.review,
        generatedAsset: nextAsset
      });
      return payload.assets.length > 0 ? saveGeneratedAsset(completed) : completed;
    });
  }

  function handleFillNewJobExample() {
    setNewJobForm(demoJobDraft);
  }

  function handlePreviewParse() {
    setEditableQuestions(createEditableQuestions(conversationText, primarySession.questions));
  }

  function handleExportCurrentReview() {
    const markdown = buildInterviewReviewMarkdown({
      job: selectedJob,
      session: generatedSession,
      review: generatedReview,
      assets: detailAssets
    });

    downloadMarkdown(
      createMarkdownFileName([selectedJob.company, selectedJob.roleTitle, generatedSession.createdAt, '面试复盘']),
      markdown
    );
  }

  function handleExportJobPrepPack() {
    const sessionIds = new Set(jobSessions.map((session) => session.id));
    const jobReviews = reviewReports.filter(
      (review) => review.jobFileId === selectedJob.id || sessionIds.has(review.sessionId)
    );
    const savedJobAssets = answerAssets.filter(
      (asset) => asset.sourceJobId === selectedJob.id || asset.applicableRoles.includes(selectedJob.direction)
    );
    const jobAssets = upsertById([generatedAsset, ...savedJobAssets]);

    const markdown = buildJobPrepMarkdown({
      job: selectedJob,
      sessions: jobSessions.length > 0 ? jobSessions : [generatedSession],
      reviews: jobReviews.length > 0 ? jobReviews : [generatedReview],
      assets: jobAssets
    });

    downloadMarkdown(createMarkdownFileName([selectedJob.company, selectedJob.roleTitle, '考前准备包']), markdown);
  }

  function handleQuestionFieldChange(questionId: string, field: 'question' | 'answer' | 'feedback', value: string) {
    setEditableQuestions((current) => updateQuestionField(current, questionId, field, value));
  }

  function handleQuestionFollowUpsChange(questionId: string, value: string) {
    setEditableQuestions((current) => updateQuestionFollowUps(current, questionId, value));
  }

  function handleJobEditChange(field: keyof JobEditDraft, value: string) {
    setJobEditForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSaveCurrentJob() {
    const direction = jobEditForm.direction.trim() || selectedJob.direction;
    onUpdateJob({
      ...selectedJob,
      company: jobEditForm.company.trim() || selectedJob.company,
      roleTitle: jobEditForm.roleTitle.trim() || selectedJob.roleTitle,
      direction,
      stage: jobEditForm.stage.trim() || selectedJob.stage,
      jdText,
      profile: analyzeJd(jdText, direction),
      status: selectedJob.status === '待导入面试对话' ? '已保存 JD，待导入面试对话' : selectedJob.status
    });
  }

  function handleDeleteCurrentJob() {
    if (jobFiles.length <= 1) return;
    const confirmed = window.confirm(`删除「${selectedJob.company} ${selectedJob.roleTitle}」及其面试记录、复盘和回答资产？`);
    if (confirmed) {
      onDeleteJob(selectedJob.id);
    }
  }

  function handleNewJobChange(field: keyof NewJobDraft, value: string) {
    setNewJobForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleNewJobSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newJobForm.company.trim() || !newJobForm.roleTitle.trim() || !newJobForm.jdText.trim()) return;

    onCreateJob(newJobForm);
    setNewJobForm(emptyJobForm);
  }

  return (
    <div className="product-workspace" id="workspace">
      <aside className="workspace-sidebar">
        <div className="sidebar-heading">
          <p className="eyebrow">准备本场面试</p>
          <h2>准备中的岗位</h2>
        </div>
        <div className="file-list">
          {jobFiles.map((jobFile) => (
            <button
              className={jobFile.id === selectedJob.id ? 'file-tab file-tab--active' : 'file-tab'}
              key={jobFile.id}
              type="button"
              onClick={() => onSelectJob(jobFile.id)}
            >
              <strong>{jobFile.company}</strong>
              <span>{jobFile.roleTitle}</span>
              <small>{sampleJobFiles.some((job) => job.id === jobFile.id) ? `示例 · ${jobFile.status}` : jobFile.status}</small>
            </button>
          ))}
        </div>
        <form className="new-job-card" onSubmit={handleNewJobSubmit}>
          <div className="section-heading">
            <p className="eyebrow">本地保存</p>
            <h2>新建目标岗位</h2>
          </div>
          <p className="new-job-helper">填写公司、岗位和 JD 后，本场复盘会自动绑定到这个岗位。</p>
          <label>
            <span>公司</span>
            <input value={newJobForm.company} onChange={(event) => handleNewJobChange('company', event.target.value)} />
          </label>
          <label>
            <span>岗位</span>
            <input value={newJobForm.roleTitle} onChange={(event) => handleNewJobChange('roleTitle', event.target.value)} />
          </label>
          <label>
            <span>方向</span>
            <input value={newJobForm.direction} onChange={(event) => handleNewJobChange('direction', event.target.value)} />
          </label>
          <label>
            <span>阶段</span>
            <input value={newJobForm.stage} onChange={(event) => handleNewJobChange('stage', event.target.value)} />
          </label>
          <label>
            <span>JD</span>
            <textarea
              value={newJobForm.jdText}
              placeholder="粘贴岗位描述、职责要求和能力要求"
              onChange={(event) => handleNewJobChange('jdText', event.target.value)}
            />
          </label>
          <div className="new-job-actions">
            <button type="button" className="ghost-action" onClick={handleFillNewJobExample}>
              填入示例岗位
            </button>
            <button type="submit">保存岗位档案</button>
          </div>
        </form>
      </aside>

      <main className="workspace-center">
        <section className="workspace-header">
          <div>
            <p className="eyebrow">{selectedJob.company} · {selectedJob.roleTitle}</p>
            {isExampleJob && <span className="example-badge">示例数据</span>}
            <h1>导入面试材料，生成下次可用回答</h1>
            <p>把模拟面试对话、真实面试回忆或复盘笔记整理成可确认草稿，再保存为本岗位面试记录和回答资产。</p>
          </div>
          <button className="primary-action" type="button" onClick={handleGenerate} disabled={!canGenerate}>
            {workspaceState.status === 'generating' ? '正在生成...' : '生成复盘与优化回答'}
          </button>
        </section>

        <section className="material-import-panel">
          <div className="section-heading material-import-heading">
            <div>
              <p className="eyebrow">主入口</p>
              <h2>导入一整份面试材料</h2>
              <p>支持粘贴 AI 模拟面试对话、真实面试回忆、复盘笔记或混合材料。系统先生成草稿，你确认后再保存。</p>
            </div>
            <div className="material-import-actions">
              <button className="ghost-action" type="button" onClick={handleFillMaterialExample}>
                填入材料示例
              </button>
              <button className="primary-action" type="button" onClick={handleParseMaterial} disabled={!hasMaterialText}>
                解析材料
              </button>
            </div>
          </div>

          <div className="material-import-inputs">
            <label>
              <span>材料类型</span>
              <select
                value={materialType}
                onChange={(event) => setMaterialType(event.target.value as InterviewMaterialInputType)}
              >
                {materialTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>面试材料</span>
              <textarea
                value={materialText}
                placeholder={'粘贴一整段材料即可，例如：\n公司/岗位/JD\n面试官问了什么\n我当时怎么答\n追问和点评\n我自己的复盘笔记'}
                onChange={(event) => setMaterialText(event.target.value)}
              />
            </label>
          </div>

          {materialDraft ? (
            <div className="material-draft-panel">
              <div className="material-draft-summary">
                <div>
                  <strong>{materialDraft.globalInsights.summary}</strong>
                  <span>
                    识别为：{materialTypeOptions.find((option) => option.value === materialDraft.sourceType)?.label ?? '面试材料'} · 已勾选 {materialSelectedCount} 条回答资产
                  </span>
                </div>
                <button className="primary-action" type="button" onClick={handleSaveMaterialDraft}>
                  保存为面试记录与回答资产
                </button>
              </div>
              {materialDraft.missingInfoWarnings.length > 0 && (
                <div className="material-warning-list">
                  {materialDraft.missingInfoWarnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              )}
              <div className="material-draft-list">
                {materialDraft.interviewItems.map((item, index) => (
                  <article
                    className={
                      selectedMaterialItemIds.has(item.id)
                        ? 'material-draft-card material-draft-card--selected'
                        : 'material-draft-card'
                    }
                    key={item.id}
                  >
                    <div className="material-draft-card-heading">
                      <div>
                        <span>条目 {index + 1}</span>
                        <input
                          value={item.title}
                          onChange={(event) => handleMaterialDraftItemChange(item.id, 'title', event.target.value)}
                        />
                      </div>
                      <label className={item.answerAssetCandidate ? 'material-save-check' : 'material-save-check material-save-check--disabled'}>
                        <input
                          type="checkbox"
                          checked={selectedMaterialItemIds.has(item.id)}
                          disabled={!item.answerAssetCandidate}
                          onChange={() => handleToggleMaterialItem(item.id)}
                        />
                        <span>{item.answerAssetCandidate ? '保存为回答资产' : '仅保存为复盘记录'}</span>
                      </label>
                    </div>
                    <div className="material-draft-grid">
                      <label>
                        <span>原问题</span>
                        <textarea
                          value={item.question ?? ''}
                          onChange={(event) => handleMaterialDraftItemChange(item.id, 'question', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>原回答或材料片段</span>
                        <textarea
                          value={item.originalAnswer ?? ''}
                          onChange={(event) => handleMaterialDraftItemChange(item.id, 'originalAnswer', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>具体问题</span>
                        <textarea
                          value={item.issue ?? ''}
                          onChange={(event) => handleMaterialDraftItemChange(item.id, 'issue', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>建议这样改</span>
                        <textarea
                          value={item.improvementSuggestion ?? ''}
                          onChange={(event) => handleMaterialDraftItemChange(item.id, 'improvementSuggestion', event.target.value)}
                        />
                      </label>
                    </div>
                    <label className="material-improved-answer">
                      <span>下次可用回答</span>
                      <textarea
                        value={item.improvedAnswer ?? ''}
                        onChange={(event) => handleMaterialDraftItemChange(item.id, 'improvedAnswer', event.target.value)}
                      />
                    </label>
                    <div className="material-draft-meta">
                      <span>置信度：{item.confidence === 'high' ? '高' : item.confidence === 'medium' ? '中' : '低'}</span>
                      {item.assetCandidateReason && <span>{item.assetCandidateReason}</span>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <section className="empty-panel empty-panel--inline material-empty-panel">
              <h2>粘贴材料后先生成可确认草稿</h2>
              <p>草稿会拆出问题、原回答、具体问题、修改建议和可复用回答。你可以逐条编辑，再决定保存哪些回答资产。</p>
            </section>
          )}
        </section>

        <details className="job-edit-panel">
          <summary>编辑岗位信息</summary>
          <div className="section-heading job-edit-summary-heading">
            <p className="eyebrow">岗位档案</p>
            <h2>当前岗位信息</h2>
          </div>
          <div className="job-edit-grid">
            <label>
              <span>公司</span>
              <input value={jobEditForm.company} onChange={(event) => handleJobEditChange('company', event.target.value)} />
            </label>
            <label>
              <span>岗位</span>
              <input value={jobEditForm.roleTitle} onChange={(event) => handleJobEditChange('roleTitle', event.target.value)} />
            </label>
            <label>
              <span>方向</span>
              <input value={jobEditForm.direction} onChange={(event) => handleJobEditChange('direction', event.target.value)} />
            </label>
            <label>
              <span>阶段</span>
              <input value={jobEditForm.stage} onChange={(event) => handleJobEditChange('stage', event.target.value)} />
            </label>
          </div>
          <div className="job-edit-actions">
            <button className="secondary-action" type="button" onClick={handleSaveCurrentJob}>
              保存岗位信息
            </button>
            <button className="danger-action" type="button" onClick={handleDeleteCurrentJob} disabled={jobFiles.length <= 1}>
              删除当前岗位
            </button>
            {jobFiles.length <= 1 && <span>至少保留一个岗位档案。</span>}
          </div>
        </details>

        <section className="input-helper-panel">
          <div>
            <p className="eyebrow">快速开始</p>
            <h2>粘贴 JD 和一段模拟面试对话</h2>
            <p>支持直接复制 ChatGPT、Claude 或其他 AI 工具里的问答记录。生成后先查看依据，再决定是否保存为回答资产。</p>
          </div>
          <div className="input-helper-actions">
            <button className="secondary-action" type="button" onClick={handleFillExample}>
              使用示例内容
            </button>
            <button className="ghost-action" type="button" onClick={handleSaveCurrentJob}>
              保存当前 JD
            </button>
          </div>
        </section>

        <section className="onboarding-panel">
          {onboardingSteps.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="workspace-inputs">
          <label>
            <span>JD 文本</span>
            <textarea
              value={jdText}
              placeholder="粘贴目标岗位 JD。例如：岗位职责、任职要求、产品方向、能力关键词。"
              onChange={(event) => setJdText(event.target.value)}
            />
          </label>
          <label>
            <span>外部 AI 模拟面试对话</span>
            <textarea
              value={conversationText}
              placeholder={'粘贴 ChatGPT、Claude 或其他 AI 工具里的模拟面试记录。建议包含：\n面试官：...\n候选人：...\n面试官追问：...\nAI 点评：...'}
              onChange={(event) => setConversationText(event.target.value)}
            />
          </label>
        </section>

        <section className="parsed-conversation-panel">
          <div className="section-heading parsed-conversation-heading">
            <div>
              <p className="eyebrow">解析结果确认</p>
              <h2>检查问题和回答是否识别正确</h2>
              <p>如果识别错了，可以先改正，避免生成错误复盘。</p>
            </div>
            <button className="secondary-action" type="button" onClick={handlePreviewParse} disabled={!hasConversationText}>
              解析并预览
            </button>
          </div>
          {hasConversationText ? (
            <div className="parsed-question-list">
              {editableQuestions.map((question, index) => (
                <article className="parsed-question-card" key={question.id}>
                  <div className="parsed-question-title">
                    <strong>问题 {index + 1}</strong>
                    <span>{question.feedback ? '已识别点评' : '可手动补充点评'}</span>
                  </div>
                  <label>
                    <span>原问题</span>
                    <textarea
                      value={question.question}
                      onChange={(event) => handleQuestionFieldChange(question.id, 'question', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>原回答</span>
                    <textarea
                      value={question.answer}
                      onChange={(event) => handleQuestionFieldChange(question.id, 'answer', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>追问，每行一个</span>
                    <textarea
                      value={question.followUps.join('\n')}
                      onChange={(event) => handleQuestionFollowUpsChange(question.id, event.target.value)}
                    />
                  </label>
                  <label>
                    <span>AI 点评</span>
                    <textarea
                      value={question.feedback}
                      onChange={(event) => handleQuestionFieldChange(question.id, 'feedback', event.target.value)}
                    />
                  </label>
                </article>
              ))}
            </div>
          ) : (
            <section className="empty-panel empty-panel--inline">
              <h2>还没有可解析的面试对话</h2>
              <p>粘贴一段模拟面试记录后，点击“解析并预览”，这里会显示识别出的原问题、原回答、追问和点评。</p>
            </section>
          )}
        </section>

        {(hasConversationText || hasGeneratedResult) && (
          <section className="analysis-steps">
            {workspaceState.steps.map((step) => (
              <article className={`analysis-step analysis-step--${step.status}`} key={step.id}>
                <span>{step.status === 'done' ? '完成' : step.status === 'active' ? '进行中' : '等待'}</span>
                <strong>{step.label}</strong>
              </article>
            ))}
          </section>
        )}

        {hasGeneratedResult ? (
          <section className="interview-detail-panel">
          <div className="section-heading interview-detail-heading">
            <div>
              <p className="eyebrow">面试记录详情</p>
              <h2>{generatedSession.interviewType}</h2>
            </div>
            <div className="interview-detail-actions">
              <span>{generatedSession.createdAt}</span>
              <button className="secondary-action" type="button" onClick={handleExportCurrentReview}>
                导出本场复盘
              </button>
              <button className="ghost-action" type="button" onClick={handleExportJobPrepPack}>
                导出岗位准备包
              </button>
              {canDeleteSelectedRecord && (
                <button className="danger-action" type="button" onClick={handleDeleteSelectedRecord}>
                  删除这场记录
                </button>
              )}
            </div>
          </div>
          <div className="interview-detail-grid">
            <div className="interview-question-detail">
              {generatedSession.questions.map((question, index) => (
                <article key={question.id}>
                  <strong>问题 {index + 1}</strong>
                  <h3>{question.question}</h3>
                  <p>{question.answer}</p>
                  {question.followUps.length > 0 && <span>追问：{question.followUps.join(' / ')}</span>}
                  {question.feedback && <em>点评：{question.feedback}</em>}
                </article>
              ))}
            </div>
            <aside className="review-detail-card">
              <strong>本场复盘</strong>
              <p>{generatedReview.summary}</p>
              <div>
                <span>主要短板</span>
                <ul>
                  {generatedReview.weaknesses.map((weakness) => (
                    <li key={weakness}>{weakness}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span>下一步</span>
                <ul>
                  {generatedReview.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
          <div className="record-asset-row">
            <strong>关联回答资产</strong>
            {detailAssets.length > 0 ? (
              detailAssets.map((asset) => (
                <article key={asset.id}>
                  <span>{asset.questionType}</span>
                  <p>{asset.improvedAnswer}</p>
                </article>
              ))
            ) : (
              <p>这场记录还没有保存回答资产。</p>
            )}
          </div>
          </section>
        ) : (
          <section className="empty-result-panel">
            <p className="eyebrow">生成结果</p>
            <h2>生成后，这里会展示复盘和优化回答</h2>
            <p>你会看到原问题、原回答、具体问题点、修改依据，以及一条可编辑的优化回答。</p>
          </section>
        )}

        {hasGeneratedResult && <section className="compare-panel">
          <div className="compare-card compare-card--original">
            <p className="eyebrow">原回答</p>
            <h2>{generatedSession.questions[0]?.question}</h2>
            <p>{generatedSession.questions[0]?.answer}</p>
            <div className="issue-box">
              <strong>具体问题</strong>
              <p>{generatedAsset.issue}</p>
            </div>
            <p>{generatedReview.summary}</p>
          </div>

          <div className="compare-card compare-card--improved">
            <p className="eyebrow">优化回答</p>
            <h2>改成这样更完整</h2>
            <textarea ref={answerTextareaRef} value={editableAnswer} onChange={(event) => setEditableAnswer(event.target.value)} />
            <div className="compare-actions compare-actions--confirm">
              <button type="button" onClick={handleConfirmSaveAsset}>
                {workspaceState.status === 'assetSaved' ? '已确认保存' : '确认并保存'}
              </button>
              <button className="secondary-action" type="button" onClick={handleContinueEditing}>
                继续编辑
              </button>
              <button className="ghost-action" type="button" onClick={handleSkipSave}>
                暂不保存
              </button>
              <span>{generatedAsset.reuseScope}</span>
            </div>
          </div>
        </section>}

        {hasGeneratedResult && <section className="explanation-panel">
          <div className="section-heading">
            <p className="eyebrow">修改依据</p>
            <h2>为什么建议这样改</h2>
          </div>
          <div className="explanation-grid">
            <article>
              <strong>问题出在哪</strong>
              <p>{answerExplanation.issue}</p>
            </article>
            <article>
              <strong>依据来自哪里</strong>
              <p>{answerExplanation.evidence}</p>
            </article>
            <article>
              <strong>建议这样改</strong>
              <p>{answerExplanation.suggestion}</p>
            </article>
            <article>
              <strong>保存前确认</strong>
              <p>{answerExplanation.risk}</p>
            </article>
          </div>
        </section>}

        <section className="support-grid">
          <section className="panel">
            <div className="section-heading">
              <p className="eyebrow">岗位准备</p>
              <h2>JD 画像与经历匹配</h2>
            </div>
            <InfoList title="岗位要求" items={profile.responsibilities} />
            <div className="matched-list">
              {matches.slice(0, 2).map((match) => (
                <article key={match.experience.id}>
                  <strong>{match.experience.title}</strong>
                  <span>可讲述素材</span>
                  <p>{match.suggestedAngle}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <p className="eyebrow">模拟练习</p>
              <h2>内置模拟面试题</h2>
            </div>
            <div className="session-list">
              {mockSession.questions.slice(0, 3).map((question) => (
                <article key={question.id}>
                  <strong>{question.question}</strong>
                  <span>{question.followUps[0]}</span>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>

      <aside className="workspace-right">
        <section className="side-panel">
          <p className="eyebrow">该岗位面试记录</p>
          <h2>{jobSessions.length} 场记录</h2>
          <div className="interview-record-list">
            {jobSessions.length > 0 ? (
              jobSessions.slice(0, 5).map((session) => (
                <button
                  className={session.id === selectedRecordId ? 'interview-record-item interview-record-item--active' : 'interview-record-item'}
                  key={session.id}
                  type="button"
                  onClick={() => handleSelectInterviewRecord(session.id)}
                >
                  <strong>{session.interviewType}</strong>
                  <p>{session.questions[0]?.question ?? '暂无问题'}</p>
                  <span>{session.createdAt}</span>
                </button>
              ))
            ) : (
              <article>
                <strong>还没有面试记录</strong>
                <p>生成复盘后，这里会保存本岗位的面试记录。</p>
                <span>本地保存</span>
              </article>
            )}
          </div>
        </section>

        <section className="side-panel side-panel--asset">
          <p className="eyebrow">本岗位回答资产</p>
          <h2>{workspaceState.status === 'assetSaved' ? '已确认保存' : '待确认'}</h2>
          <strong>{generatedAsset.questionType}</strong>
          <p>{generatedAsset.applicableQuestions[0]}</p>
          <button type="button" onClick={onOpenAssets}>打开资产库</button>
        </section>

        <section className="side-panel">
          <p className="eyebrow">考前优先训练</p>
          <div className="side-list">
            {linkedTrainingTasks.map((task) => (
              <article key={task.id}>
                <strong>{task.goal}</strong>
                <p>{task.practiceQuestion}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="side-panel">
          <p className="eyebrow">下次可能被问</p>
          <div className="side-list">
            {profile.likelyQuestions.slice(0, 3).map((question, index) => (
              <article key={question}>
                <strong>问题 {index + 1}</strong>
                <p>{question}</p>
                <span>{linkedAssets[0]?.questionType ?? '待生成回答资产'}</span>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function createDraftSession(job: JobFile): InterviewSession {
  return {
    id: `session-${job.id}-draft`,
    jobFileId: job.id,
    source: 'externalImport',
    interviewType: '待导入外部 AI 面试对话',
    createdAt: new Date().toISOString().slice(0, 10),
    rawConversation: '',
    questions: [
      {
        id: `question-${job.id}-draft`,
        question: '粘贴面试对话后，这里会显示解析出的原问题',
        answer: '这里会显示你的原回答',
        followUps: [],
        feedback: '这里会显示外部 AI 点评'
      }
    ]
  };
}

function createDraftReview(job: JobFile, session: InterviewSession): ReviewReport {
  return {
    id: `review-${job.id}-draft`,
    jobFileId: job.id,
    sessionId: session.id,
    summary: '导入外部 AI 面试对话并生成复盘后，这里会显示本次回答的主要问题。',
    scores: [],
    strengths: [],
    weaknesses: ['待导入面试对话'],
    nextActions: ['粘贴 JD 和外部 AI 面试对话，生成第一条复盘']
  };
}

function createDraftAsset(job: JobFile, sessionId: string, reviewId: string): AnswerAsset {
  return {
    id: `asset-${job.id}-draft`,
    questionType: '待生成',
    originalQuestion: '导入对话后生成',
    originalAnswer: '导入对话后生成',
    issue: '生成复盘后，这里会显示当前回答最需要修改的问题。',
    improvedAnswer: '生成优化回答后，你可以先编辑确认，再保存为回答资产。',
    applicableRoles: [job.direction],
    applicableQuestions: ['导入对话后生成类似问题'],
    weaknessTag: '待识别',
    sourceJobId: job.id,
    sourceInterviewId: sessionId,
    sourceReviewId: reviewId,
    reuseScope: '待确认适用范围',
    usedInInterview: false,
    usageNote: '保存前请确认回答符合你的真实经历。',
    confidence: 'low'
  };
}

function upsertById(assets: AnswerAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

function createJobEditDraft(job: JobFile): JobEditDraft {
  return {
    company: job.company,
    roleTitle: job.roleTitle,
    direction: job.direction,
    stage: job.stage
  };
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="info-block">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
