import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';

function pickPrimaryWeakness(report: ReviewReport) {
  return report.weaknesses[0] ?? '回答缺少可验证证据';
}

function inferQuestionType(question: string, weakness: string) {
  if (question.includes('评估') || weakness.includes('指标')) return 'AI 产品效果评估';
  if (question.includes('需求') || question.includes('优先级')) return '需求优先级判断';
  return '产品方案复盘';
}

function buildImprovedAnswer(questionType: string) {
  if (questionType === 'AI 产品效果评估') {
    return '我会从过程指标、结果指标和长期复用指标三层评估。过程指标看用户是否完成 JD 导入、对话导入和复盘确认；结果指标看优化回答采纳率、回答资产复用率、下次模拟回答质量提升；长期指标看同一短板在后续面试中的出现频率是否下降。这样既能判断用户有没有使用产品，也能判断产品是否真的提升了面试准备质量。';
  }

  if (questionType === '需求优先级判断') {
    return '我会先明确业务目标和核心用户，再从影响面、问题频次、收益强度、实现成本和风险约束五个维度判断优先级。对于高争议需求，我会先做低成本验证或灰度上线，用数据判断是否继续投入。';
  }

  return '我会先给出结论，再按背景、问题、行动、结果展开，并补充可验证指标说明这段经历为什么能迁移到当前岗位。';
}

export function generateAnswerAsset(job: JobFile, session: InterviewSession, report: ReviewReport): AnswerAsset {
  const primaryQuestion = session.questions[0];
  const weakness = pickPrimaryWeakness(report);
  const questionType = inferQuestionType(primaryQuestion?.question ?? '', weakness);

  return {
    id: `asset-${session.id}`,
    questionType,
    originalQuestion: primaryQuestion?.question ?? '未识别到原始问题',
    originalAnswer: primaryQuestion?.answer ?? '未识别到原始回答',
    issue: `${weakness}：${primaryQuestion?.feedback ?? report.summary}`,
    improvedAnswer: buildImprovedAnswer(questionType),
    applicableRoles: [job.direction, `同方向 ${job.direction.replace('经理', '')}岗位`],
    applicableQuestions:
      questionType === 'AI 产品效果评估'
        ? ['如何评估一个 AI 产品是否有效？', '如何设计 AI Agent 产品的成功指标？', '如何证明用户面试准备质量提升？']
        : ['如何判断一个需求是否值得做？', '如果业务方都说自己优先级最高怎么办？'],
    weaknessTag: weakness,
    sourceJobId: job.id,
    sourceInterviewId: session.id,
    sourceReviewId: report.id,
    reuseScope: '同岗位多轮 / 同方向类似岗位',
    usedInInterview: false,
    linkedExperienceId: 'exp-research-agent',
    usageNote: '适合在同一岗位后续轮次或 AI 产品方向相似问题中复用，使用前应结合具体公司业务补一句场景化指标。',
    confidence: 'high'
  };
}
