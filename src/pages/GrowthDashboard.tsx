import { buildGrowthSnapshot } from '../agents/growthPlanner';
import { jobFiles, reviewReports, trainingTasks } from '../domain/sampleData';
import type { AnswerAsset } from '../domain/types';

type GrowthDashboardProps = {
  answerAssets: AnswerAsset[];
};

export function GrowthDashboard({ answerAssets }: GrowthDashboardProps) {
  const snapshot = buildGrowthSnapshot(reviewReports);
  const mainWeaknesses = snapshot.repeatedWeaknesses.slice(0, 4);
  const reusedAssets = answerAssets.filter((asset) => asset.usedInInterview);

  return (
    <div className="dashboard-grid dashboard-grid--growth">
      <section className="hero-panel">
        <p className="eyebrow">全局成长</p>
        <h1>查看已沉淀的问题、回答和考前训练</h1>
        <p>这里汇总当前已经有证据的复盘结果。完成更多面试复盘后，再展示跨岗位重复问题和能力变化。</p>
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
          <p className="eyebrow">当前主要问题</p>
          <h2>下一场面试前优先处理</h2>
        </div>
        {mainWeaknesses.length > 0 ? (
          <div className="weakness-list">
            {mainWeaknesses.map((weakness) => (
              <div className="weakness-row" key={weakness.label}>
                <span>{weakness.label}</span>
                <strong>{weakness.count > 1 ? `${weakness.count} 次出现` : '本次复盘出现'}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="usage-note">完成一次面试复盘后，这里会显示最需要优先处理的问题。</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">资产沉淀</p>
          <h2>已沉淀的回答</h2>
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
          <p className="eyebrow">覆盖岗位</p>
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
          <h2>考前优先训练</h2>
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
