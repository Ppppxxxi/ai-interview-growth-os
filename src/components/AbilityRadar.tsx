import { getAbilityLabel } from './AbilityScoreCard';
import type { AbilityDimension } from '../domain/types';

const dimensions: AbilityDimension[] = [
  'roleUnderstanding',
  'productAnalysis',
  'aiProductThinking',
  'dataMetrics',
  'projectStorytelling',
  'structuredCommunication'
];

export function AbilityRadar({
  scores
}: {
  scores: Partial<Record<AbilityDimension, number>>;
}) {
  const point = (index: number, radius: number) => {
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    return {
      x: 180 + Math.cos(angle) * radius,
      y: 155 + Math.sin(angle) * radius
    };
  };
  const outline = (radius: number) =>
    dimensions
      .map((_, index) => {
        const { x, y } = point(index, radius);
        return `${x},${y}`;
      })
      .join(' ');
  const hasScores = dimensions.some(
    (dimension) => scores[dimension] !== undefined
  );
  const complete = dimensions.every(
    (dimension) => scores[dimension] !== undefined
  );

  return (
    <div className="ability-radar">
      <svg viewBox="0 0 360 310" role="img" aria-label="能力雷达图">
        <title>
          {dimensions
            .map(
              (dimension) =>
                `${getAbilityLabel(dimension)}：${scores[dimension] ?? '暂无评分'}`
            )
            .join('，')}
        </title>
        {[5, 4, 3, 2, 1].map((level) => (
          <polygon
            key={level}
            points={outline(level * 20)}
            fill={level === 5 ? '#f4f8f5' : 'none'}
            stroke="#dbe7df"
          />
        ))}
        {dimensions.map((dimension, index) => {
          const axis = point(index, 100);
          const label = point(index, 132);
          return (
            <g key={dimension}>
              <line
                x1="180"
                y1="155"
                x2={axis.x}
                y2={axis.y}
                stroke="#dbe7df"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {getAbilityLabel(dimension)}
              </text>
              <text
                className="radar-score"
                x={label.x}
                y={label.y + 17}
                textAnchor="middle"
              >
                {scores[dimension]?.toFixed(1) ?? '—'}
              </text>
            </g>
          );
        })}
        {complete && (
          <polygon
            points={dimensions
              .map((dimension, index) => {
                const { x, y } = point(
                  index,
                  Math.max(0, Math.min(5, scores[dimension]!)) * 20
                );
                return `${x},${y}`;
              })
              .join(' ')}
            fill="#78b9a044"
            stroke="#368468"
            strokeWidth="2"
          />
        )}
        {dimensions.map((dimension, index) => {
          const score = scores[dimension];
          if (score === undefined) return null;
          const { x, y } = point(index, Math.max(0, Math.min(5, score)) * 20);
          return (
            <circle
              key={dimension}
              cx={x}
              cy={y}
              r="4"
              fill="#287354"
              stroke="white"
              strokeWidth="2"
            >
              <title>{`${getAbilityLabel(dimension)} ${score} / 5`}</title>
            </circle>
          );
        })}
      </svg>
      {!hasScores && <p className="radar-empty">暂无评分</p>}
    </div>
  );
}
