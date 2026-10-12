import { describe, expect, it } from 'vitest';
import { answerAssets, jobFiles } from '../../domain/sampleData';
import type { AnswerAsset } from '../../domain/types';
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
        usageStatus: 'unused'
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

  it('filters answers that are ready for the next interview', () => {
    const readyAsset = answerAssets[0];
    const draftAsset: AnswerAsset = {
      ...readyAsset,
      id: 'asset-generated-draft',
      confirmationStatus: 'generated-draft'
    };
    const lowConfidenceAsset: AnswerAsset = {
      ...readyAsset,
      id: 'asset-low-confidence',
      confidence: 'low'
    };
    const rewriteAsset: AnswerAsset = {
      ...readyAsset,
      id: 'asset-needs-rewrite',
      usedInInterview: true,
      usageFeedback: {
        status: 'needs-rewrite',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    };

    const results = searchAnswerAssets(
      [readyAsset, draftAsset, lowConfidenceAsset, rewriteAsset],
      {
        ...getDefaultAssetSearchFilters(),
        quickFilter: 'next-interview-ready'
      },
      jobFiles
    );

    expect(results.map((result) => result.asset.id)).toEqual([readyAsset.id]);
  });

  it('filters answers by verified usage feedback and rewrite feedback', () => {
    const verifiedAsset: AnswerAsset = {
      ...answerAssets[0],
      id: 'asset-verified-effective',
      usedInInterview: true,
      usageFeedback: {
        status: 'used-effective',
        outcomeNote: '二面复用后回答更完整。',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    };
    const rewriteAsset: AnswerAsset = {
      ...answerAssets[1],
      id: 'asset-rewrite-feedback',
      usedInInterview: true,
      usageFeedback: {
        status: 'needs-rewrite',
        outcomeNote: '面试官继续追问后仍然说不清。',
        updatedAt: '2026-08-01T00:00:00.000Z'
      }
    };

    const verifiedResults = searchAnswerAssets(
      [verifiedAsset, rewriteAsset],
      {
        ...getDefaultAssetSearchFilters(),
        quickFilter: 'verified-effective'
      },
      jobFiles
    );
    const rewriteResults = searchAnswerAssets(
      [verifiedAsset, rewriteAsset],
      {
        ...getDefaultAssetSearchFilters(),
        quickFilter: 'needs-rewrite'
      },
      jobFiles
    );

    expect(verifiedResults.map((result) => result.asset.id)).toEqual(['asset-verified-effective']);
    expect(rewriteResults.map((result) => result.asset.id)).toEqual(['asset-rewrite-feedback']);
  });
});
