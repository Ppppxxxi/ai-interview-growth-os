import { describe, expect, it } from 'vitest';
import type { ReviewReport } from '../../domain/types';
import { buildGrowthSnapshot } from '../growthPlanner';

describe('buildGrowthSnapshot', () => {
  it('aggregates repeated weaknesses and creates ability averages', () => {
    const reports: ReviewReport[] = [
      {
        id: 'r-1',
        jobFileId: 'job-1',
        sessionId: 's-1',
        summary: 'summary',
        strengths: [],
        weaknesses: ['指标体系不完整'],
        nextActions: [],
        scores: [
          {
            dimension: 'dataMetrics',
            label: '数据与指标',
            score: 2,
            evidence: 'e',
            attribution: 'a',
            suggestion: 's'
          }
        ]
      },
      {
        id: 'r-2',
        jobFileId: 'job-2',
        sessionId: 's-2',
        summary: 'summary',
        strengths: [],
        weaknesses: ['指标体系不完整'],
        nextActions: [],
        scores: [
          {
            dimension: 'dataMetrics',
            label: '数据与指标',
            score: 4,
            evidence: 'e',
            attribution: 'a',
            suggestion: 's'
          }
        ]
      }
    ];

    const snapshot = buildGrowthSnapshot(reports);

    expect(snapshot.abilityAverages.dataMetrics).toBe(3);
    expect(snapshot.repeatedWeaknesses[0]).toEqual({ label: '指标体系不完整', count: 2 });
    expect(snapshot.recommendedFocus).toContain('dataMetrics');
  });
});
