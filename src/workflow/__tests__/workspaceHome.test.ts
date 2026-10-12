import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, jobFiles, reviewReports } from '../../domain/sampleData';
import { createPersonalWorkspaceData } from '../personalWorkspace';
import { buildWorkspaceHomeSnapshot } from '../workspaceHome';

describe('buildWorkspaceHomeSnapshot', () => {
  it('uses saved answers and review evidence from the workspace', () => {
    const workspace = createPersonalWorkspaceData(
      jobFiles,
      answerAssets,
      jobFiles[0].id,
      '2026-10-12',
      interviewSessions,
      reviewReports
    );

    const snapshot = buildWorkspaceHomeSnapshot(workspace);

    expect(snapshot.job?.company).toBe('星河智能');
    expect(snapshot.questionCount).toBe(1);
    expect(snapshot.readyCount).toBe(1);
    expect(snapshot.latestSession?.id).toBe('session-ai-pm-a-1');
    expect(snapshot.featuredAsset?.id).toBe('asset-session-ai-pm-a-1');
    expect(snapshot.weakestAbility).toMatchObject({ label: '数据与指标', score: 2.5 });
  });

  it('does not present generated drafts or absent scores as confirmed progress', () => {
    const workspace = createPersonalWorkspaceData(
      [jobFiles[1]],
      [{ ...answerAssets[0], sourceJobId: jobFiles[1].id, confirmationStatus: 'generated-draft' }],
      jobFiles[1].id
    );

    const snapshot = buildWorkspaceHomeSnapshot(workspace);

    expect(snapshot.readyCount).toBe(0);
    expect(snapshot.featuredAsset).toBeUndefined();
    expect(snapshot.questionCount).toBe(0);
    expect(snapshot.weakestAbility).toBeUndefined();
  });

  it('does not count two saved answers for one question as two covered questions', () => {
    const workspace = createPersonalWorkspaceData(
      [jobFiles[0]],
      [answerAssets[0], { ...answerAssets[0], id: 'another-answer' }],
      jobFiles[0].id,
      '2026-10-12',
      [interviewSessions[0]]
    );

    const snapshot = buildWorkspaceHomeSnapshot(workspace);

    expect(snapshot.questionCount).toBe(1);
    expect(snapshot.readyCount).toBe(1);
    expect(snapshot.savedAnswerCount).toBe(2);
  });
});
