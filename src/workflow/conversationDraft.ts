import { parseImportedConversation } from '../agents/importParser';
import type { InterviewQuestion } from '../domain/types';

export function createEditableQuestions(rawConversation: string, fallbackQuestions: InterviewQuestion[] = []): InterviewQuestion[] {
  const parsedQuestions = parseImportedConversation(rawConversation);
  const sourceQuestions = parsedQuestions.length > 0 ? parsedQuestions : fallbackQuestions;

  return sourceQuestions.length > 0 ? sourceQuestions.map(cloneQuestion) : [createBlankQuestion()];
}

export function updateQuestionField(
  questions: InterviewQuestion[],
  questionId: string,
  field: 'question' | 'answer' | 'feedback',
  value: string
) {
  return questions.map((question) => (question.id === questionId ? { ...question, [field]: value } : question));
}

export function updateQuestionFollowUps(questions: InterviewQuestion[], questionId: string, value: string) {
  const followUps = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return questions.map((question) => (question.id === questionId ? { ...question, followUps } : question));
}

export function hasUsableQuestion(questions: InterviewQuestion[]) {
  return questions.some((question) => question.question.trim() && question.answer.trim());
}

function cloneQuestion(question: InterviewQuestion): InterviewQuestion {
  return {
    ...question,
    followUps: [...question.followUps]
  };
}

function createBlankQuestion(): InterviewQuestion {
  return {
    id: 'q-draft-1',
    question: '',
    answer: '',
    followUps: [],
    feedback: ''
  };
}
