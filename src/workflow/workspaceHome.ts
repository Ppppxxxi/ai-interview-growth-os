import type { AbilityDimension, AnswerAsset, InterviewSession, JobFile } from '../domain/types';
import type { PersonalWorkspaceData } from './personalWorkspace';

export type WorkspaceHomeSnapshot = {
  job?: JobFile;
  latestSession?: InterviewSession;
  featuredAsset?: AnswerAsset;
  questionCount: number;
  readyCount: number;
  savedAnswerCount: number;
  weakestAbility?: { dimension: AbilityDimension; label: string; score: number };
};

export function buildWorkspaceHomeSnapshot(data: PersonalWorkspaceData): WorkspaceHomeSnapshot {
  const job = data.jobFiles.find((item) => item.id === data.selectedJobId) ?? data.jobFiles[0];
  const sessions = data.interviewSessions
    .filter((session) => session.jobFileId === job?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const savedAssets = data.answerAssets.filter((asset) => asset.confirmationStatus !== 'generated-draft');
  const jobAssets = savedAssets.filter((asset) => asset.sourceJobId === job?.id);
  const readyCount = sessions.reduce(
    (sum, session) => sum + Math.min(session.questions.length, jobAssets.filter((asset) => asset.sourceInterviewId === session.id).length),
    0
  );
  const scores = new Map<AbilityDimension, { label: string; sum: number; count: number }>();

  data.reviewReports.forEach((report) => {
    report.scores.forEach((ability) => {
      const current = scores.get(ability.dimension);
      scores.set(ability.dimension, {
        label: ability.label,
        sum: (current?.sum ?? 0) + ability.score,
        count: (current?.count ?? 0) + 1
      });
    });
  });

  const weakestAbility = [...scores.entries()]
    .map(([dimension, value]) => ({
      dimension,
      label: value.label,
      score: Math.round((value.sum / value.count) * 10) / 10
    }))
    .sort((a, b) => a.score - b.score)[0];

  return {
    job,
    latestSession: sessions[0],
    featuredAsset: jobAssets[0] ?? savedAssets.find((asset) => asset.applicableRoles.includes(job?.direction ?? '')) ?? savedAssets[0],
    questionCount: sessions.reduce((sum, session) => sum + session.questions.length, 0),
    readyCount,
    savedAnswerCount: savedAssets.length,
    weakestAbility
  };
}
