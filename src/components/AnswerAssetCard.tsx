import type { AnswerAsset } from '../domain/types';

type AnswerAssetCardProps = {
  asset: AnswerAsset;
};

const confidenceLabels: Record<AnswerAsset['confidence'], string> = {
  high: '高置信',
  medium: '中置信',
  low: '待验证'
};

export function AnswerAssetCard({ asset }: AnswerAssetCardProps) {
  return (
    <article className="asset-card">
      <header>
        <div>
          <p className="eyebrow">{asset.questionType}</p>
          <h3>优化回答</h3>
        </div>
        <span>{confidenceLabels[asset.confidence]}</span>
      </header>
      <p className="asset-card__answer">{asset.improvedAnswer}</p>
      <details>
        <summary>查看原回答</summary>
        <p>{asset.originalAnswer}</p>
      </details>
      <div className="tag-list">
        {asset.applicableRoles.map((role) => (
          <span key={role}>{role}</span>
        ))}
      </div>
      <p className="usage-note">
        <strong>使用建议：</strong>
        {asset.usageNote}
      </p>
    </article>
  );
}
