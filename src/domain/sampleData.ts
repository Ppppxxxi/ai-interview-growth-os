import type { AnswerAsset, Experience, InterviewSession, JobFile, ReviewReport, TrainingTask } from './types';

export const experiences: Experience[] = [
  {
    id: 'exp-research-agent',
    title: 'AI Agent 求职助手调研与原型设计',
    context: '准备 AI 产品经理求职时，发现多轮模拟面试信息割裂、复盘材料难沉淀。',
    task: '定义面试成长产品的核心用户、痛点、功能闭环和 MVP 范围。',
    action: '梳理用户旅程，设计岗位档案、复盘评分、回答资产和训练任务模块。',
    result: '形成可执行 PRD 和可交互 Demo 范围，用于求职作品集展示。',
    abilityTags: ['roleUnderstanding', 'productAnalysis', 'aiProductThinking', 'structuredCommunication'],
    evidenceMetrics: ['完成 1 份中文设计规格', '沉淀 6 个能力评分维度', '定义 5 个 Agent 能力步骤'],
    applicableQuestionTypes: ['AI 产品设计', '用户痛点分析', 'MVP 范围设计']
  },
  {
    id: 'exp-fintech-research',
    title: '金融科技研究项目',
    context: '围绕金融科技场景开展文献、数据和案例研究。',
    task: '将复杂研究材料整理成面向答辩和沟通的结构化内容。',
    action: '提炼研究问题、方法、结论和应用场景，并制作中期答辩材料。',
    result: '提升了复杂信息结构化表达和业务分析能力。',
    abilityTags: ['dataMetrics', 'projectStorytelling', 'structuredCommunication'],
    evidenceMetrics: ['完成研究汇报材料', '沉淀业务分析框架'],
    applicableQuestionTypes: ['项目复盘', '数据分析', '业务理解']
  }
];

export const jobFiles: JobFile[] = [
  {
    id: 'job-ai-pm-a',
    company: '星河智能',
    roleTitle: 'AI 产品经理实习生',
    direction: 'AI 产品经理',
    jdText: '负责 AI Agent 产品需求分析、用户调研、指标设计、模型效果评估和跨团队协作。',
    stage: '一面准备',
    status: '已完成 2 次模拟',
    interviewSessionIds: ['session-ai-pm-a-1']
  },
  {
    id: 'job-platform-pm-b',
    company: '云启科技',
    roleTitle: '平台产品经理',
    direction: '平台产品',
    jdText: '负责企业内部效率平台的信息架构、权限流程、数据看板和需求优先级管理。',
    stage: '简历筛选',
    status: '待模拟',
    interviewSessionIds: []
  }
];

export const interviewSessions: InterviewSession[] = [
  {
    id: 'session-ai-pm-a-1',
    jobFileId: 'job-ai-pm-a',
    source: 'externalImport',
    interviewType: 'AI 产品经理综合面',
    createdAt: '2026-07-01',
    rawConversation: `面试官：请设计一个面向产品经理求职者的 AI 模拟面试产品。
候选人：我会做一个 AI 面试助手，帮助用户生成问题并给出反馈。
面试官追问：你如何评估这个 AI 产品的效果？
AI 点评：回答有方向，但缺少模型边界、结构化复盘和可量化指标。`,
    questions: [
      {
        id: 'q-1',
        question: '请设计一个面向产品经理求职者的 AI 模拟面试产品。',
        answer: '我会做一个 AI 面试助手，帮助用户生成问题并给出反馈。',
        followUps: ['你如何评估这个 AI 产品的效果？'],
        feedback: '回答有方向，但缺少模型边界、结构化复盘和可量化指标。'
      }
    ]
  }
];

export const reviewReports: ReviewReport[] = [
  {
    id: 'review-ai-pm-a-1',
    jobFileId: 'job-ai-pm-a',
    sessionId: 'session-ai-pm-a-1',
    summary: '候选人能识别基础需求，但 AI 产品落地、指标设计和复盘资产化表达不足。',
    scores: [
      {
        dimension: 'aiProductThinking',
        label: 'AI 产品理解',
        score: 2,
        evidence: '回答只提到生成问题和反馈，没有说明 Agent 流程、失败兜底和效果评估。',
        attribution: '停留在功能层，缺少 AI 产品落地视角。',
        suggestion: '补充任务拆解、人工确认节点、模型输出质量评估和安全边界。'
      },
      {
        dimension: 'dataMetrics',
        label: '数据与指标',
        score: 2,
        evidence: '只提到用户满意度和使用次数。',
        attribution: '指标过粗，无法判断用户是否真正提升面试准备质量。',
        suggestion: '加入复盘完成率、回答资产复用率、重复短板下降率等指标。'
      }
    ],
    strengths: ['能快速识别求职者需要模拟面试和反馈。'],
    weaknesses: ['AI 产品边界不清晰', '指标体系不完整', '缺少跨面试经验迁移机制'],
    nextActions: ['补充 AI Agent 工作流', '重写指标体系回答', '准备一个失败兜底案例']
  }
];

export const answerAssets: AnswerAsset[] = [
  {
    id: 'asset-ai-product-metrics',
    questionType: 'AI 产品效果评估',
    originalAnswer: '可以看用户满意度和使用次数。',
    improvedAnswer: '我会从过程、结果和长期成长三层评估：过程看复盘完成率，结果看回答资产复用率和模拟后回答评分提升，长期看重复短板出现频率是否下降。',
    applicableRoles: ['AI 产品经理', '平台产品经理'],
    linkedExperienceId: 'exp-research-agent',
    usageNote: '适合回答 AI 产品如何定义成功指标。',
    confidence: 'high'
  }
];

export const trainingTasks: TrainingTask[] = [
  {
    id: 'task-agent-boundary',
    goal: '补强 AI Agent 边界与兜底设计表达',
    dimension: 'aiProductThinking',
    practiceQuestion: '如果 AI 面试官给出错误建议，你会如何设计产品兜底机制？',
    referenceFramework: '场景识别 -> 风险类型 -> 置信度判断 -> 人工确认 -> 用户提示 -> 复盘记录',
    dueLabel: '下一次模拟前',
    status: 'open'
  }
];
