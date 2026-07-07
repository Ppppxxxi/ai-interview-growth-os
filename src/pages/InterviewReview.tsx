import { getAbilityLabel } from '../components/AbilityScoreCard';
import { interviewSessions, jobFiles, reviewReports } from '../domain/sampleData';

export function InterviewReview() {
  return (
    <div className="review-board" id="reviews">
      <section className="hero-panel hero-panel--compact">
        <p className="eyebrow">面试复盘</p>
        <h1>把单场表现拆成证据、归因和下一步动作</h1>
        <p>每份复盘都保留来源会话、问题表现、能力评分和可执行训练建议，避免外部 AI 对话材料分散在不同 session。</p>
      </section>

      <div className="review-grid">
        {reviewReports.map((report) => {
          const jobFile = jobFiles.find((job) => job.id === report.jobFileId);
          const session = interviewSessions.find((item) => item.id === report.sessionId);

          return (
            <article className="review-card" key={report.id}>
              <header>
                <div>
                  <p className="eyebrow">{jobFile?.company ?? '未知公司'}</p>
                  <h2>{jobFile?.roleTitle ?? '未知岗位'}</h2>
                </div>
                <span>{session?.createdAt}</span>
              </header>

              <p className="review-summary">{report.summary}</p>

              <div className="score-list">
                {report.scores.map((score) => (
                  <section key={`${report.id}-${score.dimension}`}>
                    <div>
                      <strong>{getAbilityLabel(score.dimension)}</strong>
                      <span>{score.score}/5</span>
                    </div>
                    <p>{score.evidence}</p>
                    <small>{score.suggestion}</small>
                  </section>
                ))}
              </div>

              <div className="review-columns">
                <InfoColumn title="优势" items={report.strengths} />
                <InfoColumn title="短板" items={report.weaknesses} />
                <InfoColumn title="下一步" items={report.nextActions} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function InfoColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
