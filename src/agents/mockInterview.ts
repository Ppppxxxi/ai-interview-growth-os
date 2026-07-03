import type { Experience, InterviewSession, JobProfile } from '../domain/types';

export function generateMockInterview(jobFileId: string, profile: JobProfile, experiences: Experience[]): InterviewSession {
  const questions = [
    ...profile.likelyQuestions.slice(0, 2).map((question, index) => ({
      id: `mock-q-${index + 1}`,
      question,
      answer: '',
      followUps: ['请结合一个具体项目说明你的判断。'],
      feedback: '等待用户回答后生成点评。'
    })),
    ...experiences.slice(0, 1).map((experience, index) => ({
      id: `mock-exp-${index + 1}`,
      question: `请介绍「${experience.title}」中最能证明你产品能力的一段经历。`,
      answer: '',
      followUps: ['这段经历的结果如何量化？'],
      feedback: '等待用户回答后生成点评。'
    }))
  ];

  return {
    id: `mock-${jobFileId}`,
    jobFileId,
    source: 'builtInMock',
    interviewType: '内置模拟面试',
    createdAt: new Date().toISOString().slice(0, 10),
    rawConversation: '',
    questions
  };
}
