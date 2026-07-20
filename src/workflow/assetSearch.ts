import type { AnswerAsset, JobFile } from '../domain/types';
import { getAssetUsageStatus } from './assetUsageFeedback';

export type AssetUsageFilter = 'all' | 'used' | 'unused';

export type AssetSearchFilters = {
  query: string;
  direction: string;
  questionType: string;
  weakness: string;
  confidence: string;
  sourceJobId: string;
  usageStatus: AssetUsageFilter;
};

export type AssetSearchResult = {
  asset: AnswerAsset;
  score: number;
  matchedFields: string[];
};

const fieldWeights: Array<{
  label: string;
  weight: number;
  getText: (asset: AnswerAsset, sourceJob?: JobFile) => string;
}> = [
  { label: '原问题', weight: 8, getText: (asset) => asset.originalQuestion },
  { label: '适用问题', weight: 6, getText: (asset) => asset.applicableQuestions.join(' ') },
  { label: '优化回答', weight: 5, getText: (asset) => asset.improvedAnswer },
  { label: '问题点', weight: 4, getText: (asset) => asset.issue },
  { label: '使用建议', weight: 3, getText: (asset) => asset.usageNote },
  {
    label: '使用反馈',
    weight: 3,
    getText: (asset) => `${asset.usageFeedback?.outcomeNote ?? ''} ${asset.usageFeedback?.interviewerFollowUp ?? ''}`
  },
  { label: '问题类型', weight: 3, getText: (asset) => asset.questionType },
  { label: '能力短板', weight: 3, getText: (asset) => asset.weaknessTag },
  { label: '岗位方向', weight: 2, getText: (asset) => asset.applicableRoles.join(' ') },
  { label: '来源岗位', weight: 2, getText: (_asset, sourceJob) => (sourceJob ? `${sourceJob.company} ${sourceJob.roleTitle}` : '') }
];

export function searchAnswerAssets(
  assets: AnswerAsset[],
  filters: AssetSearchFilters,
  jobFiles: JobFile[]
): AssetSearchResult[] {
  const normalizedQuery = normalize(filters.query);
  const jobsById = new Map(jobFiles.map((job) => [job.id, job]));

  return assets
    .filter((asset) => matchesFilters(asset, filters))
    .map((asset) => scoreAsset(asset, jobsById.get(asset.sourceJobId), normalizedQuery))
    .filter((result) => !normalizedQuery || result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftUsed = getAssetUsageStatus(left.asset) !== 'unused';
      const rightUsed = getAssetUsageStatus(right.asset) !== 'unused';
      if (leftUsed !== rightUsed) return leftUsed ? -1 : 1;
      return confidenceRank(right.asset.confidence) - confidenceRank(left.asset.confidence);
    });
}

export function getDefaultAssetSearchFilters(): AssetSearchFilters {
  return {
    query: '',
    direction: 'all',
    questionType: 'all',
    weakness: 'all',
    confidence: 'all',
    sourceJobId: 'all',
    usageStatus: 'all'
  };
}

function matchesFilters(asset: AnswerAsset, filters: AssetSearchFilters) {
  const matchesDirection = filters.direction === 'all' || asset.applicableRoles.includes(filters.direction);
  const matchesType = filters.questionType === 'all' || asset.questionType === filters.questionType;
  const matchesWeakness = filters.weakness === 'all' || asset.weaknessTag === filters.weakness;
  const matchesConfidence = filters.confidence === 'all' || asset.confidence === filters.confidence;
  const matchesSourceJob = filters.sourceJobId === 'all' || asset.sourceJobId === filters.sourceJobId;
  const matchesUsage =
    filters.usageStatus === 'all' ||
    (filters.usageStatus === 'used' && getAssetUsageStatus(asset) !== 'unused') ||
    (filters.usageStatus === 'unused' && getAssetUsageStatus(asset) === 'unused');

  return matchesDirection && matchesType && matchesWeakness && matchesConfidence && matchesSourceJob && matchesUsage;
}

function scoreAsset(asset: AnswerAsset, sourceJob: JobFile | undefined, normalizedQuery: string): AssetSearchResult {
  if (!normalizedQuery) {
    return { asset, score: 0, matchedFields: [] };
  }

  const matchedFields: string[] = [];
  const score = fieldWeights.reduce((currentScore, field) => {
    const text = normalize(field.getText(asset, sourceJob));
    if (!text.includes(normalizedQuery)) return currentScore;

    matchedFields.push(field.label);
    return currentScore + field.weight;
  }, 0);

  return { asset, score, matchedFields };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function confidenceRank(confidence: AnswerAsset['confidence']) {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}
