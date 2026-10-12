import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type {
  AnswerAsset,
  AnswerAssetUsageStatus,
  InterviewSession,
  JobFile
} from '../domain/types';
import {
  confirmationStatusLabels,
  getAnswerAssetConfirmationStatus
} from '../workflow/answerAssetConfirmation';
import {
  getAnswerVersions,
  restoreAnswerAssetVersion,
  saveAnswerAssetVersion
} from '../workflow/answerAssetVersions';
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

const usageStatusOptions: AnswerAssetUsageStatus[] = [
  'unused',
  'used-effective',
  'used-needs-polish',
  'needs-rewrite'
];

export function AnswerAssetCard({
  asset,
  interviewSessions,
  jobFiles,
  onUpdateAsset,
  sourceInterview,
  sourceJob
}: AnswerAssetCardProps) {
  const [feedbackDraft, setFeedbackDraft] = useState<AssetUsageFeedbackDraft>(
    () => createFeedbackDraft(asset)
  );
  const [answerDraft, setAnswerDraft] = useState(asset.improvedAnswer);
  const [versionNote, setVersionNote] = useState('');
  const [activeTab, setActiveTab] = useState<
    'answer' | 'rationale' | 'feedback'
  >('answer');

  useEffect(() => {
    setFeedbackDraft(createFeedbackDraft(asset));
    setAnswerDraft(asset.improvedAnswer);
    setVersionNote('');
  }, [asset]);

  const answerVersions = getAnswerVersions(asset);
  const confirmationStatus = getAnswerAssetConfirmationStatus(asset);
  const rationale = createAssetRationale(asset);
  const visibleInterviewSessions = interviewSessions.filter(
    (session) =>
      !feedbackDraft.usedForJobId ||
      session.jobFileId === feedbackDraft.usedForJobId
  );

  function updateDraft<Key extends keyof AssetUsageFeedbackDraft>(
    key: Key,
    value: AssetUsageFeedbackDraft[Key]
  ) {
    setFeedbackDraft((current) => ({ ...current, [key]: value }));
  }

  function handleStatusChange(status: AnswerAssetUsageStatus) {
    setFeedbackDraft((current) => ({
      ...current,
      status,
      usedAt:
        status === 'unused'
          ? undefined
          : current.usedAt || new Date().toISOString().slice(0, 10)
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
        <div className="asset-status-stack">
          <span>{confidenceLabels[asset.confidence]}</span>
          <span>{confirmationStatusLabels[confirmationStatus]}</span>
        </div>
      </header>
      <div className="detail-tabs" role="tablist" aria-label="回答详情">
        {(
          [
            { id: 'answer', label: '我的回答' },
            { id: 'rationale', label: '改写依据' },
            { id: 'feedback', label: '使用反馈' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'answer' && (
        <>
          <section className="asset-section asset-section--answer asset-section--primary">
            <div className="asset-answer-heading">
              <strong>当前推荐回答</strong>
              <span>{answerVersions.length} 个历史版本</span>
            </div>
            <textarea
              aria-label="我的回答"
              value={answerDraft}
              onChange={(event) => setAnswerDraft(event.target.value)}
            />
            <div className="asset-version-actions">
              <input
                value={versionNote}
                aria-label="版本说明"
                placeholder="版本说明，可选"
                onChange={(event) => setVersionNote(event.target.value)}
              />
              <button
                type="button"
                className="secondary-action"
                onClick={handleSaveAnswerVersion}
                disabled={answerDraft.trim() === asset.improvedAnswer.trim()}
              >
                <Save size={15} />
                保存新版本
              </button>
            </div>
          </section>
          <details className="asset-version-history">
            <summary>历史版本 · {answerVersions.length}</summary>
            {answerVersions.length > 0 ? (
              <div className="asset-version-list">
                {answerVersions.map((version) => (
                  <article key={version.id}>
                    <div>
                      <strong>{version.note}</strong>
                      <span>{version.createdAt.slice(0, 10)}</span>
                    </div>
                    <p>{version.answer}</p>
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => handleRestoreVersion(version.id)}
                    >
                      恢复为当前版本
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p>暂无历史版本</p>
            )}
          </details>
        </>
      )}
      {activeTab === 'rationale' && (
        <>
          <section className="asset-section asset-section--issue">
            <strong>具体问题点</strong>
            <p>{asset.issue}</p>
          </section>

          <section className="asset-section asset-section--rationale">
            <strong>改动依据</strong>
            <dl>
              <div>
                <dt>来源问题</dt>
                <dd>{rationale.sourceQuestion}</dd>
              </div>
              <div>
                <dt>原回答暴露的问题</dt>
                <dd>{rationale.originalIssue}</dd>
              </div>
              <div>
                <dt>本次改写重点</dt>
                <dd>{rationale.rewriteFocus}</dd>
              </div>
              <div>
                <dt>适用边界</dt>
                <dd>{rationale.applicabilityBoundary}</dd>
              </div>
            </dl>
          </section>
          <details className="asset-card__original">
            <summary>原问题与原回答</summary>
            <strong>{asset.originalQuestion}</strong>
            <p>{asset.originalAnswer}</p>
          </details>
          <details className="asset-card__metadata">
            <summary>来源与适用范围</summary>
            <p>
              {sourceJob
                ? `${sourceJob.company} · ${sourceJob.roleTitle}`
                : '未关联岗位'}{' '}
              · {sourceInterview?.interviewType ?? '未关联面试'}
            </p>
            <div className="tag-list">
              {asset.applicableRoles.map((role) => (
                <span key={role}>{role}</span>
              ))}
              <span>{asset.weaknessTag}</span>
            </div>
            <ul>
              {asset.applicableQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </details>
        </>
      )}
      {activeTab === 'feedback' && (
        <section className="asset-feedback-panel">
          <div className="asset-feedback-heading">
            <div>
              <p className="eyebrow">使用反馈</p>
              <h4>{usageStatusLabels[getAssetUsageStatus(asset)]}</h4>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={handleSaveFeedback}
            >
              保存反馈
            </button>
          </div>

          <div className="asset-feedback-grid">
            <label>
              <span>使用结果</span>
              <select
                value={feedbackDraft.status}
                onChange={(event) =>
                  handleStatusChange(
                    event.target.value as AnswerAssetUsageStatus
                  )
                }
              >
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
                onChange={(event) =>
                  updateDraft(
                    'usedForInterviewId',
                    event.target.value || undefined
                  )
                }
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
              onChange={(event) =>
                updateDraft('interviewerFollowUp', event.target.value)
              }
            />
          </label>

          <label className="asset-feedback-field">
            <span>使用后复盘</span>
            <textarea
              value={feedbackDraft.outcomeNote ?? ''}
              disabled={feedbackDraft.status === 'unused'}
              placeholder="例如：框架可用，但需要补一个真实项目指标"
              onChange={(event) =>
                updateDraft('outcomeNote', event.target.value)
              }
            />
          </label>
        </section>
      )}
    </article>
  );
}

function createAssetRationale(asset: AnswerAsset) {
  return {
    sourceQuestion:
      asset.answerRationale?.sourceQuestion ?? asset.originalQuestion,
    originalIssue: asset.answerRationale?.originalIssue ?? asset.issue,
    rewriteFocus: asset.answerRationale?.rewriteFocus ?? asset.usageNote,
    applicabilityBoundary:
      asset.answerRationale?.applicabilityBoundary ?? asset.reuseScope
  };
}

function createFeedbackDraft(asset: AnswerAsset): AssetUsageFeedbackDraft {
  const status = getAssetUsageStatus(asset);

  return {
    status,
    usedAt: asset.usageFeedback?.usedAt,
    usedForJobId:
      status === 'unused'
        ? undefined
        : (asset.usageFeedback?.usedForJobId ?? asset.sourceJobId),
    usedForInterviewId: asset.usageFeedback?.usedForInterviewId,
    interviewerFollowUp: asset.usageFeedback?.interviewerFollowUp,
    outcomeNote: asset.usageFeedback?.outcomeNote
  };
}
