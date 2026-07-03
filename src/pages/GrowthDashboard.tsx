import { buildGrowthSnapshot } from '../agents/growthPlanner';
import { AbilityScoreCard, getAbilityLabel } from '../components/AbilityScoreCard';
import { experiences, jobFiles, reviewReports, trainingTasks } from '../domain/sampleData';
import type { AbilityDimension } from '../domain/types';

const orderedDimensions: AbilityDimension[] = [
  'roleUnderstanding',
  'productAnalysis',
  'aiProductThinking',
  'dataMetrics',
  'projectStorytelling',
  'structuredCommunication'
];

export function GrowthDashboard() {
  const snapshot = buildGrowthSnapshot(reviewReports);
  const openTrainingTasks = trainingTasks.filter((task) => task.status === 'open');

  return (
    <div className="dashboard-grid">
      <section className="hero-panel">
        <p className="eyebrow">AI Interview Growth OS</p>
        <h1>把每场面试复盘，转成下一场可复用的准备资产</h1>
        <p>
          面向 AI 产品经理求职场景，系统聚合岗位档案、模拟面试、外部对话导入、复盘、能力图谱、回答库和训练计划。
        </p>
        <div className="hero-stats">
          <span>
            <strong>{jobFiles.length}</strong>
            岗位档案
          </span>
          <span>
            <strong>{reviewReports.length}</strong>
            面试复盘
          </span>
          <span>
            <strong>{openTrainingTasks.length}</strong>
            待训练任务
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">能力图谱</p>
          <h2>跨岗位能力均分</h2>
        </div>
        <div className="ability-grid">
          {orderedDimensions.map((dimension) => (
            <AbilityScoreCard
              key={dimension}
              dimension={dimension}
              score={snapshot.abilityAverages[dimension]}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">重复短板</p>
          <h2>优先处理的问题</h2>
        </div>
        <div className="weakness-list">
          {snapshot.repeatedWeaknesses.slice(0, 4).map((weakness) => (
            <div className="weakness-row" key={weakness.label}>
              <span>{weakness.label}</span>
              <strong>{weakness.count} 次</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel--wide">
        <div className="section-heading">
          <p className="eyebrow">岗位档案</p>
          <h2>当前准备进度</h2>
        </div>
        <div className="job-list">
          {jobFiles.map((jobFile) => (
            <article className="job-card" key={jobFile.id}>
              <div>
                <p>{jobFile.company}</p>
                <h3>{jobFile.roleTitle}</h3>
                <span>{jobFile.direction}</span>
              </div>
              <div className="job-card__meta">
                <strong>{jobFile.stage}</strong>
                <span>{jobFile.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">训练计划</p>
          <h2>下一步聚焦</h2>
        </div>
        <div className="focus-list">
          {snapshot.recommendedFocus.map((dimension) => (
            <span key={dimension}>{getAbilityLabel(dimension)}</span>
          ))}
        </div>
        <div className="task-preview">
          {openTrainingTasks.slice(0, 2).map((task) => (
            <article key={task.id}>
              <strong>{task.goal}</strong>
              <p>{task.practiceQuestion}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">经历素材</p>
          <h2>可迁移项目</h2>
        </div>
        <div className="experience-list">
          {experiences.map((experience) => (
            <article key={experience.id}>
              <strong>{experience.title}</strong>
              <p>{experience.result}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
