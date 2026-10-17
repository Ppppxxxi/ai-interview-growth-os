import { z } from 'zod';
import { FocusFlowDraftSchema, evidence, generation, modelRationale, answerRationale, version } from '../domain/focusFlowDraft';
import { MaterialLocatorSchema } from '../domain/llmContracts';

const text = z.string().max(50_000);
const id = z.string().min(1).max(200);
const texts = z.array(text).max(10000);
const kind = z.enum(['experience', 'knowledge']);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const tags = z.array(z.string().max(100)).max(20);
const materialFields = { kind, title: z.string().max(500), tags, text, sourceFileName: z.string().max(500).optional(),
  sourceFormat: z.enum(['paste', 'txt', 'markdown', 'docx', 'pdf']), project: text.optional(), responsibility: text.optional(), action: text.optional(), result: text.optional() };
const document = z.object({ id, ...materialFields, version: positive, createdAt: text, updatedAt: text }).strict();
const selection = z.object({ chunkId: id, documentId: id, documentVersion: positive }).strict();
const draft = z.object({ id, ...materialFields, documentId: id.optional(), documentVersion: positive.optional(), questionId: id.optional(),
  version: positive.optional(), createdAt: text.optional(), selectedChunks: z.array(selection).max(6), updatedAt: text }).strict();
const chunk = z.object({ id, documentId: id, documentVersion: positive, kind, title: z.string().max(500), text: z.string().max(1200), locator: MaterialLocatorSchema, tags }).strict();
const job = z.object({ id, company: text, roleTitle: text, direction: text, jdText: text, stage: text, status: text,
  profile: z.object({ responsibilities: texts, abilityKeywords: texts, hiddenRequirements: texts, likelyQuestions: texts }).strict().optional(), interviewSessionIds: z.array(id) }).strict();
const question = z.object({ id, question: text, answer: text, followUps: texts, feedback: text }).strict();
const session = z.object({ id, jobFileId: id, source: z.enum(['builtInMock', 'externalImport']), interviewType: text, createdAt: text, rawConversation: text, questions: z.array(question) }).strict();
const score = z.object({ dimension: z.enum(['roleUnderstanding', 'productAnalysis', 'aiProductThinking', 'dataMetrics', 'projectStorytelling', 'structuredCommunication']), label: text, score: z.number().finite().min(0).max(100), evidence: text, attribution: text, suggestion: text }).strict();
const review = z.object({ id, jobFileId: id, sessionId: id, summary: text, scores: z.array(score), strengths: texts, weaknesses: texts, nextActions: texts }).strict();
const asset = z.object({ id, sourceQuestionId: id.optional(), modelRationale: modelRationale.optional(), evidence: z.array(evidence).optional(), generation: generation.optional(), missingFacts: texts.optional(),
  questionType: text, originalQuestion: text, originalAnswer: text, issue: text, improvedAnswer: text, answerVersions: z.array(version).optional(), applicableRoles: texts,
  applicableQuestions: texts, weaknessTag: text, sourceJobId: text, sourceInterviewId: text, sourceReviewId: text, reuseScope: text, usedInInterview: z.boolean(),
  usageFeedback: z.object({ status: z.enum(['unused', 'used-effective', 'used-needs-polish', 'needs-rewrite']), usedAt: text.optional(), usedForJobId: id.optional(), usedForInterviewId: id.optional(), interviewerFollowUp: text.optional(), outcomeNote: text.optional(), updatedAt: text }).strict().optional(),
  linkedExperienceId: text.optional(), usageNote: text, confidence: z.enum(['high', 'medium', 'low']), confirmationStatus: z.enum(['accepted', 'edited-accepted', 'generated-draft']).optional(), answerRationale: answerRationale.optional() }).strict();
export const WorkspaceSchema = z.object({ version: z.literal(1), jobFiles: z.array(job), interviewSessions: z.array(session), reviewReports: z.array(review), answerAssets: z.array(asset), selectedJobId: text, updatedAt: text }).strict();
export const BackupSchema = z.object({ schemaVersion: z.literal(1), workspace: WorkspaceSchema,
  snapshot: z.object({ documents: z.array(document), chunks: z.array(chunk), drafts: z.array(z.union([draft, FocusFlowDraftSchema])) }).strict() }).strict();

// Bounds also cover the shared typed flow schema, whose editor fields intentionally have no limits.
export function checkBounds(value: unknown, depth = 0): void {
  if (depth > 30 || (typeof value === 'string' && value.length > 50_000) || (Array.isArray(value) && value.length > 10000)) throw new Error('备份字段超出上限');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (key.length > 200 || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('非法备份字段');
    checkBounds(child, depth + 1);
  }
}
