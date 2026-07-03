import type { AbilityDimension, ReviewReport } from '../domain/types';

export type GrowthSnapshot = {
  abilityAverages: Partial<Record<AbilityDimension, number>>;
  repeatedWeaknesses: Array<{ label: string; count: number }>;
  recommendedFocus: AbilityDimension[];
};

const abilityDimensions: AbilityDimension[] = [
  'roleUnderstanding',
  'productAnalysis',
  'aiProductThinking',
  'dataMetrics',
  'projectStorytelling',
  'structuredCommunication'
];

export function buildGrowthSnapshot(reports: ReviewReport[]): GrowthSnapshot {
  const abilityAverages = abilityDimensions.reduce<Partial<Record<AbilityDimension, number>>>((averages, dimension) => {
    const scores = reports.flatMap((report) =>
      report.scores.filter((score) => score.dimension === dimension).map((score) => score.score)
    );

    if (scores.length > 0) {
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      averages[dimension] = Math.round(average * 10) / 10;
    }

    return averages;
  }, {});

  const weaknessCounts = new Map<string, number>();
  for (const report of reports) {
    for (const weakness of report.weaknesses) {
      weaknessCounts.set(weakness, (weaknessCounts.get(weakness) ?? 0) + 1);
    }
  }

  const repeatedWeaknesses = Array.from(weaknessCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const recommendedFocus = Object.entries(abilityAverages)
    .filter(([, score]) => typeof score === 'number' && score < 3.5)
    .map(([dimension]) => dimension as AbilityDimension);

  return {
    abilityAverages,
    repeatedWeaknesses,
    recommendedFocus
  };
}
