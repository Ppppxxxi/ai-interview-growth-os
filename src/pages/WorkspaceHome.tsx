import type { CSSProperties } from 'react';
import type { PersonalWorkspaceData } from '../workflow/personalWorkspace';
import { buildWorkspaceHomeSnapshot } from '../workflow/workspaceHome';

type WorkspaceHomeProps = {
  data: PersonalWorkspaceData;
  onSelectJob: (jobId: string) => void;
  onOpenJob: () => void;
  onOpenAssets: () => void;
  onOpenGrowth: () => void;
  onStartNew: () => void;
};

export function WorkspaceHome({ data, onSelectJob, onOpenJob, onOpenAssets, onOpenGrowth, onStartNew }: WorkspaceHomeProps) {
  const snapshot = buildWorkspaceHomeSnapshot(data);
  const { job, latestSession, featuredAsset, questionCount, readyCount, savedAnswerCount, weakestAbility } = snapshot;
  const progress = questionCount ? Math.min(readyCount / questionCount, 1) * 100 : 0;

  return (
    <div className="workspace-home">
      <header className="workspace-home-heading">
        <h1>工作台</h1>
        <button type="button" className="workspace-home-new" onClick={onStartNew}>开始新面试 <span aria-hidden="true">↗</span></button>
      </header>

      <section className="workspace-home-current" aria-label="正在准备的岗位">
        <div className="workspace-home-current-top">
          <span className="workspace-home-live"><i aria-hidden="true" />正在准备</span>
          {job && data.jobFiles.length > 1 ? (
            <label className="workspace-home-job-switch">
              <span className="sr-only">切换目标岗位</span>
              <select value={job.id} onChange={(event) => onSelectJob(event.target.value)}>
                {data.jobFiles.map((item) => <option key={item.id} value={item.id}>{item.company} · {item.roleTitle}</option>)}
              </select>
            </label>
          ) : <span className="workspace-home-stage">{job?.stage ?? '准备中'}</span>}
        </div>
        <div className="workspace-home-current-main">
          <div className="workspace-home-current-copy">
            <h2>{job?.company ?? '我的目标岗位'}</h2>
            <p>{job?.roleTitle ?? '开始新面试'}{job?.direction && <span> · {job.direction}</span>}</p>
            <button type="button" className="workspace-home-primary" onClick={job && latestSession ? onOpenJob : onStartNew}>
              {latestSession ? '查看岗位复盘' : '开始新面试'} <span aria-hidden="true">↗</span>
            </button>
          </div>
          {questionCount > 0 && (
            <div
              className="workspace-home-readiness"
              role="img"
              aria-label={`${questionCount} 个问题中 ${readyCount} 条回答已保存`}
              style={{ '--home-progress': `${progress}%` } as CSSProperties}
            >
              <div><strong>{readyCount}<small> / {questionCount}</small></strong><span>回答已保存</span></div>
            </div>
          )}
        </div>
        <div className="workspace-home-current-foot">
          <span>最近复盘</span>
          <strong>{latestSession?.interviewType ?? '暂无面试记录'}</strong>
          {latestSession ? <span>{latestSession.questions.length} 个问题</span> : job && <button type="button" onClick={onOpenJob}>管理岗位 <span aria-hidden="true">↗</span></button>}
        </div>
      </section>

      <div className="workspace-home-secondary">
        <section className="workspace-home-library">
          <div className="workspace-home-module-head"><span>我的回答库</span><strong>{String(savedAnswerCount).padStart(2, '0')}</strong></div>
          {featuredAsset ? (
            <div className="workspace-home-library-entry"><span>01</span><div><small>{featuredAsset.questionType}</small><h2>{featuredAsset.originalQuestion}</h2></div></div>
          ) : <p className="workspace-home-empty">还没有保存的回答</p>}
          <button type="button" className="workspace-home-link workspace-home-link--teal" onClick={featuredAsset ? onOpenAssets : onStartNew}>
            {featuredAsset ? '打开回答库' : '开始整理回答'} <span aria-hidden="true">↗</span>
          </button>
        </section>
        <section className="workspace-home-ability">
          <div className="workspace-home-module-head"><span>当前关注</span><strong>{weakestAbility ? `${weakestAbility.score} / 5` : '—'}</strong></div>
          <h2>{weakestAbility?.label ?? '暂无评分'}</h2>
          {weakestAbility ? (
            <div className="workspace-home-ability-meter" role="meter" aria-label={`${weakestAbility.label}评分`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={weakestAbility.score}>
              <span style={{ width: `${Math.max(0, Math.min(100, weakestAbility.score / 5 * 100))}%` }} />
            </div>
          ) : <p className="workspace-home-empty">完成复盘后显示</p>}
          <button type="button" className="workspace-home-link workspace-home-link--warm" onClick={onOpenGrowth}>查看面试复盘 <span aria-hidden="true">↗</span></button>
        </section>
      </div>
    </div>
  );
}
