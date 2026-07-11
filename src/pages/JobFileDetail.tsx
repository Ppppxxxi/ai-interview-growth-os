import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { analyzeJd } from '../agents/jdAnalyst';
import { matchExperiences } from '../agents/experienceMatcher';
import { generateMockInterview } from '../agents/mockInterview';
import { coldStartDemo, experiences, trainingTasks } from '../domain/sampleData';
import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';
import { completeAnalysis, createWorkspaceState, saveGeneratedAsset, startAnalysis } from '../workflow/demoFlow';
import { buildAnswerExplanation } from '../workflow/answerExplanation';
import {
  createEditableQuestions,
  hasUsableQuestion,
  updateQuestionField,
  updateQuestionFollowUps
} from '../workflow/conversationDraft';
import { buildDemoPipelineResult } from '../workflow/demoPipeline';
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
  onSaveInterviewRecord: (session: InterviewSession, review: ReviewReport) => void;
  onSaveAsset: (asset: AnswerAsset) => void;
  onOpenAssets?: () => void;
};

const emptyJobForm: NewJobDraft = {
  company: '',
  roleTitle: '',
  direction: 'AI 产品经理',
  jdText: '',
  stage: '准备中'
};

export function JobFileDetail({
  answerAssets,
  selectedJobId,
  jobFiles,
  interviewSessions,
  reviewReports,
  onCreateJob,
  onSaveAsset,
  onSaveInterviewRecord,
  onSelectJob,
  onUpdateJob,
  onOpenAssets
}: JobFileDetailProps) {
  const selectedJob = jobFiles.find((jobFile) => jobFile.id === selectedJobId) ?? jobFiles[0];
  const [newJobForm, setNewJobForm] = useState(emptyJobForm);
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
  const answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setWorkspaceState(initialState);
    setJdText(selectedJob.jdText);
    setConversationText(initialConversationText);
    setGeneratedSession(primarySession);
    setGeneratedReview(primaryReview);
    setGeneratedAsset(primaryAsset);
    setEditableAnswer(primaryAsset.improvedAnswer);
    setEditableQuestions(createEditableQuestions(initialConversationText, primarySession.questions));
    setSelectedRecordId(primarySession.id);
  }, [initialConversationText, initialState, primaryAsset, primaryReview, primarySession, selectedJob.jdText]);

  const linkedAssets = answerAssets.filter(
    (asset) => asset.sourceJobId === selectedJob.id || asset.applicableRoles.includes(selectedJob.direction)
  );
  const linkedTrainingTasks = trainingTasks.filter((task) => task.jobFileId === selectedJob.id);
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

  function handleGenerate() {
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
    setJdText(selectedJob.jdText);
    setConversationText(coldStartDemo.importedConversation);
    setEditableQuestions(createEditableQuestions(coldStartDemo.importedConversation, primarySession.questions));
  }

  function handlePreviewParse() {
    setEditableQuestions(createEditableQuestions(conversationText, primarySession.questions));
  }

  function handleQuestionFieldChange(questionId: string, field: 'question' | 'answer' | 'feedback', value: string) {
    setEditableQuestions((current) => updateQuestionField(current, questionId, field, value));
  }

  function handleQuestionFollowUpsChange(questionId: string, value: string) {
    setEditableQuestions((current) => updateQuestionFollowUps(current, questionId, value));
  }

  function handleSaveCurrentJob() {
    onUpdateJob({
      ...selectedJob,
      jdText,
      profile: analyzeJd(jdText, selectedJob.direction),
      status: selectedJob.status === '待导入面试对话' ? '已保存 JD，待导入面试对话' : selectedJob.status
    });
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
          <p className="eyebrow">岗位工作台</p>
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
              <small>{jobFile.status}</small>
            </button>
          ))}
        </div>
        <form className="new-job-card" onSubmit={handleNewJobSubmit}>
          <div className="section-heading">
            <p className="eyebrow">本地保存</p>
            <h2>新建岗位档案</h2>
          </div>
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
            <textarea value={newJobForm.jdText} onChange={(event) => handleNewJobChange('jdText', event.target.value)} />
          </label>
          <button type="submit">保存岗位档案</button>
        </form>
      </aside>

      <main className="workspace-center">
        <section className="workspace-header">
          <div>
            <p className="eyebrow">{selectedJob.company} · {selectedJob.roleTitle}</p>
            <h1>导入面试对话，生成下次可用回答</h1>
            <p>把这轮面试里的原问题、原回答和点评整理成复盘，并沉淀为后续轮次可使用的回答资产。</p>
          </div>
          <button className="primary-action" type="button" onClick={handleGenerate} disabled={workspaceState.status === 'generating'}>
            {workspaceState.status === 'generating' ? '正在生成...' : '生成复盘与优化回答'}
          </button>
        </section>

        <section className="input-helper-panel">
          <div>
            <p className="eyebrow">快速开始</p>
            <h2>粘贴 JD 和一段模拟面试对话</h2>
            <p>支持直接复制 ChatGPT、Claude 或其他 AI 工具里的问答记录。生成后先查看依据，再决定是否保存为回答资产。</p>
          </div>
          <div className="input-helper-actions">
            <button className="secondary-action" type="button" onClick={handleFillExample}>
              填入示例内容
            </button>
            <button className="ghost-action" type="button" onClick={handleSaveCurrentJob}>
              保存当前 JD
            </button>
          </div>
        </section>

        <section className="workspace-inputs">
          <label>
            <span>JD 文本</span>
            <textarea value={jdText} onChange={(event) => setJdText(event.target.value)} />
          </label>
          <label>
            <span>外部 AI 模拟面试对话</span>
            <textarea value={conversationText} onChange={(event) => setConversationText(event.target.value)} />
          </label>
        </section>

        <section className="parsed-conversation-panel">
          <div className="section-heading parsed-conversation-heading">
            <div>
              <p className="eyebrow">解析结果确认</p>
              <h2>先确认系统读对了什么，再生成复盘</h2>
            </div>
            <button className="secondary-action" type="button" onClick={handlePreviewParse}>
              解析并预览
            </button>
          </div>
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
        </section>

        <section className="analysis-steps">
          {workspaceState.steps.map((step) => (
            <article className={`analysis-step analysis-step--${step.status}`} key={step.id}>
              <span>{step.status === 'done' ? '完成' : step.status === 'active' ? '进行中' : '等待'}</span>
              <strong>{step.label}</strong>
            </article>
          ))}
        </section>

        <section className="interview-detail-panel">
          <div className="section-heading interview-detail-heading">
            <div>
              <p className="eyebrow">面试记录详情</p>
              <h2>{generatedSession.interviewType}</h2>
            </div>
            <span>{generatedSession.createdAt}</span>
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

        <section className="compare-panel">
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
        </section>

        <section className="explanation-panel">
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
        </section>

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
