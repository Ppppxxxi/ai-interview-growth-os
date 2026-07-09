import { generateAnswerAsset } from '../agents/answerAssetGenerator';
import { parseImportedConversation } from '../agents/importParser';
import { evaluateInterview } from '../agents/reviewEvaluator';
import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';

type DemoPipelineInput = {
  job: JobFile;
  conversationText: string;
  fallbackConversationText: string;
};

type DemoPipelineResult = {
  session: InterviewSession;
  review: ReviewReport;
  asset: AnswerAsset;
};

function makeSession(job: JobFile, rawConversation: string, questions: InterviewSession['questions']): InterviewSession {
  return {
    id: `session-${job.id}-generated`,
    jobFileId: job.id,
    source: 'externalImport',
    interviewType: '外部 AI 模拟面试对话导入',
    createdAt: '2026-07-09',
    rawConversation,
    questions
  };
}

export function buildDemoPipelineResult({ conversationText, fallbackConversationText, job }: DemoPipelineInput): DemoPipelineResult {
  const parsedQuestions = parseImportedConversation(conversationText);
  const rawConversation = parsedQuestions.length > 0 ? conversationText : fallbackConversationText;
  const questions = parsedQuestions.length > 0 ? parsedQuestions : parseImportedConversation(fallbackConversationText);
  const session = makeSession(job, rawConversation, questions);
  const review = evaluateInterview(job, session);
  const asset = generateAnswerAsset(job, session, review);

  return { session, review, asset };
}
