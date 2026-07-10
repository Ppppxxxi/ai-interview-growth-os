import { generateAnswerAsset } from '../agents/answerAssetGenerator';
import { parseImportedConversation } from '../agents/importParser';
import { evaluateInterview } from '../agents/reviewEvaluator';
import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';

type DemoPipelineInput = {
  job: JobFile;
  conversationText: string;
  fallbackConversationText: string;
  questionsOverride?: InterviewSession['questions'];
  runId?: string;
};

type DemoPipelineResult = {
  session: InterviewSession;
  review: ReviewReport;
  asset: AnswerAsset;
};

function makeSession(job: JobFile, rawConversation: string, questions: InterviewSession['questions'], runId = 'generated'): InterviewSession {
  return {
    id: `session-${job.id}-${runId}`,
    jobFileId: job.id,
    source: 'externalImport',
    interviewType: '外部 AI 模拟面试对话导入',
    createdAt: '2026-07-09',
    rawConversation,
    questions
  };
}

export function buildDemoPipelineResult({ conversationText, fallbackConversationText, job, questionsOverride, runId }: DemoPipelineInput): DemoPipelineResult {
  const parsedQuestions = parseImportedConversation(conversationText);
  const hasConfirmedQuestions = Boolean(questionsOverride?.length);
  const rawConversation = hasConfirmedQuestions || parsedQuestions.length > 0 ? conversationText : fallbackConversationText;
  const questions = questionsOverride?.length
    ? questionsOverride
    : parsedQuestions.length > 0
      ? parsedQuestions
      : parseImportedConversation(fallbackConversationText);
  const session = makeSession(job, rawConversation, questions, runId);
  const review = evaluateInterview(job, session);
  const asset = generateAnswerAsset(job, session, review);

  return { session, review, asset };
}
