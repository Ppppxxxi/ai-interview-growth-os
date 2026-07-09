import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, jobFiles, reviewReports } from '../sampleData';

describe('sampleData answer asset integrity', () => {
  it('keeps every answer asset connected to a real job, interview session, and review', () => {
    for (const asset of answerAssets) {
      const sourceJob = jobFiles.find((job) => job.id === asset.sourceJobId);
      const sourceInterview = interviewSessions.find((session) => session.id === asset.sourceInterviewId);
      const sourceReview = reviewReports.find((report) => report.id === asset.sourceReviewId);

      expect(sourceJob, `${asset.id} source job`).toBeDefined();
      expect(sourceInterview, `${asset.id} source interview`).toBeDefined();
      expect(sourceReview, `${asset.id} source review`).toBeDefined();
      expect(sourceInterview?.jobFileId).toBe(asset.sourceJobId);
      expect(sourceReview?.jobFileId).toBe(asset.sourceJobId);
      expect(sourceReview?.sessionId).toBe(asset.sourceInterviewId);
    }
  });

  it('uses a complete source chain for assets marked as used in interviews', () => {
    const usedAssets = answerAssets.filter((asset) => asset.usedInInterview);

    expect(usedAssets.length).toBeGreaterThanOrEqual(1);
    expect(usedAssets.map((asset) => asset.id)).toContain('asset-session-ai-pm-a-1');
  });
});
