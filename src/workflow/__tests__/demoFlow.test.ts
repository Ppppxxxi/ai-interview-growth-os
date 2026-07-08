import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, jobFiles, reviewReports } from '../../domain/sampleData';
import { completeAnalysis, createWorkspaceState, saveGeneratedAsset, startAnalysis } from '../demoFlow';

describe('demo workspace flow', () => {
  it('moves from inputs to generated review and saved asset', () => {
    const job = jobFiles[0];
    const session = interviewSessions[0];
    const review = reviewReports[0];
    const asset = answerAssets[0];

    const idle = createWorkspaceState(job, session, review, asset);
    expect(idle.status).toBe('idle');
    expect(idle.savedAssetId).toBeUndefined();

    const generating = startAnalysis(idle);
    expect(generating.status).toBe('generating');
    expect(generating.steps.map((step) => step.status)).toEqual(['active', 'pending', 'pending']);

    const ready = completeAnalysis(generating);
    expect(ready.status).toBe('reviewReady');
    expect(ready.steps.map((step) => step.status)).toEqual(['done', 'done', 'done']);

    const saved = saveGeneratedAsset(ready);
    expect(saved.status).toBe('assetSaved');
    expect(saved.savedAssetId).toBe(asset.id);
  });
});
