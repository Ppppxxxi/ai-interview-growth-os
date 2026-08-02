import type {
  AnswerAsset,
  AnswerAssetConfirmationStatus,
  InterviewMaterialDraft,
  InterviewMaterialDraftItem,
  InterviewSession,
  JobFile,
  ReviewReport
} from '../domain/types';

type MaterialImportSaveInput = {
  draft: InterviewMaterialDraft;
  selectedItemIds: Iterable<string>;
  confirmationStatuses?: ReadonlyMap<string, AnswerAssetConfirmationStatus>;
  job: JobFile;
  rawText: string;
  runId?: string;
};

type MaterialImportSavePayload = {
  session: InterviewSession;
  review: ReviewReport;
  assets: AnswerAsset[];
};

const sourceTypeLabels: Record<InterviewMaterialDraft['sourceType'], string> = {
  mock_interview_dialogue: 'AI 模拟面试对话导入',
  real_interview_memory: '真实面试回忆导入',
  review_notes: '复盘笔记导入',
  mixed_material: '混合面试材料导入'
};

function safeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildQuestion(item: InterviewMaterialDraftItem, index: number): InterviewSession['questions'][number] {
  return {
    id: `q-material-${index + 1}-${safeId(item.id || item.title)}`,
    question: item.question || item.title,
    answer: item.originalAnswer || '未提供原回答，请在复盘详情中补充。',
    followUps: item.followUps ?? [],
    feedback: item.issue || item.improvementSuggestion || '待补充具体问题点。'
  };
}

function buildFallbackAnswer(item: InterviewMaterialDraftItem, job: JobFile) {
  return `我会先结合${job.company} ${job.roleTitle}的业务场景说明问题背景，再给出判断框架、关键取舍和验证指标。这个回答需要在保存后结合我的真实经历继续补充案例。`;
}

function buildReuseScope(job: JobFile) {
  return `适用于${job.direction}同岗位多轮或同方向类似问题，跨岗位使用前需要重新贴合业务场景。`;
}

function buildAsset({
  item,
  job,
  reviewId,
  sessionId,
  confirmationStatus = 'accepted'
}: {
  item: InterviewMaterialDraftItem;
  job: JobFile;
  reviewId: string;
  sessionId: string;
  confirmationStatus?: AnswerAssetConfirmationStatus;
}): AnswerAsset {
  const reuseScope = buildReuseScope(job);

  return {
    id: `asset-${sessionId}-${safeId(item.id || item.title)}`,
    questionType: item.title,
    originalQuestion: item.question || item.title,
    originalAnswer: item.originalAnswer || '未提供原回答，请使用前补充真实经历。',
    issue: item.issue || item.improvementSuggestion || '需要补充具体问题点。',
    improvedAnswer: item.improvedAnswer || buildFallbackAnswer(item, job),
    applicableRoles: [job.direction, `${job.direction}同方向岗位`],
    applicableQuestions: [item.question || item.title, ...(item.followUps ?? [])].filter(Boolean),
    weaknessTag: item.issue || item.title,
    sourceJobId: job.id,
    sourceInterviewId: sessionId,
    sourceReviewId: reviewId,
    reuseScope,
    usedInInterview: false,
    usageNote:
      item.confidence === 'low'
        ? '低置信草稿，使用前必须补充真实经历和岗位场景。'
        : confirmationStatus === 'edited-accepted'
          ? '这条回答已经修改后采用，使用前仍建议补充具体业务场景。'
          : '这条回答已经确认采用，后续面试前请再核对真实经历和岗位场景。',
    confidence: item.confidence,
    confirmationStatus,
    answerRationale: {
      sourceQuestion: item.question || item.title,
      originalIssue: item.issue || item.improvementSuggestion || '需要补充具体问题点。',
      rewriteFocus: item.improvementSuggestion || '补充结构、判断依据和可验证指标。',
      applicabilityBoundary: reuseScope
    }
  };
}

export function buildMaterialImportSavePayload({
  draft,
  confirmationStatuses,
  job,
  rawText,
  runId = Date.now().toString(36),
  selectedItemIds
}: MaterialImportSaveInput): MaterialImportSavePayload {
  const selectedIds = new Set(selectedItemIds);
  const sessionId = `session-${job.id}-material-${safeId(runId)}`;
  const reviewId = `review-${sessionId}`;
  const items = draft.interviewItems.length > 0 ? draft.interviewItems : [];
  const selectedAssetItems = items.filter((item) => selectedIds.has(item.id) && item.answerAssetCandidate);

  const session: InterviewSession = {
    id: sessionId,
    jobFileId: job.id,
    source: 'externalImport',
    interviewType: sourceTypeLabels[draft.sourceType],
    createdAt: today(),
    rawConversation: rawText,
    questions: items.map(buildQuestion)
  };

  const review: ReviewReport = {
    id: reviewId,
    jobFileId: job.id,
    sessionId,
    summary: draft.globalInsights.summary || '已基于导入材料生成可确认复盘草稿。',
    scores: [],
    strengths: draft.globalInsights.strengths ?? [],
    weaknesses: draft.globalInsights.weaknesses ?? items.map((item) => item.issue || item.title).slice(0, 3),
    nextActions:
      draft.globalInsights.nextPrepTopics ??
      selectedAssetItems.map((item) => item.question || item.title).slice(0, 2)
  };

  return {
    session,
    review,
    assets: selectedAssetItems.map((item) =>
      buildAsset({
        item,
        job,
        reviewId,
        sessionId,
        confirmationStatus: confirmationStatuses?.get(item.id) ?? 'accepted'
      })
    )
  };
}
