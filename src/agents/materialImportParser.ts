import { parseImportedConversation } from './importParser';
import type {
  InterviewMaterialDraft,
  InterviewMaterialDraftItem,
  InterviewMaterialInputType,
  InterviewMaterialSourceType,
  JobFile
} from '../domain/types';

type MaterialImportParserInput = {
  rawText: string;
  sourceType: InterviewMaterialInputType;
  fallbackJob?: JobFile;
};

const companyKeywords = ['晴川智能', '星河智能', '云启科技', '澜舟协同'];

function normalizeText(text: string) {
  return text.replace(/\r\n/g, '\n').trim();
}

function toId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function extractAfterLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}[：:]\\s*([^\\n]+)`);
    const matched = text.match(pattern);
    if (matched?.[1]) return matched[1].trim();
  }
  return undefined;
}

function inferSourceType(text: string, requestedType: InterviewMaterialInputType): InterviewMaterialSourceType {
  if (requestedType !== 'auto') return requestedType;
  if (/面试官[：:]|候选人[：:]|AI 点评[：:]/.test(text)) return 'mock_interview_dialogue';
  if (/复盘|总结|问题点|改进|短板/.test(text)) return 'review_notes';
  if (/真实面试|面试回忆|一面|二面|终面/.test(text)) return 'real_interview_memory';
  return 'mixed_material';
}

function extractJobContext(text: string, fallbackJob?: JobFile): InterviewMaterialDraft['jobContext'] {
  const companyFromLabel = extractAfterLabel(text, ['公司', '目标公司']);
  const roleFromLabel = extractAfterLabel(text, ['岗位', '目标岗位', '职位']);
  const directionFromLabel = extractAfterLabel(text, ['方向', '岗位方向']);
  const companyFromKeyword = companyKeywords.find((company) => text.includes(company));

  return {
    company: companyFromLabel ?? companyFromKeyword ?? fallbackJob?.company,
    role: roleFromLabel ?? fallbackJob?.roleTitle,
    direction: directionFromLabel ?? fallbackJob?.direction,
    jdText: extractAfterLabel(text, ['JD', '岗位描述']) ?? fallbackJob?.jdText
  };
}

function excerpt(text: string, keywords: string[]) {
  const keyword = keywords.find((item) => text.includes(item));
  if (!keyword) return undefined;
  const index = text.indexOf(keyword);
  const start = Math.max(0, index - 48);
  const end = Math.min(text.length, index + 96);
  return text.slice(start, end).replace(/\n+/g, ' ').trim();
}

function makeItem(input: {
  id: string;
  title: string;
  question: string;
  originalAnswer?: string;
  issue: string;
  evidence?: string;
  improvementSuggestion: string;
  improvedAnswer: string;
  confidence: 'high' | 'medium' | 'low';
  answerAssetCandidate?: boolean;
  assetCandidateReason?: string;
}): InterviewMaterialDraftItem {
  return {
    id: input.id,
    title: input.title,
    question: input.question,
    originalAnswer: input.originalAnswer,
    followUps: [],
    issue: input.issue,
    evidence: input.evidence,
    improvementSuggestion: input.improvementSuggestion,
    improvedAnswer: input.improvedAnswer,
    answerAssetCandidate: input.answerAssetCandidate ?? true,
    assetCandidateReason: input.assetCandidateReason ?? '这类问题在同岗位多轮和同方向岗位中复用频率较高。',
    confidence: input.confidence
  };
}

function buildKeywordItems(text: string): InterviewMaterialDraftItem[] {
  const items: InterviewMaterialDraftItem[] = [];
  const lowerText = text.toLowerCase();

  if (/ab|a\/b|实验|分流/.test(lowerText)) {
    items.push(
      makeItem({
        id: 'item-ab-test',
        title: 'AB 实验设计',
        question: '如果要验证一个产品改动是否有效，你会如何设计 AB 实验？',
        originalAnswer: excerpt(text, ['AB', 'A/B', '实验', '分流']),
        issue: '回答容易停留在“看转化率”，没有说明实验目标、分流口径、核心指标和风险控制。',
        evidence: excerpt(text, ['AB', 'A/B', '实验', '分流']),
        improvementSuggestion: '先明确业务目标和实验假设，再说明实验组/对照组、核心指标、护栏指标、样本周期和异常处理。',
        improvedAnswer:
          '我会先把实验目标转成可验证假设，例如“新流程能提升关键任务完成率”。然后设计实验组和对照组，确保用户分流随机且稳定；核心指标看任务完成率或关键行为完成率，护栏指标看问题反馈率、页面退出率和人工支持量。实验前会估算样本量和周期，实验中监控异常波动，实验后不仅看显著性，也会拆分新老用户、渠道和设备差异，避免把短期波动误判为产品收益。',
        confidence: 'high'
      })
    );
  }

  if (/评测|口径|指标|metric|效果/.test(lowerText)) {
    items.push(
      makeItem({
        id: 'item-evaluation-metrics',
        title: '评测口径设计',
        question: '你会如何评估一个 AI 产品或 Agent 功能是否真的有效？',
        originalAnswer: excerpt(text, ['评测', '口径', '指标', '效果']),
        issue: '指标容易过于泛化，缺少过程指标、结果指标和长期复用指标的分层。',
        evidence: excerpt(text, ['评测', '口径', '指标', '效果']),
        improvementSuggestion: '把指标拆成过程、结果、长期三层，并说明每层指标分别验证什么风险。',
        improvedAnswer:
          '我会分三层评估。第一层是过程指标，确认用户是否完成关键路径，例如导入材料、确认解析结果、采纳优化回答；第二层是结果指标，确认产出是否有用，例如回答资产采纳率、用户编辑率、下次模拟面试回答质量变化；第三层是长期指标，确认能力是否沉淀，例如同类短板重复出现频率是否下降、同方向岗位回答资产复用率是否提升。这样既能判断功能有没有被使用，也能判断它是否真的改善了面试准备质量。',
        confidence: 'high'
      })
    );
  }

  if (/公司|业务|行业|场景|用户/.test(text)) {
    items.push(
      makeItem({
        id: 'item-company-business',
        title: '公司业务理解',
        question: '你为什么投递这家公司？你怎么理解它的业务和产品机会？',
        originalAnswer: excerpt(text, ['公司', '业务', '行业', '场景', '用户']),
        issue: '回答容易只说“看好行业”或“匹配岗位”，没有把公司业务、目标用户和岗位职责连起来。',
        evidence: excerpt(text, ['公司', '业务', '行业', '场景', '用户']),
        improvementSuggestion: '用“公司业务-用户场景-岗位能做什么-自己的匹配点”组织回答。',
        improvedAnswer:
          '我关注这家公司不是只因为它在 AI 方向，而是因为它的用户场景足够具体。以企业知识库助手为例，员工在检索制度、查找项目资料、复用方案模板和处理高频咨询时都会遇到信息分散的问题，AI 产品可以把分散知识变成更低门槛的助手体验。这个岗位需要把业务需求、用户路径和效果指标连接起来，而我之前做过 AI Agent 求职助手的产品拆解，也持续在做结构化复盘和指标设计，所以我希望把这种能力迁移到更真实的业务场景里。',
        confidence: 'medium'
      })
    );
  }

  if (/自我介绍|介绍自己|贴岗|匹配/.test(text)) {
    items.push(
      makeItem({
        id: 'item-self-introduction',
        title: '自我介绍贴岗',
        question: '请做一个和这个岗位相关的自我介绍。',
        originalAnswer: excerpt(text, ['自我介绍', '介绍自己', '贴岗', '匹配']),
        issue: '自我介绍如果只罗列经历，面试官很难快速判断你为什么适合这个岗位。',
        evidence: excerpt(text, ['自我介绍', '介绍自己', '贴岗', '匹配']),
        improvementSuggestion: '用“方向定位-相关经历-能力证据-为什么匹配岗位”压缩到 60-90 秒。',
        improvedAnswer:
          '您好，我目前主要准备 AI 产品经理方向，关注的是如何把 AI 能力落到具体用户场景里。我最近做了一个 AI 面试成长 OS，从自己求职中“面试对话分散、复盘难沉淀”的痛点出发，设计了外部对话导入、结构化复盘、回答资产沉淀和复用的闭环。在这个过程中，我重点拆了用户路径、Agent 边界、指标体系和人工确认机制。这个经历和岗位里对需求分析、AI 产品落地、效果评估的要求比较贴近，所以我希望进一步在真实业务场景中锻炼产品判断和跨团队推进能力。',
        confidence: 'medium'
      })
    );
  }

  if (/agent|链路|助手|llm|模型/.test(lowerText)) {
    items.push(
      makeItem({
        id: 'item-agent-flow',
        title: 'AI Agent 链路拆解',
        question: '如果设计一个 AI Agent 产品，你会如何拆解它的任务链路？',
        originalAnswer: excerpt(text, ['Agent', '链路', '助手', '模型', 'LLM']),
        issue: '回答容易只讲功能，不讲输入输出、失败兜底和用户确认点。',
        evidence: excerpt(text, ['Agent', '链路', '助手', '模型', 'LLM']),
        improvementSuggestion: '按“输入-解析-生成-确认-保存-复用”的链路拆，并说明每一步的风险控制。',
        improvedAnswer:
          '我会先明确 Agent 的任务边界：它不是替用户做决定，而是把原始材料转成可确认的草稿。链路上，第一步接收 JD、面试对话或复盘笔记；第二步解析出问题、回答、追问和点评；第三步生成结构化复盘和优化回答；第四步让用户确认哪些内容可信、哪些需要编辑；第五步保存为回答资产，并标注来源、适用场景和置信度。风险上，要重点处理解析错误、回答不符合真实经历、复用场景过宽这三类问题，所以每一步都需要可编辑确认和低置信提示。',
        confidence: 'high'
      })
    );
  }

  return items;
}

function buildConversationItems(text: string): InterviewMaterialDraftItem[] {
  return parseImportedConversation(text).map((question, index) => ({
    id: `item-dialogue-${index + 1}`,
    title: question.question.includes('评估') ? '评测口径设计' : '面试问答复盘',
    question: question.question,
    originalAnswer: question.answer,
    followUps: question.followUps,
    issue: question.feedback || '需要补充具体问题点。',
    evidence: question.feedback,
    improvementSuggestion: question.feedback
      ? '根据点评补充业务目标、判断依据、指标或案例，并先确认内容符合自己的真实经历。'
      : '先补充面试官点评或自己的复盘判断，再生成可复用回答。',
    improvedAnswer:
      '我会先给出结论，再说明业务目标、用户场景、方案判断和验证指标。如果涉及 AI 产品，还会补充模型边界、人工确认点和失败兜底，确保回答既有产品思考，也能被面试官追问时继续展开。',
    answerAssetCandidate: Boolean(question.answer),
    assetCandidateReason: '来自一段完整问答，可以沉淀为同岗位多轮或同方向类似问题的回答素材。',
    confidence: question.feedback ? 'high' : 'medium'
  }));
}

function uniqueById(items: InterviewMaterialDraftItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function parseInterviewMaterial({ fallbackJob, rawText, sourceType }: MaterialImportParserInput): InterviewMaterialDraft {
  const text = normalizeText(rawText);
  const inferredSourceType = inferSourceType(text, sourceType);
  const conversationItems = buildConversationItems(text);
  const keywordItems = buildKeywordItems(text);
  const interviewItems = uniqueById([...conversationItems, ...keywordItems]);
  const safeItems =
    interviewItems.length > 0
      ? interviewItems
      : [
          makeItem({
            id: `item-${toId(text.slice(0, 24)) || 'general-review'}`,
            title: '面试复盘条目',
            question: '这段材料中最值得沉淀的问题是什么？',
            originalAnswer: text.slice(0, 180),
            issue: '当前材料结构不够清晰，需要用户确认问题、原回答和改进方向。',
            improvementSuggestion: '先把材料拆成“原问题、原回答、问题点、下次怎么答”，再决定是否保存为回答资产。',
            improvedAnswer: '我会先把问题复述清楚，再用 2-3 个要点说明判断依据，并补充一个可验证的指标或案例。',
            confidence: 'low',
            answerAssetCandidate: false,
            assetCandidateReason: undefined
          })
        ];

  const hasOriginalAnswer = safeItems.some((item) => item.originalAnswer && item.originalAnswer.length > 0);
  const jobContext = extractJobContext(text, fallbackJob);
  const missingInfoWarnings = [
    ...(!jobContext.company ? ['未识别到公司名称，已使用当前岗位上下文或等待手动补充。'] : []),
    ...(!jobContext.role ? ['未识别到岗位名称，保存前建议确认岗位归属。'] : []),
    ...(!hasOriginalAnswer ? ['未识别到明确原回答，优化回答需要用户二次确认。'] : []),
    ...(safeItems.some((item) => item.confidence === 'low') ? ['存在低置信条目，请先编辑确认再保存。'] : [])
  ];

  return {
    sourceType: inferredSourceType,
    jobContext,
    interviewItems: safeItems,
    globalInsights: {
      summary: `已从材料中识别出 ${safeItems.length} 个可复盘问题，其中 ${safeItems.filter((item) => item.answerAssetCandidate).length} 个适合沉淀为回答资产。`,
      strengths: ['材料已经包含可复盘的问题或关键词，适合先生成可确认草稿。'],
      weaknesses: safeItems.map((item) => item.issue ?? item.title).slice(0, 3),
      nextPrepTopics: safeItems.map((item) => item.question ?? item.title).slice(0, 3)
    },
    missingInfoWarnings
  };
}
