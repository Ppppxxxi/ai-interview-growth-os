import type { AnswerAsset, Experience, InterviewSession, JobFile, ReviewReport, TrainingTask } from './types';

export const coldStartDemo = {
  jobId: 'job-ai-pm-a',
  interviewId: 'session-ai-pm-a-1',
  reviewId: 'review-ai-pm-a-1',
  assetId: 'asset-session-ai-pm-a-1',
  importedConversation: `面试官：你如何评估一个面向产品经理求职者的 AI 面试成长产品是否有效？
候选人：可以看用户满意度和使用次数，如果用户愿意持续使用，就说明产品有价值。
面试官追问：这些指标如何证明用户真实面试准备质量提升？
AI 点评：回答过于泛化，缺少过程指标、结果指标和长期复用指标，也没有说明如何验证回答资产是否真的被下次面试复用。`
};

export const experiences: Experience[] = [
  {
    id: 'exp-research-agent',
    title: 'AI Agent 求职助手调研与原型设计',
    context: '准备 AI 产品经理求职时，发现模拟面试对话分散在不同 session，复盘和优化回答难以沉淀。',
    task: '定义面试成长系统的核心闭环：外部对话导入、结构化复盘、回答资产沉淀和后续复用。',
    action: '梳理冷启动路径，设计岗位工作台、复盘解释、回答资产生成和同方向复用机制。',
    result: '形成可展示的本地 Demo，用于说明 AI 产品经理对用户痛点、AI Agent 边界和 MVP 取舍的理解。',
    abilityTags: ['roleUnderstanding', 'productAnalysis', 'aiProductThinking', 'structuredCommunication'],
    evidenceMetrics: ['完成 1 条端到端 Demo 数据链路', '沉淀 1 条高价值回答资产', '定义 5 个 mock agent 合约'],
    applicableQuestionTypes: ['AI 产品效果评估', 'MVP 范围设计', '面试复盘产品设计']
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
    jdText: '负责 AI Agent 产品需求分析、用户调研、指标设计、模型效果评估和跨团队协作；需要能将模型能力转化为用户可感知的产品价值，并设计可验证的效果指标。',
    stage: '一面后复盘',
    status: '已生成 1 条回答资产',
    interviewSessionIds: ['session-ai-pm-a-1']
  },
  {
    id: 'job-ai-pm-b',
    company: '云启科技',
    roleTitle: 'AI 助手产品经理',
    direction: 'AI 产品经理',
    jdText: '负责企业 AI 助手的需求分析、效果评估、知识库体验优化和用户反馈闭环。',
    stage: '同方向准备',
    status: '可复用 1 条回答资产',
    interviewSessionIds: []
  },
  {
    id: 'job-platform-pm-c',
    company: '澜舟协同',
    roleTitle: '平台产品经理',
    direction: '平台产品',
    jdText: '负责内部效率平台的信息架构、权限流程、数据看板和需求优先级管理。',
    stage: '后续增强',
    status: '待补充面试记录',
    interviewSessionIds: []
  }
];

export const interviewSessions: InterviewSession[] = [
  {
    id: 'session-ai-pm-a-1',
    jobFileId: 'job-ai-pm-a',
    source: 'externalImport',
    interviewType: '外部 AI 模拟面试导入',
    createdAt: '2026-07-01',
    rawConversation: coldStartDemo.importedConversation,
    questions: [
      {
        id: 'q-ai-metrics',
        question: '你如何评估一个面向产品经理求职者的 AI 面试成长产品是否有效？',
        answer: '可以看用户满意度和使用次数，如果用户愿意持续使用，就说明产品有价值。',
        followUps: ['这些指标如何证明用户真实面试准备质量提升？'],
        feedback: '回答过于泛化，缺少过程指标、结果指标和长期复用指标，也没有说明如何验证回答资产是否真的被下次面试复用。'
      }
    ]
  }
];

export const reviewReports: ReviewReport[] = [
  {
    id: 'review-ai-pm-a-1',
    jobFileId: 'job-ai-pm-a',
    sessionId: 'session-ai-pm-a-1',
    summary: '原回答能意识到要评估产品效果，但停留在满意度和使用次数，无法证明用户面试准备质量是否真的提升。',
    scores: [
      {
        dimension: 'dataMetrics',
        label: '数据与指标',
        score: 2,
        evidence: '原回答只说“用户满意度和使用次数”。',
        attribution: '指标过粗，只能证明用户用了产品，不能证明回答质量提升或资产被复用。',
        suggestion: '改为过程指标、结果指标和长期复用指标三层结构。'
      },
      {
        dimension: 'aiProductThinking',
        label: 'AI 产品思维',
        score: 3,
        evidence: '能围绕 AI 面试成长产品展开，但没有说明模型输出如何被用户确认和沉淀。',
        attribution: '缺少 AI 产品中的人机协同和资产确认节点。',
        suggestion: '补充“用户确认后保存为回答资产”的闭环。'
      }
    ],
    strengths: ['能快速识别 AI 面试产品需要效果评估。'],
    weaknesses: ['指标体系不完整', '没有说明回答资产如何复用'],
    nextActions: ['重写 AI 产品效果评估回答', '准备“回答资产复用率”相关追问', '补充用户确认保存资产的产品机制']
  }
];

export const answerAssets: AnswerAsset[] = [
  {
    id: 'asset-session-ai-pm-a-1',
    questionType: 'AI 产品效果评估',
    originalQuestion: '你如何评估一个面向产品经理求职者的 AI 面试成长产品是否有效？',
    originalAnswer: '可以看用户满意度和使用次数，如果用户愿意持续使用，就说明产品有价值。',
    issue: '指标体系不完整：满意度和使用次数只能证明用户用了产品，不能证明面试准备质量提升，也无法证明回答资产在后续面试中被复用。',
    improvedAnswer:
      '我会从过程指标、结果指标和长期复用指标三层评估。过程指标看用户是否完成 JD 导入、外部面试对话导入和复盘确认；结果指标看优化回答采纳率、回答资产保存率、同岗位后续模拟中的回答质量提升；长期复用指标看同一短板在后续面试中是否减少，以及回答资产是否被用于同岗位多轮或同方向类似问题。这样既能判断用户有没有使用产品，也能判断产品是否真的提升了面试准备质量。',
    applicableRoles: ['AI 产品经理', '同方向 AI 产品岗位'],
    applicableQuestions: ['如何评估一个 AI 产品是否有效？', '如何设计 AI Agent 产品的成功指标？', '如何证明用户面试准备质量提升？'],
    weaknessTag: '指标体系不完整',
    sourceJobId: 'job-ai-pm-a',
    sourceInterviewId: 'session-ai-pm-a-1',
    sourceReviewId: 'review-ai-pm-a-1',
    reuseScope: '同岗位多轮 / 同方向类似岗位',
    usedInInterview: false,
    linkedExperienceId: 'exp-research-agent',
    usageNote: '适合在星河智能后续轮次，或其他 AI 产品经理岗位被问到“产品效果评估 / 指标体系”时复用；使用前补一句具体业务场景。',
    confidence: 'high'
  },
  {
    id: 'asset-demand-priority',
    questionType: '需求优先级判断',
    originalQuestion: '如何判断一个内部效率平台需求是否值得做？',
    originalAnswer: '我会看用户反馈和业务方优先级。',
    issue: '判断标准不够具体，缺少影响面、频次、收益和成本维度。',
    improvedAnswer:
      '我会先明确业务目标和核心用户，再从影响面、问题频次、收益强度、实现成本和风险约束五个维度判断优先级。对于高争议需求，我会先做低成本验证或灰度上线，用数据判断是否继续投入。',
    applicableRoles: ['平台产品经理', 'AI 产品经理'],
    applicableQuestions: ['如何判断一个需求是否值得做？', '如果业务方都说自己优先级最高怎么办？'],
    weaknessTag: '指标体系不完整',
    sourceJobId: 'job-platform-pm-c',
    sourceInterviewId: 'session-platform-pm-demo',
    sourceReviewId: 'review-platform-pm-demo',
    reuseScope: '同方向类似岗位',
    usedInInterview: true,
    linkedExperienceId: 'exp-fintech-research',
    usageNote: '适合平台产品或 AI 产品中的需求取舍问题，回答时要补充具体业务目标。',
    confidence: 'medium'
  }
];

export const trainingTasks: TrainingTask[] = [
  {
    id: 'task-metrics-system',
    goal: '下一场面试前练熟 AI 产品效果评估回答',
    dimension: 'dataMetrics',
    practiceQuestion: '如何证明用户使用 AI 面试成长产品后，真实面试准备质量提升了？',
    referenceFramework: '过程指标 -> 结果指标 -> 长期复用指标 -> 用户确认保存资产',
    dueLabel: '星河智能二面前',
    status: 'open'
  },
  {
    id: 'task-agent-boundary',
    goal: '补充回答资产生成的人机确认机制',
    dimension: 'aiProductThinking',
    practiceQuestion: '如果 AI 生成的优化回答不符合用户真实经历，你会如何设计确认和兜底？',
    referenceFramework: 'AI 草稿 -> 用户编辑确认 -> 来源追溯 -> 风险提示 -> 保存资产',
    dueLabel: '下一场 AI 产品面前',
    status: 'open'
  }
];
