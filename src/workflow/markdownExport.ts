import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';
import { getAssetUsageStatus, usageStatusLabels } from './assetUsageFeedback';

export type InterviewReviewExportInput = {
  job: JobFile;
  session: InterviewSession;
  review: ReviewReport;
  assets: AnswerAsset[];
};

export type JobPrepExportInput = {
  job: JobFile;
  sessions: InterviewSession[];
  reviews: ReviewReport[];
  assets: AnswerAsset[];
};

export type AssetLibraryExportInput = {
  assets: AnswerAsset[];
  jobFiles: JobFile[];
  interviewSessions: InterviewSession[];
};

export function buildInterviewReviewMarkdown({ assets, job, review, session }: InterviewReviewExportInput) {
  const lines = [
    `# ${job.company} ${job.roleTitle} - 面试复盘`,
    '',
    `- 岗位方向：${job.direction}`,
    `- 面试记录：${session.interviewType}`,
    `- 面试日期：${session.createdAt}`,
    '',
    '## 一句话总结',
    '',
    review.summary,
    '',
    '## 原始问答',
    '',
    ...session.questions.flatMap((question, index) => [
      `### 问题 ${index + 1}`,
      '',
      `**面试问题：** ${question.question}`,
      '',
      `**我的回答：** ${question.answer}`,
      '',
      question.followUps.length > 0 ? `**追问：** ${question.followUps.join('；')}` : '',
      '',
      question.feedback ? `**AI 点评：** ${question.feedback}` : '',
      ''
    ]),
    '## 复盘结论',
    '',
    '### 优势',
    '',
    ...toList(review.strengths),
    '',
    '### 需要补强',
    '',
    ...toList(review.weaknesses),
    '',
    '### 下一步准备',
    '',
    ...toList(review.nextActions),
    '',
    '## 关联回答资产',
    '',
    ...formatAssets(assets)
  ];

  return compactMarkdown(lines);
}

export function buildJobPrepMarkdown({ assets, job, reviews, sessions }: JobPrepExportInput) {
  const repeatedWeaknesses = reviews.flatMap((review) => review.weaknesses);
  const nextActions = reviews.flatMap((review) => review.nextActions);

  const lines = [
    `# ${job.company} ${job.roleTitle} - 考前准备包`,
    '',
    `- 岗位方向：${job.direction}`,
    `- 当前阶段：${job.stage}`,
    `- 已沉淀面试记录：${sessions.length} 场`,
    `- 已沉淀回答资产：${assets.length} 条`,
    '',
    '## JD 摘要',
    '',
    job.jdText || '暂无 JD 文本。',
    '',
    '## 高频短板',
    '',
    ...toList(unique(repeatedWeaknesses)),
    '',
    '## 考前优先准备',
    '',
    ...toList(unique(nextActions).slice(0, 8)),
    '',
    '## 可复用回答资产',
    '',
    ...formatAssets(assets),
    '',
    '## 历史面试记录',
    '',
    ...sessions.flatMap((session, index) => [
      `### ${index + 1}. ${session.interviewType}`,
      '',
      `- 日期：${session.createdAt}`,
      `- 问题数：${session.questions.length}`,
      ''
    ])
  ];

  return compactMarkdown(lines);
}

export function buildAssetLibraryMarkdown({ assets, interviewSessions, jobFiles }: AssetLibraryExportInput) {
  const jobsById = new Map(jobFiles.map((job) => [job.id, job]));
  const sessionsById = new Map(interviewSessions.map((session) => [session.id, session]));

  const lines = [
    '# 回答资产合集',
    '',
    `- 导出资产数：${assets.length}`,
    '',
    ...assets.flatMap((asset, index) => {
      const sourceJob = jobsById.get(asset.sourceJobId);
      const sourceSession = sessionsById.get(asset.sourceInterviewId);
      return [
        `## ${index + 1}. ${asset.questionType}`,
        '',
        `- 来源岗位：${sourceJob ? `${sourceJob.company} ${sourceJob.roleTitle}` : asset.sourceJobId}`,
        `- 来源面试：${sourceSession ? `${sourceSession.interviewType} ${sourceSession.createdAt}` : asset.sourceInterviewId}`,
        `- 使用状态：${usageStatusLabels[getAssetUsageStatus(asset)]}`,
        `- 能力短板：${asset.weaknessTag}`,
        '',
        `**原问题：** ${asset.originalQuestion}`,
        '',
        `**原回答：** ${asset.originalAnswer}`,
        '',
        `**具体问题：** ${asset.issue}`,
        '',
        '**优化回答：**',
        '',
        asset.improvedAnswer,
        '',
        '**适用类似问题：**',
        '',
        ...toList(asset.applicableQuestions),
        '',
        asset.usageFeedback?.interviewerFollowUp ? `**面试官追问：** ${asset.usageFeedback.interviewerFollowUp}` : '',
        asset.usageFeedback?.outcomeNote ? `**使用后复盘：** ${asset.usageFeedback.outcomeNote}` : '',
        ''
      ];
    })
  ];

  return compactMarkdown(lines);
}

export function createMarkdownFileName(parts: string[]) {
  const baseName = parts
    .filter(Boolean)
    .join('-')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${baseName || 'ai-interview-export'}.md`;
}

function formatAssets(assets: AnswerAsset[]) {
  if (assets.length === 0) return ['暂无关联回答资产。'];

  return assets.flatMap((asset, index) => [
    `### ${index + 1}. ${asset.questionType}`,
    '',
    `**原问题：** ${asset.originalQuestion}`,
    '',
    `**问题点：** ${asset.issue}`,
    '',
    '**优化回答：**',
    '',
    asset.improvedAnswer,
    '',
    `**使用状态：** ${usageStatusLabels[getAssetUsageStatus(asset)]}`,
    ''
  ]);
}

function toList(values: string[]) {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ['- 暂无'];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function compactMarkdown(lines: string[]) {
  return lines
    .map((line) => line.trimEnd())
    .filter((line, index, source) => line !== '' || source[index - 1] !== '')
    .join('\n')
    .trim()
    .concat('\n');
}
