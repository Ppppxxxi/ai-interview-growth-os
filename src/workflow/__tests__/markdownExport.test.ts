import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, jobFiles, reviewReports } from '../../domain/sampleData';
import {
  buildAssetLibraryMarkdown,
  buildInterviewReviewMarkdown,
  buildJobPrepMarkdown,
  createMarkdownFileName
} from '../markdownExport';

describe('markdown export', () => {
  it('exports_current_and_each_history_quote_but_never_deleted_system_snapshots', () => {
    const evidence = { documentId: 'synthetic', documentVersion: 1, chunkId: 'c', kind: 'experience' as const, titleSnapshot: 'Synthetic source', quote: 'Short excerpt only', answerParagraphIndex: 0, status: 'validated' as const };
    const asset = { ...answerAssets[0], evidence: [evidence], answerVersions: [{ id: 'v1', answer: 'User history body', note: 'User note', createdAt: '', source: 'manual-edit' as const,
      evidence: [{ ...evidence, titleSnapshot: 'Historical source', quote: 'Historical excerpt' }, { ...evidence, titleSnapshot: 'Must not leak', quote: 'Deleted quote', status: 'source-deleted' as const }] }] };
    const markdown = buildAssetLibraryMarkdown({ assets: [asset], jobFiles, interviewSessions });
    expect(markdown).toContain('Short excerpt only'); expect(markdown).toContain('Historical excerpt'); expect(markdown).toContain('User history body');
    expect(markdown).not.toContain('Must not leak'); expect(markdown).not.toContain('Deleted quote');
  });
  it('exports one interview review with source questions and answer assets', () => {
    const markdown = buildInterviewReviewMarkdown({
      job: jobFiles[0],
      session: interviewSessions[0],
      review: reviewReports[0],
      assets: [answerAssets[0]]
    });

    expect(markdown).toContain('# 星河智能 产品经理实习生 - 面试复盘');
    expect(markdown).toContain('## 原始问答');
    expect(markdown).toContain('## 关联回答资产');
    expect(markdown).toContain(answerAssets[0].improvedAnswer);
  });

  it('exports a job prep pack with repeated weaknesses and assets', () => {
    const markdown = buildJobPrepMarkdown({
      job: jobFiles[0],
      sessions: [interviewSessions[0]],
      reviews: [reviewReports[0]],
      assets: [answerAssets[0]]
    });

    expect(markdown).toContain('# 星河智能 产品经理实习生 - 考前准备包');
    expect(markdown).toContain('## 高频短板');
    expect(markdown).toContain('## 可复用回答资产');
  });

  it('exports the answer asset library with source metadata', () => {
    const markdown = buildAssetLibraryMarkdown({
      assets: answerAssets,
      jobFiles,
      interviewSessions
    });

    expect(markdown).toContain('# 回答资产合集');
    expect(markdown).toContain('来源岗位：星河智能 产品经理实习生');
    expect(markdown).toContain('使用状态：待实战验证');
  });

  it('creates a safe markdown file name', () => {
    expect(createMarkdownFileName(['星河智能', 'AI/产品经理:一面复盘'])).toBe('星河智能-AI-产品经理-一面复盘.md');
  });
});
