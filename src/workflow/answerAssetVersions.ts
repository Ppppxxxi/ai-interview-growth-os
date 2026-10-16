import type { AnswerAsset, AnswerAssetVersion } from '../domain/types';

type VersionMetadata = Pick<AnswerAsset, 'evidence' | 'generation' | 'missingFacts' | 'modelRationale' | 'answerRationale'>;
export type AnswerVersionDraft = VersionMetadata & {
  answer: string;
  note: string;
  source?: AnswerAssetVersion['source'];
};

export function manualAnswerMetadata(asset: VersionMetadata): VersionMetadata {
  return { ...metadata(asset),
    evidence: asset.evidence?.map(entry => ({ ...entry, status: entry.status === 'source-deleted' ? 'source-deleted' : 'needs-review' })),
    generation: asset.generation ? { ...asset.generation, origin: 'manual' } : undefined };
}

function metadata(value: VersionMetadata): VersionMetadata {
  return { evidence: value.evidence, generation: value.generation, missingFacts: value.missingFacts,
    modelRationale: value.modelRationale, answerRationale: value.answerRationale };
}

export function getAnswerVersions(asset: AnswerAsset): AnswerAssetVersion[] {
  return asset.answerVersions ?? [];
}

export function saveAnswerAssetVersion(
  asset: AnswerAsset,
  draft: AnswerVersionDraft,
  now = new Date().toISOString()
): AnswerAsset {
  const nextAnswer = draft.answer.trim();
  if (!nextAnswer) return asset;
  const nextMetadata = draft.source === 'generated' ? metadata(draft) : manualAnswerMetadata({
    ...metadata(asset), ...Object.fromEntries(Object.entries(draft).filter(([key]) => ['evidence', 'generation', 'missingFacts', 'modelRationale', 'answerRationale'].includes(key)))
  });
  if (nextAnswer === asset.improvedAnswer.trim() && (draft.source !== 'generated' || JSON.stringify(metadata(asset)) === JSON.stringify(nextMetadata))) return asset;
  return replaceVersion(asset, nextAnswer, nextMetadata, draft, now);
}

function replaceVersion(asset: AnswerAsset, answer: string, nextMetadata: VersionMetadata, draft: AnswerVersionDraft, now: string): AnswerAsset {

  const previousVersion: AnswerAssetVersion = {
    id: `version-${asset.id}-${Date.parse(now).toString(36)}-${getAnswerVersions(asset).length}`,
    ...structuredClone(metadata(asset)),
    answer: asset.improvedAnswer,
    note: draft.note.trim() || '保存新版本前的上一版回答。',
    createdAt: now,
    source: draft.source ?? 'manual-edit'
  };

  return {
    ...asset,
    ...structuredClone(nextMetadata),
    improvedAnswer: answer,
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

  return replaceVersion(
    asset, targetVersion.answer, metadata(targetVersion),
    {
      answer: targetVersion.answer,
      note: `恢复历史版本：${targetVersion.note}`,
      source: 'manual-edit'
    },
    now
  );
}
