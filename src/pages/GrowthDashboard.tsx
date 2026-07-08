import { buildGrowthSnapshot } from '../agents/growthPlanner';
import { answerAssets, jobFiles, reviewReports, trainingTasks } from '../domain/sampleData';

export function GrowthDashboard() {
  const snapshot = buildGrowthSnapshot(reviewReports);
  const repeatedWeaknesses = snapshot.repeatedWeaknesses.slice(0, 4);
  const reusedAssets = answerAssets.filter((asset) => asset.usedInInterview);

  return (
    <div className="dashboard-grid dashboard-grid--growth">
      <section className="hero-panel">
        <p className="eyebrow">全局成长</p>
        <h1>跨岗位追踪你的进步和重复短板</h1>
        <p>
          查看上次面试以来沉淀了哪些回答资产、哪些短板还在重复出现，以及下一场面试前最该练的问题。
        </p>
        <div className="hero-stats">
          <span>
            <strong>{reviewReports.length}</strong>
            已完成复盘
          </span>
          <span>
            <strong>{answerAssets.length}</strong>
            回答资产
          </span>
          <span>
            <strong>{reusedAssets.length}</strong>
            已实战使用
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">重复短板</p>
          <h2>需要优先处理的问题</h2>
        </div>
        <div className="weakness-list">
          {repeatedWeaknesses.map((weakness) => (
            <div className="weakness-row" key={weakness.label}>
              <span>{weakness.label}</span>
              <strong>{weakness.count} 次</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">资产沉淀</p>
          <h2>短板如何转成回答</h2>
        </div>
        <div className="asset-mini-list">
          {answerAssets.map((asset) => (
            <article key={asset.id}>
              <strong>{asset.weaknessTag}</strong>
              <p>{asset.questionType}</p>
              <span>{asset.reuseScope}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">复用范围</p>
          <h2>适用岗位</h2>
        </div>
        <div className="reuse-list">
          {jobFiles.slice(0, 2).map((job) => (
            <article key={job.id}>
              <strong>{job.company}</strong>
              <p>{job.roleTitle}</p>
              <span>{job.status}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel--wide">
        <div className="section-heading">
          <p className="eyebrow">下一场面试前</p>
          <h2>建议练习 1-2 个问题</h2>
        </div>
        <div className="task-preview">
          {trainingTasks.slice(0, 2).map((task) => (
            <article key={task.id}>
              <strong>{task.goal}</strong>
              <p>{task.practiceQuestion}</p>
              <span>{task.referenceFramework}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
