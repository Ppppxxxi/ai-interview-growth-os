import type { AbilityDimension, Experience, JobProfile } from '../domain/types';

const keywordToDimension: Record<string, AbilityDimension> = {
  'AI 产品理解': 'aiProductThinking',
  '数据与指标': 'dataMetrics',
  '产品分析': 'productAnalysis',
  '用户研究': 'productAnalysis',
  '沟通与结构化': 'structuredCommunication',
  '岗位理解': 'roleUnderstanding'
};

export type ExperienceMatch = {
  experience: Experience;
  matchedKeywords: string[];
  score: number;
  suggestedAngle: string;
  missingEvidence: string[];
};

export function matchExperiences(profile: JobProfile, experiences: Experience[]): ExperienceMatch[] {
  return experiences
    .map((experience) => {
      const matchedKeywords = profile.abilityKeywords.filter((keyword) => {
        const dimension = keywordToDimension[keyword];
        return dimension ? experience.abilityTags.includes(dimension) : false;
      });

      const missingEvidence =
        experience.evidenceMetrics.length === 0
          ? ['缺少可量化结果或证明材料']
          : [];

      return {
        experience,
        matchedKeywords,
        score: matchedKeywords.length * 2 + experience.evidenceMetrics.length,
        suggestedAngle:
          matchedKeywords.length > 0
            ? `优先突出 ${matchedKeywords.join('、')}，用结果数据支撑项目价值。`
            : '作为补充经历使用，重点说明学习能力和迁移价值。',
        missingEvidence
      };
    })
    .sort((a, b) => b.score - a.score);
}
