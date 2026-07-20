import type { AnswerAsset, AnswerAssetVersion } from '../domain/types';

export type AnswerVersionDraft = {
  answer: string;
  note: string;
  source?: AnswerAssetVersion['source'];
};

export function getAnswerVersions(asset: AnswerAsset): AnswerAssetVersion[] {
  return asset.answerVersions ?? [];
}

export function saveAnswerAssetVersion(
  asset: AnswerAsset,
  draft: AnswerVersionDraft,
  now = new Date().toISOString()
): AnswerAsset {
  const nextAnswer = draft.answer.trim();
  if (!nextAnswer || nextAnswer === asset.improvedAnswer.trim()) return asset;

  const previousVersion: AnswerAssetVersion = {
    id: `version-${asset.id}-${Date.parse(now).toString(36)}`,
    answer: asset.improvedAnswer,
    note: draft.note.trim() || '保存新版本前的上一版回答。',
    createdAt: now,
    source: draft.source ?? 'manual-edit'
  };

  return {
    ...asset,
    improvedAnswer: nextAnswer,
    answerVersions: [previousVersion, ...getAnswerVersions(asset)]
  };
}

export function restoreAnswerAssetVersion(
  asset: AnswerAsset,
  versionId: string,
  now = new Date().toISOString()
): AnswerAsset {
  const targetVersion = getAnswerVersions(asset).find((version) => version.id === versionId);
  if (!targetVersion) return asset;

  return saveAnswerAssetVersion(
    asset,
    {
      answer: targetVersion.answer,
      note: `恢复历史版本：${targetVersion.note}`,
      source: 'manual-edit'
    },
    now
  );
}
