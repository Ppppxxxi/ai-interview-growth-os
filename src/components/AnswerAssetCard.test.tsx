// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AnswerAssetCard } from './AnswerAssetCard';
import { answerAssets } from '../domain/sampleData';
afterEach(cleanup);
it('old_assets_without_evidence_still_render', () => {
  const update = vi.fn();
  render(<AnswerAssetCard asset={answerAssets[0]} jobFiles={[]} interviewSessions={[]} onUpdateAsset={update} />);
  expect((screen.getByLabelText('我的回答') as HTMLTextAreaElement).value).toBe(answerAssets[0].improvedAnswer);
  fireEvent.change(screen.getByLabelText('我的回答'), { target: { value: 'manual answer' } });
  fireEvent.click(screen.getByText('保存新版本'));
  expect(update.mock.calls[0][0].improvedAnswer).toBe('manual answer');
  fireEvent.click(screen.getByRole('tab', { name: '使用反馈' }));
  fireEvent.click(screen.getByText('保存反馈'));
  expect(update).toHaveBeenCalledTimes(2);
});
