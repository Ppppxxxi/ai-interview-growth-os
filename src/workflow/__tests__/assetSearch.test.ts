import { describe, expect, it } from 'vitest';
import { answerAssets, jobFiles } from '../../domain/sampleData';
import { getDefaultAssetSearchFilters, searchAnswerAssets } from '../assetSearch';

describe('searchAnswerAssets', () => {
  it('searches reusable answers by keyword across questions and answer content', () => {
    const results = searchAnswerAssets(
      answerAssets,
      {
        ...getDefaultAssetSearchFilters(),
        query: '指标'
      },
      jobFiles
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].asset.id).toBe('asset-session-ai-pm-a-1');
    expect(results[0].matchedFields).toContain('优化回答');
  });

  it('filters by source job and usage status', () => {
    const results = searchAnswerAssets(
      answerAssets,
      {
        ...getDefaultAssetSearchFilters(),
        sourceJobId: 'job-platform-pm-c',
        usageStatus: 'used'
      },
      jobFiles
    );

    expect(results).toHaveLength(1);
    expect(results[0].asset.id).toBe('asset-demand-priority');
  });

  it('returns no results when query does not match any searchable fields', () => {
    const results = searchAnswerAssets(
      answerAssets,
      {
        ...getDefaultAssetSearchFilters(),
        query: '不存在的关键词'
      },
      jobFiles
    );

    expect(results).toEqual([]);
  });
});
