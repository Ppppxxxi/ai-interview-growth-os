import type { AbilityDimension } from '../domain/types';

const abilityLabels: Record<AbilityDimension, string> = {
  roleUnderstanding: '岗位理解',
  productAnalysis: '产品分析',
  aiProductThinking: 'AI 产品思维',
  dataMetrics: '数据与指标',
  projectStorytelling: '项目叙事',
  structuredCommunication: '结构化表达'
};

type AbilityScoreCardProps = {
  dimension: AbilityDimension;
  score?: number;
};

export function getAbilityLabel(dimension: AbilityDimension): string {
  return abilityLabels[dimension];
}

export function AbilityScoreCard({ dimension, score }: AbilityScoreCardProps) {
  const normalizedScore = score ?? 0;
  const width = `${Math.min(100, Math.max(0, (normalizedScore / 5) * 100))}%`;

  return (
    <article className="ability-card">
      <div className="ability-card__header">
        <span>{abilityLabels[dimension]}</span>
        <strong>{score ? score.toFixed(1) : '暂无'}</strong>
      </div>
      <div className="score-bar" aria-label={`${abilityLabels[dimension]}评分`}>
        <span style={{ width }} />
      </div>
    </article>
  );
}
