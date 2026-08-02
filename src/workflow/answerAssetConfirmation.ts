import type { AnswerAsset, AnswerAssetConfirmationStatus } from '../domain/types';

export const confirmationStatusLabels: Record<AnswerAssetConfirmationStatus, string> = {
  accepted: '已确认采用',
  'edited-accepted': '修改后采用',
  'generated-draft': '生成草稿'
};

export function getAnswerAssetConfirmationStatus(asset: AnswerAsset): AnswerAssetConfirmationStatus {
  return asset.confirmationStatus ?? 'accepted';
}

export function isAnswerAssetUserConfirmed(asset: AnswerAsset) {
  return getAnswerAssetConfirmationStatus(asset) !== 'generated-draft';
}
