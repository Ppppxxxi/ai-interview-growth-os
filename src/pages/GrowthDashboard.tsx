import { useState } from 'react';
import { BookOpen, CheckCheck, FileCheck2, Radar } from 'lucide-react';
import { buildGrowthSnapshot } from '../agents/growthPlanner';
import { AbilityRadar } from '../components/AbilityRadar';
import { trainingTasks } from '../domain/sampleData';
import { getAssetUsageStatus } from '../workflow/assetUsageFeedback';
import type { AnswerAsset, JobFile, ReviewReport } from '../domain/types';

type GrowthDashboardProps = {
  answerAssets: AnswerAsset[];
  jobFiles: JobFile[];
  reviewReports: ReviewReport[];
};

export function GrowthDashboard({
  answerAssets,
  jobFiles,
  reviewReports
}: GrowthDashboardProps) {
  const [tab, setTab] = useState<'profile' | 'history'>('profile');
  const snapshot = buildGrowthSnapshot(reviewReports);
  const savedAnswers = answerAssets.filter(
    (asset) => asset.confirmationStatus !== 'generated-draft'
  );
  const verified = savedAnswers.filter(
    (asset) => getAssetUsageStatus(asset) === 'used-effective'
  );
  const categories = Array.from(
    new Set(savedAnswers.map((asset) => asset.questionType))
  );
  const tasks = trainingTasks.filter((task) =>
    jobFiles.some((job) => job.id === task.jobFileId)
  );

  return (
    <section className="growth-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">每一次面试，都有积累</p>
          <h1>面试复盘</h1>
        </div>
        <div className="segmented-control" aria-label="复盘视图">
          <button
            type="button"
            aria-pressed={tab === 'profile'}
            onClick={() => setTab('profile')}
          >
            个人画像
          </button>
          <button
            type="button"
            aria-pressed={tab === 'history'}
            onClick={() => setTab('history')}
          >
            复盘记录
          </button>
        </div>
      </header>
      <div className="growth-stat-band">
        <div>
          <FileCheck2 size={20} />
          <span>面试复盘</span>
          <strong>
            {reviewReports.length}
            <small>场</small>
          </strong>
        </div>
        <div>
          <BookOpen size={20} />
          <span>已保存回答</span>
          <strong>
            {savedAnswers.length}
            <small>条</small>
          </strong>
        </div>
        <div>
          <CheckCheck size={20} />
          <span>验证有效</span>
          <strong>
            {verified.length}
            <small>条</small>
          </strong>
        </div>
      </div>
      {tab === 'profile' ? (
        <>
          <div className="growth-profile-grid">
            <section className="growth-radar-panel">
              <div className="section-title">
                <h2>
                  <Radar size={18} />
                  能力画像
                </h2>
                <span>评分 / 5</span>
              </div>
              <AbilityRadar scores={snapshot.abilityAverages} />
            </section>
            <section className="growth-focus-panel">
              <div className="section-title">
                <h2>优先补强</h2>
                <span>{snapshot.repeatedWeaknesses.length} 项</span>
              </div>
              <div className="growth-weaknesses">
                {snapshot.repeatedWeaknesses.length ? (
                  snapshot.repeatedWeaknesses
                    .slice(0, 5)
                    .map((weakness, index) => (
                      <div key={weakness.label}>
                        <span className="item-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <strong>{weakness.label}</strong>
                        <span>{weakness.count} 次</span>
                      </div>
                    ))
                ) : (
                  <p className="empty-copy">完成一次复盘后查看</p>
                )}
              </div>
              <div className="profile-tags">
                <h3>问题关键词</h3>
                <div className="tag-list">
                  {categories.length ? (
                    categories.map((category) => (
                      <span key={category}>{category}</span>
                    ))
                  ) : (
                    <span>暂无关键词</span>
                  )}
                </div>
                <h3>岗位方向</h3>
                <div className="tag-list">
                  {Array.from(
                    new Set(
                      jobFiles
                        .filter((job) => job.interviewSessionIds.length > 0)
                        .map((job) => job.direction)
                    )
                  ).map((direction) => (
                    <span key={direction}>{direction}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>
          {tasks.length > 0 && (
            <details className="growth-practice">
              <summary>
                考前练习 <span>{tasks.length} 项</span>
              </summary>
              {tasks.map((task) => (
                <article key={task.id}>
                  <h3>{task.goal}</h3>
                  <p>{task.practiceQuestion}</p>
                  <span>{task.dueLabel}</span>
                </article>
              ))}
            </details>
          )}
        </>
      ) : (
        <div className="review-timeline">
          {reviewReports.length ? (
            [...reviewReports].reverse().map((report, index) => (
              <details key={report.id}>
                <summary>
                  <span className="item-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <strong>
                      {jobFiles.find((job) => job.id === report.jobFileId)
                        ?.company ?? '面试复盘'}
                    </strong>
                    <small>{report.summary}</small>
                  </span>
                  <span>{report.weaknesses.length} 个薄弱点</span>
                </summary>
                <p>{report.summary}</p>
                <div className="tag-list">
                  {report.weaknesses.map((weakness) => (
                    <span key={weakness}>{weakness}</span>
                  ))}
                </div>
                <ul>
                  {report.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </details>
            ))
          ) : (
            <div className="empty-panel">
              <FileCheck2 size={32} />
              <h2>还没有复盘记录</h2>
              <p>从一场面试开始</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
