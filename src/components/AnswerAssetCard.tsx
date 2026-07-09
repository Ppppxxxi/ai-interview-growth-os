import type { AnswerAsset, InterviewSession, JobFile } from '../domain/types';

type AnswerAssetCardProps = {
  asset: AnswerAsset;
  sourceJob?: JobFile;
  sourceInterview?: InterviewSession;
};

const confidenceLabels: Record<AnswerAsset['confidence'], string> = {
  high: '高置信',
  medium: '中置信',
  low: '待验证'
};

export function AnswerAssetCard({ asset, sourceInterview, sourceJob }: AnswerAssetCardProps) {
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
        <strong>优化后的完整回答</strong>
        <p>{asset.improvedAnswer}</p>
      </section>

      <section className="asset-section asset-section--issue">
        <strong>具体问题点</strong>
        <p>{asset.issue}</p>
      </section>

      <details className="asset-card__original">
        <summary>查看原问题和原回答</summary>
        <strong>{asset.originalQuestion}</strong>
        <p>{asset.originalAnswer}</p>
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
          <span>{asset.usedInInterview ? '已在面试中使用' : '待实战验证'}</span>
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
