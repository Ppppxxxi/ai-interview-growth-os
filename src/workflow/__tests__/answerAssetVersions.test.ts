import { describe, expect, it } from 'vitest';
import { answerAssets } from '../../domain/sampleData';
import { getAnswerVersions, restoreAnswerAssetVersion, saveAnswerAssetVersion } from '../answerAssetVersions';

describe('answer asset versions', () => {
  it('keeps legacy assets compatible when no versions exist', () => {
    expect(getAnswerVersions(answerAssets[0])).toEqual([]);
  });

  it('saves the previous recommended answer as a history version', () => {
    const updated = saveAnswerAssetVersion(
      answerAssets[0],
      {
        answer: '这是下一轮面试前重写后的回答。',
        note: '补充真实项目指标。',
        source: 'manual-edit'
      },
      '2026-07-12T10:00:00.000Z'
    );

    expect(updated.improvedAnswer).toBe('这是下一轮面试前重写后的回答。');
    expect(updated.answerVersions).toHaveLength(1);
    expect(updated.answerVersions?.[0]).toMatchObject({
      answer: answerAssets[0].improvedAnswer,
      note: '补充真实项目指标。',
      createdAt: '2026-07-12T10:00:00.000Z'
    });
  });

  it('does not create a version when the answer is unchanged', () => {
    const updated = saveAnswerAssetVersion(answerAssets[0], {
      answer: answerAssets[0].improvedAnswer,
      note: '重复保存'
    });

    expect(updated).toBe(answerAssets[0]);
  });

  it('restores a history version as the current recommended answer', () => {
    const withVersion = saveAnswerAssetVersion(
      answerAssets[0],
      {
        answer: '新版回答',
        note: '保存上一版'
      },
      '2026-07-12T10:00:00.000Z'
    );

    const restored = restoreAnswerAssetVersion(
      withVersion,
      withVersion.answerVersions?.[0].id ?? '',
      '2026-07-12T11:00:00.000Z'
    );

    expect(restored.improvedAnswer).toBe(answerAssets[0].improvedAnswer);
    expect(restored.answerVersions?.[0].answer).toBe('新版回答');
  });
});
