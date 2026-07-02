import type { JobProfile } from '../domain/types';

const aiSignals = ['AI', 'Agent', '模型', '大模型', 'LLM', '效果评估'];
const metricSignals = ['指标', '数据', '评估', '实验', '看板'];
const researchSignals = ['用户调研', '需求分析', '场景'];

function includesAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

export function analyzeJd(jdText: string, direction: string): JobProfile {
  const responsibilities: string[] = [];
  if (jdText.includes('AI Agent')) responsibilities.push('AI Agent 产品需求分析');
  if (jdText.includes('用户调研')) responsibilities.push('用户调研');
  if (jdText.includes('指标设计')) responsibilities.push('指标设计');
  if (jdText.includes('跨团队')) responsibilities.push('跨团队协作');
  if (responsibilities.length === 0) responsibilities.push('岗位职责拆解');

  const abilityKeywords = ['岗位理解', '产品分析'];
  if (includesAny(jdText, aiSignals) || direction.includes('AI')) abilityKeywords.push('AI 产品理解');
  if (includesAny(jdText, metricSignals)) abilityKeywords.push('数据与指标');
  if (includesAny(jdText, researchSignals)) abilityKeywords.push('用户研究');
  abilityKeywords.push('沟通与结构化');

  const hiddenRequirements = [
    '能把模糊岗位要求转化为可执行产品方案',
    '能说明跨团队协作中的优先级判断'
  ];
  if (abilityKeywords.includes('AI 产品理解')) hiddenRequirements.unshift('能说明模型能力边界与失败兜底');
  if (abilityKeywords.includes('数据与指标')) hiddenRequirements.push('能定义产品成功指标和效果评估方法');

  const likelyQuestions = [
    '请介绍一段最能证明你产品能力的项目经历。',
    '你如何判断一个需求是否值得做？'
  ];
  if (abilityKeywords.includes('AI 产品理解')) likelyQuestions.unshift('如何评估一个 AI Agent 产品的效果？');
  if (abilityKeywords.includes('数据与指标')) likelyQuestions.push('你会如何设计这个产品的指标体系？');

  return {
    responsibilities,
    abilityKeywords: Array.from(new Set(abilityKeywords)),
    hiddenRequirements,
    likelyQuestions
  };
}
