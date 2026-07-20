import { useEffect, useState } from 'react';
import type { AnswerAsset, AnswerAssetUsageStatus, InterviewSession, JobFile } from '../domain/types';
import { getAnswerVersions, restoreAnswerAssetVersion, saveAnswerAssetVersion } from '../workflow/answerAssetVersions';
import {
  getAssetUsageStatus,
  updateAnswerAssetUsageFeedback,
  usageStatusLabels,
  type AssetUsageFeedbackDraft
} from '../workflow/assetUsageFeedback';

type AnswerAssetCardProps = {
  asset: AnswerAsset;
  interviewSessions: InterviewSession[];
  jobFiles: JobFile[];
  onUpdateAsset: (asset: AnswerAsset) => void;
  sourceJob?: JobFile;
  sourceInterview?: InterviewSession;
};

const confidenceLabels: Record<AnswerAsset['confidence'], string> = {
  high: '高置信',
  medium: '中置信',
  low: '待验证'
};

const usageStatusOptions: AnswerAssetUsageStatus[] = ['unused', 'used-effective', 'used-needs-polish', 'needs-rewrite'];

export function AnswerAssetCard({
  asset,
  interviewSessions,
  jobFiles,
  onUpdateAsset,
  sourceInterview,
  sourceJob
}: AnswerAssetCardProps) {
  const [feedbackDraft, setFeedbackDraft] = useState<AssetUsageFeedbackDraft>(() => createFeedbackDraft(asset));
  const [answerDraft, setAnswerDraft] = useState(asset.improvedAnswer);
  const [versionNote, setVersionNote] = useState('');

  useEffect(() => {
    setFeedbackDraft(createFeedbackDraft(asset));
    setAnswerDraft(asset.improvedAnswer);
    setVersionNote('');
  }, [asset]);

  const answerVersions = getAnswerVersions(asset);
  const visibleInterviewSessions = interviewSessions.filter(
    (session) => !feedbackDraft.usedForJobId || session.jobFileId === feedbackDraft.usedForJobId
  );

  function updateDraft<Key extends keyof AssetUsageFeedbackDraft>(key: Key, value: AssetUsageFeedbackDraft[Key]) {
    setFeedbackDraft((current) => ({ ...current, [key]: value }));
  }

  function handleStatusChange(status: AnswerAssetUsageStatus) {
    setFeedbackDraft((current) => ({
      ...current,
      status,
      usedAt: status === 'unused' ? undefined : current.usedAt || new Date().toISOString().slice(0, 10)
    }));
  }

  function handleSaveFeedback() {
    onUpdateAsset(updateAnswerAssetUsageFeedback(asset, feedbackDraft));
  }

  function handleSaveAnswerVersion() {
    const updated = saveAnswerAssetVersion(asset, {
      answer: answerDraft,
      note: versionNote,
      source: 'manual-edit'
    });
    onUpdateAsset(updated);
  }

  function handleRestoreVersion(versionId: string) {
    onUpdateAsset(restoreAnswerAssetVersion(asset, versionId));
  }

  return (
    <article className="asset-card asset-card--prioritized">
      <header>
        <div>
          <p className="eyebrow">{asset.questionType}</p>
          <h3>{asset.originalQuestion}</h3>
        </div>
        <span>{confidenceLabels[asset.confidence]}</span>
      </header>

      <section className="asset-section asset-section--answer asset-section--primary">
        <div className="asset-answer-heading">
          <strong>当前推荐回答</strong>
          <span>{answerVersions.length} 个历史版本</span>
        </div>
        <textarea value={answerDraft} onChange={(event) => setAnswerDraft(event.target.value)} />
        <div className="asset-version-actions">
          <input
            value={versionNote}
            placeholder="版本说明，例如：补充真实项目指标"
            onChange={(event) => setVersionNote(event.target.value)}
          />
          <button type="button" className="secondary-action" onClick={handleSaveAnswerVersion} disabled={answerDraft.trim() === asset.improvedAnswer.trim()}>
            保存为新版本
          </button>
        </div>
      </section>

      <section className="asset-section asset-section--issue">
        <strong>具体问题点</strong>
        <p>{asset.issue}</p>
      </section>

      <section className="asset-feedback-panel">
        <div className="asset-feedback-heading">
          <div>
            <p className="eyebrow">使用反馈</p>
            <h4>{usageStatusLabels[getAssetUsageStatus(asset)]}</h4>
          </div>
          <button type="button" className="secondary-action" onClick={handleSaveFeedback}>
            保存反馈
          </button>
        </div>

        <div className="asset-feedback-grid">
          <label>
            <span>使用结果</span>
            <select value={feedbackDraft.status} onChange={(event) => handleStatusChange(event.target.value as AnswerAssetUsageStatus)}>
              {usageStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {usageStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>使用日期</span>
            <input
              type="date"
              value={feedbackDraft.usedAt ?? ''}
              disabled={feedbackDraft.status === 'unused'}
              onChange={(event) => updateDraft('usedAt', event.target.value)}
            />
          </label>

          <label>
            <span>用于哪个岗位</span>
            <select
              value={feedbackDraft.usedForJobId ?? ''}
              disabled={feedbackDraft.status === 'unused'}
              onChange={(event) => {
                updateDraft('usedForJobId', event.target.value || undefined);
                updateDraft('usedForInterviewId', undefined);
              }}
            >
              <option value="">未选择</option>
              {jobFiles.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} · {job.roleTitle}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>关联面试记录</span>
            <select
              value={feedbackDraft.usedForInterviewId ?? ''}
              disabled={feedbackDraft.status === 'unused'}
              onChange={(event) => updateDraft('usedForInterviewId', event.target.value || undefined)}
            >
              <option value="">未选择</option>
              {visibleInterviewSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.interviewType} · {session.createdAt}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="asset-feedback-field">
          <span>面试官追问</span>
          <textarea
            value={feedbackDraft.interviewerFollowUp ?? ''}
            disabled={feedbackDraft.status === 'unused'}
            placeholder="记录这条回答被追问了什么，方便下次补强"
            onChange={(event) => updateDraft('interviewerFollowUp', event.target.value)}
          />
        </label>

        <label className="asset-feedback-field">
          <span>使用后复盘</span>
          <textarea
            value={feedbackDraft.outcomeNote ?? ''}
            disabled={feedbackDraft.status === 'unused'}
            placeholder="例如：框架可用，但需要补一个真实项目指标"
            onChange={(event) => updateDraft('outcomeNote', event.target.value)}
          />
        </label>
      </section>

      <details className="asset-card__original">
        <summary>查看原问题和原回答</summary>
        <strong>{asset.originalQuestion}</strong>
        <p>{asset.originalAnswer}</p>
      </details>

      <details className="asset-version-history">
        <summary>查看历史回答版本</summary>
        {answerVersions.length > 0 ? (
          <div className="asset-version-list">
            {answerVersions.map((version) => (
              <article key={version.id}>
                <div>
                  <strong>{version.note}</strong>
                  <span>{version.createdAt.slice(0, 10)} · {version.source === 'manual-edit' ? '手动编辑' : version.source}</span>
                </div>
                <p>{version.answer}</p>
                <button type="button" className="ghost-action" onClick={() => handleRestoreVersion(version.id)}>
                  恢复为当前版本
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>还没有历史版本。保存新版本后，上一版回答会自动保留在这里。</p>
        )}
      </details>

      <p className="usage-note">
        <strong>使用建议：</strong>
        {asset.usageNote}
      </p>

      <details className="asset-card__metadata">
        <summary>来源与适用范围</summary>
        <div className="source-line">
          <strong>来源：</strong>
          <span>{sourceJob ? `${sourceJob.company} · ${sourceJob.roleTitle}` : asset.sourceJobId}</span>
          <span>{sourceInterview ? sourceInterview.interviewType : asset.sourceInterviewId}</span>
        </div>

        <div className="tag-list">
          {asset.applicableRoles.map((role) => (
            <span key={role}>{role}</span>
          ))}
          <span>{asset.weaknessTag}</span>
          <span>{asset.reuseScope}</span>
          <span>{usageStatusLabels[getAssetUsageStatus(asset)]}</span>
        </div>

        <section className="asset-section">
          <strong>适用类似问题</strong>
          <ul>
            {asset.applicableQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      </details>
    </article>
  );
}

function createFeedbackDraft(asset: AnswerAsset): AssetUsageFeedbackDraft {
  return {
    status: getAssetUsageStatus(asset),
    usedAt: asset.usageFeedback?.usedAt,
    usedForJobId: asset.usageFeedback?.usedForJobId ?? asset.sourceJobId,
    usedForInterviewId: asset.usageFeedback?.usedForInterviewId,
    interviewerFollowUp: asset.usageFeedback?.interviewerFollowUp,
    outcomeNote: asset.usageFeedback?.outcomeNote
  };
}
