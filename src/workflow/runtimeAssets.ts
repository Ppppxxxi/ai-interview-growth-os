import type { AnswerAsset } from '../domain/types';

export function upsertAnswerAsset(assets: AnswerAsset[], nextAsset: AnswerAsset) {
  const existingIndex = assets.findIndex((asset) => asset.id === nextAsset.id);
  if (existingIndex === -1) return [nextAsset, ...assets];

  return assets.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset));
}
