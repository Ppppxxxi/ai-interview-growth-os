import type { InterviewQuestion } from '../domain/types';

function cleanLine(line: string, prefix: string) {
  return line.replace(prefix, '').trim();
}

export function parseImportedConversation(raw: string): InterviewQuestion[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const questions: InterviewQuestion[] = [];
  let current: InterviewQuestion | null = null;

  for (const line of lines) {
    if (line.startsWith('面试官：') && !line.startsWith('面试官追问：')) {
      if (current) questions.push(current);
      current = {
        id: `q-${questions.length + 1}`,
        question: cleanLine(line, '面试官：'),
        answer: '',
        followUps: [],
        feedback: ''
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('候选人：')) {
      current.answer = cleanLine(line, '候选人：');
    } else if (line.startsWith('面试官追问：')) {
      current.followUps.push(cleanLine(line, '面试官追问：'));
    } else if (line.startsWith('AI 点评：')) {
      current.feedback = cleanLine(line, 'AI 点评：');
    }
  }

  if (current) questions.push(current);
  return questions;
}
