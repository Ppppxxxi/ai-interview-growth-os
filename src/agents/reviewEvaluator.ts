import type { AbilityDimension, AbilityScore, InterviewSession, JobFile, ReviewReport } from '../domain/types';

const labels: Record<AbilityDimension, string> = {
  roleUnderstanding: '岗位理解',
  productAnalysis: '产品分析',
  aiProductThinking: 'AI 产品理解',
  dataMetrics: '数据与指标',
  projectStorytelling: '项目表达',
  structuredCommunication: '沟通与结构化'
};

function textOf(session: InterviewSession) {
  return session.questions.map((item) => `${item.question} ${item.answer} ${item.feedback}`).join(' ');
}

function makeScore(dimension: AbilityDimension, score: number, evidence: string, attribution: string, suggestion: string): AbilityScore {
  return {
    dimension,
    label: labels[dimension],
    score,
    evidence,
    attribution,
    suggestion
  };
}

export function evaluateInterview(job: JobFile, session: InterviewSession): ReviewReport {
  const text = textOf(session);
  const mentionsAgent = /Agent|模型|大模型|AI/.test(text);
  const mentionsFallback = /兜底|边界|失败|人工确认|幻觉/.test(text);
  const mentionsMetrics = /指标|复盘完成率|转化|留存|满意度|使用次数|评估/.test(text);
  const onlyGenericMetrics = /满意度|使用次数/.test(text) && !/复盘完成率|复用率|提升|下降/.test(text);

  const aiScore = mentionsAgent && mentionsFallback ? 4 : mentionsAgent ? 2 : 1;
  const metricScore = mentionsMetrics && !onlyGenericMetrics ? 4 : mentionsMetrics ? 2 : 1;

  const scores: AbilityScore[] = [
    makeScore(
      'roleUnderstanding',
      job.jdText.length > 0 ? 3 : 2,
      `岗位方向为「${job.direction}」，回答围绕 ${job.roleTitle} 展开。`,
      '能识别岗位主题，但仍需补充公司业务和用户场景。',
      '回答开头先说明目标用户、业务场景和岗位职责，再进入方案。'
    ),
    makeScore(
      'productAnalysis',
      text.includes('用户') || text.includes('需求') ? 3 : 2,
      '回答包含基础产品方向，但用户、场景、需求和优先级拆解不足。',
      '偏功能描述，缺少产品分析链路。',
      '使用 用户-场景-痛点-方案-优先级 的结构重写。'
    ),
    makeScore(
      'aiProductThinking',
      aiScore,
      mentionsAgent ? '回答提到了 AI 或 Agent，但对模型边界和兜底机制展开不足。' : '回答未体现 AI 产品特有问题。',
      'AI 产品表达停留在功能层。',
      '补充 Agent 任务拆解、模型输出风险、人工确认节点和失败兜底机制。'
    ),
    makeScore(
      'dataMetrics',
      metricScore,
      mentionsMetrics ? '回答提到了效果评估，但指标颗粒度仍偏粗。' : '回答未说明如何评估产品效果。',
      '指标体系不足以判断用户是否真正提升面试准备质量。',
      '加入复盘完成率、回答资产复用率、模拟后评分提升、重复短板下降率。'
    ),
    makeScore(
      'projectStorytelling',
      text.includes('我') ? 3 : 2,
      '回答能表达个人想法，但没有完整说明背景、行动和结果。',
      '项目表达缺少 STAR 结构。',
      '用 背景-任务-行动-结果 重写关键经历。'
    ),
    makeScore(
      'structuredCommunication',
      text.length > 40 ? 3 : 2,
      '回答能覆盖基本方向，但层次和结论前置不足。',
      '表达顺序影响面试官快速抓重点。',
      '先给结论，再分 3 点展开，最后补充指标或案例。'
    )
  ];

  const weaknesses = [
    ...(aiScore <= 2 ? ['AI 产品边界表达不足'] : []),
    ...(metricScore <= 2 ? ['指标体系不完整'] : []),
    '跨面试经验迁移机制需要讲清楚'
  ];

  return {
    id: `review-${session.id}`,
    jobFileId: job.id,
    sessionId: session.id,
    summary: '本轮回答具备基础方向，但需要补强 AI 产品落地、指标体系和结构化表达。',
    scores,
    strengths: ['能快速识别面试准备场景中的基础需求。'],
    weaknesses,
    nextActions: ['重写 AI 产品效果评估回答', '补充模型失败兜底案例', '沉淀 3 条可复用回答资产']
  };
}
