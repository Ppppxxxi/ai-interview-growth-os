import { useEffect, useMemo, useState } from 'react';
import { analyzeJd } from '../agents/jdAnalyst';
import { matchExperiences } from '../agents/experienceMatcher';
import { generateMockInterview } from '../agents/mockInterview';
import { answerAssets, coldStartDemo, experiences, interviewSessions, jobFiles, reviewReports, trainingTasks } from '../domain/sampleData';
import { completeAnalysis, createWorkspaceState, saveGeneratedAsset, startAnalysis } from '../workflow/demoFlow';

type JobFileDetailProps = {
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  onOpenAssets?: () => void;
};

export function JobFileDetail({ selectedJobId, onSelectJob, onOpenAssets }: JobFileDetailProps) {
  const selectedJob = jobFiles.find((jobFile) => jobFile.id === selectedJobId) ?? jobFiles[0];
  const primarySession = interviewSessions.find((session) => session.jobFileId === selectedJob.id) ?? interviewSessions[0];
  const primaryReview = reviewReports.find((report) => report.sessionId === primarySession.id) ?? reviewReports[0];
  const primaryAsset =
    answerAssets.find((asset) => asset.sourceInterviewId === primarySession.id) ??
    answerAssets.find((asset) => asset.applicableRoles.includes(selectedJob.direction)) ??
    answerAssets[0];
  const profile = selectedJob.profile ?? analyzeJd(selectedJob.jdText, selectedJob.direction);
  const matches = matchExperiences(profile, experiences);
  const mockSession = generateMockInterview(selectedJob.id, profile, experiences);
  const initialState = useMemo(
    () => createWorkspaceState(selectedJob, primarySession, primaryReview, primaryAsset),
    [primaryAsset, primaryReview, primarySession, selectedJob]
  );
  const [workspaceState, setWorkspaceState] = useState(initialState);
  const [jdText, setJdText] = useState(selectedJob.jdText);
  const [conversationText, setConversationText] = useState(primarySession.rawConversation || coldStartDemo.importedConversation);
  const [editableAnswer, setEditableAnswer] = useState(primaryAsset.improvedAnswer);

  useEffect(() => {
    setWorkspaceState(initialState);
    setJdText(selectedJob.jdText);
    setConversationText(primarySession.rawConversation || coldStartDemo.importedConversation);
    setEditableAnswer(primaryAsset.improvedAnswer);
  }, [initialState, primaryAsset.improvedAnswer, primarySession.rawConversation, selectedJob.jdText]);

  const linkedAssets = answerAssets.filter(
    (asset) => asset.sourceJobId === selectedJob.id || asset.applicableRoles.includes(selectedJob.direction)
  );
  const linkedTrainingTasks = trainingTasks.filter((task) => task.jobFileId === selectedJob.id);

  function handleGenerate() {
    const generating = startAnalysis(workspaceState);
    setWorkspaceState(generating);
    window.setTimeout(() => {
      setWorkspaceState((current) => completeAnalysis(current));
    }, 600);
  }

  function handleSaveAsset() {
    setWorkspaceState((current) => saveGeneratedAsset(current));
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

        <section className="analysis-steps">
          {workspaceState.steps.map((step) => (
            <article className={`analysis-step analysis-step--${step.status}`} key={step.id}>
              <span>{step.status === 'done' ? '完成' : step.status === 'active' ? '进行中' : '等待'}</span>
              <strong>{step.label}</strong>
            </article>
          ))}
        </section>

        <section className="compare-panel">
          <div className="compare-card compare-card--original">
            <p className="eyebrow">原回答</p>
            <h2>{primarySession.questions[0]?.question}</h2>
            <p>{primarySession.questions[0]?.answer}</p>
            <div className="issue-box">
              <strong>具体问题</strong>
              <p>{primaryAsset.issue}</p>
            </div>
          </div>

          <div className="compare-card compare-card--improved">
            <p className="eyebrow">优化回答</p>
            <h2>改成这样更完整</h2>
            <textarea value={editableAnswer} onChange={(event) => setEditableAnswer(event.target.value)} />
            <div className="compare-actions">
              <button type="button" onClick={handleSaveAsset}>
                {workspaceState.status === 'assetSaved' ? '已保存为回答资产' : '保存为回答资产'}
              </button>
              <span>{primaryAsset.reuseScope}</span>
            </div>
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
        <section className="side-panel side-panel--asset">
          <p className="eyebrow">本岗位回答资产</p>
          <h2>{workspaceState.status === 'assetSaved' ? '已保存' : '待保存'}</h2>
          <strong>{primaryAsset.questionType}</strong>
          <p>{primaryAsset.applicableQuestions[0]}</p>
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
