import { analyzeJd } from '../agents/jdAnalyst';
import { matchExperiences } from '../agents/experienceMatcher';
import { generateMockInterview } from '../agents/mockInterview';
import { answerAssets, coldStartDemo, experiences, interviewSessions, jobFiles, reviewReports } from '../domain/sampleData';
import type { AnswerAsset, JobFile, ReviewReport } from '../domain/types';
import type { ReactNode } from 'react';

type JobFileDetailProps = {
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  onOpenAssets?: () => void;
};

export function JobFileDetail({ selectedJobId, onSelectJob, onOpenAssets }: JobFileDetailProps) {
  const selectedJob = jobFiles.find((jobFile) => jobFile.id === selectedJobId) ?? jobFiles[0];
  const profile = selectedJob.profile ?? analyzeJd(selectedJob.jdText, selectedJob.direction);
  const matches = matchExperiences(profile, experiences);
  const sessions = interviewSessions.filter((session) => session.jobFileId === selectedJob.id);
  const primarySession = sessions[0];
  const primaryReview = reviewReports.find((report) => report.sessionId === primarySession?.id);
  const linkedAssets = answerAssets.filter(
    (asset) => asset.sourceJobId === selectedJob.id || asset.applicableRoles.includes(selectedJob.direction)
  );
  const mockSession = generateMockInterview(selectedJob.id, profile, experiences);

  return (
    <div className="workspace-layout" id="workspace">
      <aside className="sidebar-panel">
        <p className="eyebrow">岗位工作台</p>
        <h2>准备中的岗位</h2>
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
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace-main">
        <section className="hero-panel workspace-hero">
          <p className="eyebrow">{selectedJob.company} · {selectedJob.roleTitle}</p>
          <h1>导入外部 AI 模拟面试对话，获得具体改进建议和可复用回答</h1>
          <p>
            把这轮面试里的原问题、原回答和点评整理成复盘，并沉淀为同岗位后续轮次可使用的回答资产。
          </p>
          <div className="primary-cta-row">
            <button type="button">生成复盘与优化回答</button>
            <span>粘贴一段对话即可开始</span>
          </div>
        </section>

        <section className="input-grid">
          <InputPreview title="JD 文本" value={selectedJob.jdText} />
          <InputPreview title="外部 AI 模拟面试对话" value={primarySession?.rawConversation ?? coldStartDemo.importedConversation} />
        </section>

        {primarySession && primaryReview ? (
          <section className="flow-grid">
            <PipelineCard index="1" title="你被问了什么">
              <strong>{primarySession.questions[0]?.question}</strong>
              <p>原回答：{primarySession.questions[0]?.answer}</p>
              <p>追问：{primarySession.questions[0]?.followUps.join(' / ')}</p>
            </PipelineCard>

            <PipelineCard index="2" title="这次回答的问题在哪">
              <ReviewSummary report={primaryReview} />
            </PipelineCard>

            <PipelineCard index="3" title="改成这样就对了">
              <AssetAnswer asset={linkedAssets[0]} />
            </PipelineCard>

            <PipelineCard index="4" title="下次类似问题可以复用">
              <p>复用范围：{linkedAssets[0]?.reuseScope}</p>
              <p>适用问题：{linkedAssets[0]?.applicableQuestions.slice(0, 2).join(' / ')}</p>
              <button type="button" onClick={onOpenAssets}>查看回答资产库</button>
            </PipelineCard>
          </section>
        ) : (
          <section className="empty-panel">
            <h2>还没有导入面试对话</h2>
            <p>粘贴一段你在 ChatGPT 或其他 AI 工具上的模拟面试对话，获取具体改进建议和可复用回答。</p>
          </section>
        )}

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">下次面试复用</p>
            <h2>该岗位最可能被问的 3 个问题 + 可复用优化回答</h2>
          </div>
          <div className="question-grid">
            {profile.likelyQuestions.slice(0, 3).map((question, index) => (
              <article key={question}>
                <span>高概率问题 {index + 1}</span>
                <p>{question}</p>
                <strong>{linkedAssets[0]?.questionType ?? '待生成回答资产'}</strong>
                <p>{linkedAssets[0]?.improvedAnswer ?? '导入面试对话后生成可复用回答。'}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <p className="eyebrow">岗位准备</p>
              <h2>JD 画像与经历匹配</h2>
            </div>
            <InfoList title="岗位要求" items={profile.responsibilities} />
            <InfoList title="能力关键词" items={profile.abilityKeywords} />
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
      </section>
    </div>
  );
}

function InputPreview({ title, value }: { title: string; value: string }) {
  return (
    <section className="input-preview">
      <div className="section-heading">
        <p className="eyebrow">输入</p>
        <h2>{title}</h2>
      </div>
      <textarea readOnly value={value} />
    </section>
  );
}

function PipelineCard({ children, index, title }: { children: ReactNode; index: string; title: string }) {
  return (
    <article className="pipeline-card">
      <span className="pipeline-card__index">{index}</span>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function ReviewSummary({ report }: { report: ReviewReport }) {
  const keyScore = report.scores[0];

  return (
    <>
      <p>{report.summary}</p>
      <div className="review-explain">
        <strong>核心短板：{report.weaknesses[0]}</strong>
        <span>{keyScore?.score && keyScore.score <= 2 ? '需要补强' : '基本合格'}</span>
      </div>
      <p>具体问题：{keyScore?.attribution}</p>
      <p>建议这样改：{keyScore?.suggestion}</p>
    </>
  );
}

function AssetAnswer({ asset }: { asset?: AnswerAsset }) {
  if (!asset) return <p>导入面试对话后生成优化回答。</p>;

  return (
    <>
      <p>原回答暴露的问题：{asset.issue}</p>
      <strong>优化回答</strong>
      <p>{asset.improvedAnswer}</p>
    </>
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
