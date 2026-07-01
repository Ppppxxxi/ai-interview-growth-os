# AI 面试成长 OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portfolio-ready Web App Demo for AI 面试成长 OS that runs locally, demonstrates the complete loop from job file and interview import to structured review, ability map, answer assets, and training tasks.

**Architecture:** Use a client-side React + TypeScript app with deterministic local "AI Agent" functions for MVP demos. Domain logic lives in pure TypeScript modules with Vitest coverage; React pages consume typed sample data and agent outputs. Real LLM API integration is intentionally deferred so the demo is stable, privacy-safe, and GitHub-friendly.

**Tech Stack:** Vite, React, TypeScript, Vitest, CSS modules via plain CSS, local sample data, no backend for MVP.

---

## File Structure

Create and modify these files:

- Create: `package.json` - npm scripts and dependencies.
- Create: `index.html` - Vite HTML entry.
- Create: `tsconfig.json` - TypeScript project config.
- Create: `tsconfig.node.json` - Vite config TypeScript config.
- Create: `vite.config.ts` - Vite + Vitest config.
- Create: `src/main.tsx` - React entry point.
- Create: `src/App.tsx` - top-level app state, navigation, and page composition.
- Create: `src/styles.css` - global layout and component styles.
- Create: `src/domain/types.ts` - shared domain types.
- Create: `src/domain/sampleData.ts` -脱敏 demo data.
- Create: `src/agents/jdAnalyst.ts` - JD 画像生成.
- Create: `src/agents/experienceMatcher.ts` - 经历匹配.
- Create: `src/agents/importParser.ts` - 外部对话解析.
- Create: `src/agents/mockInterview.ts` - 内置模拟面试问题生成.
- Create: `src/agents/reviewEvaluator.ts` - 结构化复盘评分.
- Create: `src/agents/growthPlanner.ts` - 全局能力图谱、回答资产、训练任务聚合.
- Create: `src/agents/__tests__/jdAnalyst.test.ts` - JD 分析测试.
- Create: `src/agents/__tests__/importParser.test.ts` - 外部对话解析测试.
- Create: `src/agents/__tests__/mockInterview.test.ts` - 内置模拟面试测试.
- Create: `src/agents/__tests__/reviewEvaluator.test.ts` - 评分测试.
- Create: `src/agents/__tests__/growthPlanner.test.ts` - 成长聚合测试.
- Create: `src/components/AbilityScoreCard.tsx` - 能力评分卡.
- Create: `src/components/AnswerAssetCard.tsx` - 回答资产卡.
- Create: `src/components/TrainingTaskCard.tsx` - 训练任务卡.
- Create: `src/pages/GrowthDashboard.tsx` - 成长首页.
- Create: `src/pages/JobFileDetail.tsx` - 岗位档案详情.
- Create: `src/pages/InterviewReview.tsx` - 面试复盘页.
- Create: `src/pages/AssetsAndTraining.tsx` - 回答资产和训练任务页.
- Modify: `.gitignore` - add Node, build, and environment ignores.
- Modify: `README.md` - add run instructions and demo scope.

## Task 1: Scaffold Vite React TypeScript App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ai-interview-growth-os",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI 面试成长 OS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create TypeScript and Vite config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node'
  }
});
```

- [ ] **Step 4: Create minimal React entry**

`src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">AI Interview Growth OS</p>
        <h1>AI 面试成长 OS</h1>
        <p>把每一次模拟面试和复盘，转化为下一场面试可复用的准备资产。</p>
      </section>
    </main>
  );
}
```

`src/styles.css`:

```css
:root {
  font-family: Inter, "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  color: #172033;
  background: #f6f8fb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

.hero {
  max-width: 880px;
  margin: 0 auto;
  padding: 48px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #dce3ef;
}

.eyebrow {
  margin: 0 0 8px;
  color: #52627a;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

- [ ] **Step 5: Update `.gitignore`**

```gitignore
.superpowers/
node_modules/
dist/
.env
.env.*
!.env.example
npm-debug.log*
```

- [ ] **Step 6: Install dependencies**

Run:

```powershell
npm.cmd install
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 7: Verify app builds**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript passes and `dist/` is generated.

- [ ] **Step 8: Commit**

```powershell
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/main.tsx src/App.tsx src/styles.css .gitignore
git commit -m "chore: scaffold React demo app"
```

## Task 2: Add Domain Types and Demo Seed Data

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/sampleData.ts`
- Test by: `npm.cmd run build`

- [ ] **Step 1: Create domain types**

`src/domain/types.ts`:

```ts
export type AbilityDimension =
  | 'roleUnderstanding'
  | 'productAnalysis'
  | 'aiProductThinking'
  | 'dataMetrics'
  | 'projectStorytelling'
  | 'structuredCommunication';

export type InterviewSource = 'builtInMock' | 'externalImport';

export type AbilityScore = {
  dimension: AbilityDimension;
  label: string;
  score: number;
  evidence: string;
  attribution: string;
  suggestion: string;
};

export type Experience = {
  id: string;
  title: string;
  context: string;
  task: string;
  action: string;
  result: string;
  abilityTags: AbilityDimension[];
  evidenceMetrics: string[];
  applicableQuestionTypes: string[];
};

export type JobProfile = {
  responsibilities: string[];
  abilityKeywords: string[];
  hiddenRequirements: string[];
  likelyQuestions: string[];
};

export type JobFile = {
  id: string;
  company: string;
  roleTitle: string;
  direction: string;
  jdText: string;
  stage: string;
  status: string;
  profile?: JobProfile;
  interviewSessionIds: string[];
};

export type InterviewQuestion = {
  id: string;
  question: string;
  answer: string;
  followUps: string[];
  feedback: string;
};

export type InterviewSession = {
  id: string;
  jobFileId: string;
  source: InterviewSource;
  interviewType: string;
  createdAt: string;
  rawConversation: string;
  questions: InterviewQuestion[];
};

export type ReviewReport = {
  id: string;
  jobFileId: string;
  sessionId: string;
  summary: string;
  scores: AbilityScore[];
  strengths: string[];
  weaknesses: string[];
  nextActions: string[];
};

export type AnswerAsset = {
  id: string;
  questionType: string;
  originalAnswer: string;
  improvedAnswer: string;
  applicableRoles: string[];
  linkedExperienceId?: string;
  usageNote: string;
  confidence: 'high' | 'medium' | 'low';
};

export type TrainingTask = {
  id: string;
  goal: string;
  dimension: AbilityDimension;
  practiceQuestion: string;
  referenceFramework: string;
  dueLabel: string;
  status: 'open' | 'done';
  retryResult?: string;
};
```

- [ ] **Step 2: Create sample data**

`src/domain/sampleData.ts`:

```ts
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
候选人：可以看用户满意度和使用次数。
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
```

- [ ] **Step 3: Verify TypeScript compile**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/domain/types.ts src/domain/sampleData.ts
git commit -m "feat: add interview growth domain model"
```

## Task 3: Implement JD Analysis and Experience Matching Agents

**Files:**
- Create: `src/agents/jdAnalyst.ts`
- Create: `src/agents/experienceMatcher.ts`
- Create: `src/agents/__tests__/jdAnalyst.test.ts`

- [ ] **Step 1: Write failing JD analyst test**

`src/agents/__tests__/jdAnalyst.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeJd } from '../jdAnalyst';

describe('analyzeJd', () => {
  it('extracts AI PM responsibilities, keywords, hidden requirements, and likely questions', () => {
    const profile = analyzeJd('负责 AI Agent 产品需求分析、用户调研、指标设计、模型效果评估和跨团队协作。', 'AI 产品经理');

    expect(profile.responsibilities).toContain('AI Agent 产品需求分析');
    expect(profile.abilityKeywords).toContain('AI 产品理解');
    expect(profile.abilityKeywords).toContain('数据与指标');
    expect(profile.hiddenRequirements).toContain('能说明模型能力边界与失败兜底');
    expect(profile.likelyQuestions).toContain('如何评估一个 AI Agent 产品的效果？');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/jdAnalyst.test.ts
```

Expected: FAIL because `src/agents/jdAnalyst.ts` does not exist.

- [ ] **Step 3: Implement JD analyst**

`src/agents/jdAnalyst.ts`:

```ts
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
```

- [ ] **Step 4: Add experience matcher**

`src/agents/experienceMatcher.ts`:

```ts
import type { AbilityDimension, Experience, JobProfile } from '../domain/types';

const keywordToDimension: Record<string, AbilityDimension> = {
  'AI 产品理解': 'aiProductThinking',
  '数据与指标': 'dataMetrics',
  '产品分析': 'productAnalysis',
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
```

- [ ] **Step 5: Run test**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/jdAnalyst.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/agents/jdAnalyst.ts src/agents/experienceMatcher.ts src/agents/__tests__/jdAnalyst.test.ts
git commit -m "feat: add JD analysis and experience matching"
```

## Task 4: Implement External Import Parser and Review Evaluator

**Files:**
- Create: `src/agents/importParser.ts`
- Create: `src/agents/reviewEvaluator.ts`
- Create: `src/agents/__tests__/importParser.test.ts`
- Create: `src/agents/__tests__/reviewEvaluator.test.ts`

- [ ] **Step 1: Write failing import parser test**

`src/agents/__tests__/importParser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseImportedConversation } from '../importParser';

describe('parseImportedConversation', () => {
  it('extracts interviewer question, candidate answer, follow-up, and feedback', () => {
    const parsed = parseImportedConversation(`面试官：请设计一个 AI 面试产品。
候选人：我会生成问题并给反馈。
面试官追问：如何评估效果？
AI 点评：缺少指标和兜底机制。`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].question).toBe('请设计一个 AI 面试产品。');
    expect(parsed[0].answer).toBe('我会生成问题并给反馈。');
    expect(parsed[0].followUps).toEqual(['如何评估效果？']);
    expect(parsed[0].feedback).toBe('缺少指标和兜底机制。');
  });
});
```

- [ ] **Step 2: Write failing review evaluator test**

`src/agents/__tests__/reviewEvaluator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { InterviewSession, JobFile } from '../../domain/types';
import { evaluateInterview } from '../reviewEvaluator';

describe('evaluateInterview', () => {
  it('scores weak AI PM answers with evidence and suggestions', () => {
    const job: JobFile = {
      id: 'job-1',
      company: '测试公司',
      roleTitle: 'AI 产品经理',
      direction: 'AI 产品经理',
      jdText: '负责 AI Agent、指标设计和效果评估。',
      stage: '一面',
      status: '复盘中',
      interviewSessionIds: ['session-1']
    };
    const session: InterviewSession = {
      id: 'session-1',
      jobFileId: 'job-1',
      source: 'externalImport',
      interviewType: '综合面',
      createdAt: '2026-07-01',
      rawConversation: '',
      questions: [
        {
          id: 'q-1',
          question: '如何评估 AI Agent 产品效果？',
          answer: '看用户满意度和使用次数。',
          followUps: [],
          feedback: '缺少指标体系。'
        }
      ]
    };

    const report = evaluateInterview(job, session);

    expect(report.scores.find((score) => score.dimension === 'aiProductThinking')?.score).toBe(2);
    expect(report.scores.find((score) => score.dimension === 'dataMetrics')?.suggestion).toContain('复盘完成率');
    expect(report.weaknesses).toContain('AI 产品边界表达不足');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/importParser.test.ts src/agents/__tests__/reviewEvaluator.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement import parser**

`src/agents/importParser.ts`:

```ts
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
```

- [ ] **Step 5: Implement review evaluator**

`src/agents/reviewEvaluator.ts`:

```ts
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
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/importParser.test.ts src/agents/__tests__/reviewEvaluator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run full test suite**

Run:

```powershell
npm.cmd test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/agents/importParser.ts src/agents/reviewEvaluator.ts src/agents/__tests__/importParser.test.ts src/agents/__tests__/reviewEvaluator.test.ts
git commit -m "feat: add interview import and review evaluation"
```

## Task 5: Implement Built-in Mock Interview Generator

**Files:**
- Create: `src/agents/mockInterview.ts`
- Create: `src/agents/__tests__/mockInterview.test.ts`

- [ ] **Step 1: Write failing mock interview test**

`src/agents/__tests__/mockInterview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Experience, JobProfile } from '../../domain/types';
import { generateMockInterview } from '../mockInterview';

describe('generateMockInterview', () => {
  it('creates role-specific questions using JD profile and matched experiences', () => {
    const profile: JobProfile = {
      responsibilities: ['AI Agent 产品需求分析'],
      abilityKeywords: ['AI 产品理解', '数据与指标'],
      hiddenRequirements: ['能说明模型能力边界与失败兜底'],
      likelyQuestions: ['如何评估一个 AI Agent 产品的效果？']
    };
    const experiences: Experience[] = [
      {
        id: 'exp-1',
        title: 'AI Agent 求职助手调研与原型设计',
        context: '准备 AI 产品经理求职时发现复盘割裂。',
        task: '定义 MVP。',
        action: '设计岗位档案和成长图谱。',
        result: '形成产品规格。',
        abilityTags: ['aiProductThinking', 'productAnalysis'],
        evidenceMetrics: ['完成 1 份规格'],
        applicableQuestionTypes: ['AI 产品设计']
      }
    ];

    const session = generateMockInterview('job-1', profile, experiences);

    expect(session.source).toBe('builtInMock');
    expect(session.questions[0].question).toBe('如何评估一个 AI Agent 产品的效果？');
    expect(session.questions.some((item) => item.question.includes('AI Agent 求职助手调研与原型设计'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/mockInterview.test.ts
```

Expected: FAIL because `src/agents/mockInterview.ts` does not exist.

- [ ] **Step 3: Implement mock interview generator**

`src/agents/mockInterview.ts`:

```ts
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
```

- [ ] **Step 4: Run mock interview test**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/mockInterview.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests and build**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/agents/mockInterview.ts src/agents/__tests__/mockInterview.test.ts
git commit -m "feat: add built-in mock interview generator"
```

## Task 6: Implement Growth Planner

**Files:**
- Create: `src/agents/growthPlanner.ts`
- Create: `src/agents/__tests__/growthPlanner.test.ts`

- [ ] **Step 1: Write failing growth planner test**

`src/agents/__tests__/growthPlanner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ReviewReport } from '../../domain/types';
import { buildGrowthSnapshot } from '../growthPlanner';

describe('buildGrowthSnapshot', () => {
  it('aggregates repeated weaknesses and creates ability averages', () => {
    const reports: ReviewReport[] = [
      {
        id: 'r-1',
        jobFileId: 'job-1',
        sessionId: 's-1',
        summary: 'summary',
        strengths: [],
        weaknesses: ['指标体系不完整'],
        nextActions: [],
        scores: [
          {
            dimension: 'dataMetrics',
            label: '数据与指标',
            score: 2,
            evidence: 'e',
            attribution: 'a',
            suggestion: 's'
          }
        ]
      },
      {
        id: 'r-2',
        jobFileId: 'job-2',
        sessionId: 's-2',
        summary: 'summary',
        strengths: [],
        weaknesses: ['指标体系不完整'],
        nextActions: [],
        scores: [
          {
            dimension: 'dataMetrics',
            label: '数据与指标',
            score: 4,
            evidence: 'e',
            attribution: 'a',
            suggestion: 's'
          }
        ]
      }
    ];

    const snapshot = buildGrowthSnapshot(reports);

    expect(snapshot.abilityAverages.dataMetrics).toBe(3);
    expect(snapshot.repeatedWeaknesses[0]).toEqual({ label: '指标体系不完整', count: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/growthPlanner.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement growth planner**

`src/agents/growthPlanner.ts`:

```ts
import type { AbilityDimension, ReviewReport } from '../domain/types';

export type GrowthSnapshot = {
  abilityAverages: Partial<Record<AbilityDimension, number>>;
  repeatedWeaknesses: Array<{ label: string; count: number }>;
  recommendedFocus: AbilityDimension[];
};

const allDimensions: AbilityDimension[] = [
  'roleUnderstanding',
  'productAnalysis',
  'aiProductThinking',
  'dataMetrics',
  'projectStorytelling',
  'structuredCommunication'
];

export function buildGrowthSnapshot(reports: ReviewReport[]): GrowthSnapshot {
  const abilityAverages: Partial<Record<AbilityDimension, number>> = {};

  for (const dimension of allDimensions) {
    const scores = reports.flatMap((report) =>
      report.scores.filter((score) => score.dimension === dimension).map((score) => score.score)
    );
    if (scores.length > 0) {
      abilityAverages[dimension] = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
    }
  }

  const weaknessCounts = new Map<string, number>();
  for (const report of reports) {
    for (const weakness of report.weaknesses) {
      weaknessCounts.set(weakness, (weaknessCounts.get(weakness) ?? 0) + 1);
    }
  }

  const repeatedWeaknesses = Array.from(weaknessCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const recommendedFocus = Object.entries(abilityAverages)
    .filter(([, score]) => typeof score === 'number' && score < 3.5)
    .map(([dimension]) => dimension as AbilityDimension);

  return {
    abilityAverages,
    repeatedWeaknesses,
    recommendedFocus
  };
}
```

- [ ] **Step 4: Run growth planner test**

Run:

```powershell
npm.cmd test -- src/agents/__tests__/growthPlanner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests and build**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/agents/growthPlanner.ts src/agents/__tests__/growthPlanner.test.ts
git commit -m "feat: add growth snapshot planner"
```

## Task 7: Build App Shell, Navigation, and Growth Dashboard

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/AbilityScoreCard.tsx`
- Create: `src/pages/GrowthDashboard.tsx`

- [ ] **Step 1: Create ability score card**

`src/components/AbilityScoreCard.tsx`:

```tsx
import type { AbilityDimension } from '../domain/types';

const labels: Record<AbilityDimension, string> = {
  roleUnderstanding: '岗位理解',
  productAnalysis: '产品分析',
  aiProductThinking: 'AI 产品理解',
  dataMetrics: '数据与指标',
  projectStorytelling: '项目表达',
  structuredCommunication: '沟通与结构化'
};

type Props = {
  dimension: AbilityDimension;
  score: number;
};

export function AbilityScoreCard({ dimension, score }: Props) {
  return (
    <article className="score-card">
      <div>
        <p className="card-label">{labels[dimension]}</p>
        <strong>{score.toFixed(1)} / 5</strong>
      </div>
      <div className="score-bar" aria-label={`${labels[dimension]} ${score} 分`}>
        <span style={{ width: `${Math.min(score / 5, 1) * 100}%` }} />
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Create growth dashboard**

`src/pages/GrowthDashboard.tsx`:

```tsx
import { buildGrowthSnapshot } from '../agents/growthPlanner';
import { answerAssets, jobFiles, reviewReports, trainingTasks } from '../domain/sampleData';
import { AbilityScoreCard } from '../components/AbilityScoreCard';

export function GrowthDashboard() {
  const snapshot = buildGrowthSnapshot(reviewReports);
  const abilityEntries = Object.entries(snapshot.abilityAverages);

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Growth Dashboard</p>
        <h1>面试能力成长首页</h1>
        <p>跨岗位汇总能力短板、回答资产和下一步训练任务，让每次复盘都能反哺下一场面试。</p>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>{jobFiles.length}</span>
          <p>岗位 / 面试档案</p>
        </article>
        <article className="metric-card">
          <span>{reviewReports.length}</span>
          <p>结构化复盘</p>
        </article>
        <article className="metric-card">
          <span>{answerAssets.length}</span>
          <p>回答资产</p>
        </article>
        <article className="metric-card">
          <span>{trainingTasks.length}</span>
          <p>训练任务</p>
        </article>
      </div>

      <section className="panel">
        <h2>能力图谱</h2>
        <div className="score-grid">
          {abilityEntries.map(([dimension, score]) => (
            <AbilityScoreCard key={dimension} dimension={dimension as never} score={score ?? 0} />
          ))}
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <h2>高频短板</h2>
          {snapshot.repeatedWeaknesses.map((weakness) => (
            <div className="list-row" key={weakness.label}>
              <span>{weakness.label}</span>
              <strong>{weakness.count} 次</strong>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>下一步训练</h2>
          {trainingTasks.map((task) => (
            <div className="list-row" key={task.id}>
              <span>{task.goal}</span>
              <strong>{task.status === 'open' ? '待完成' : '已完成'}</strong>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
```

- [ ] **Step 3: Replace app shell with tab navigation**

`src/App.tsx`:

```tsx
import { useState } from 'react';
import { GrowthDashboard } from './pages/GrowthDashboard';

type Page = 'dashboard';

const navItems: Array<{ id: Page; label: string }> = [{ id: 'dashboard', label: '成长首页' }];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">AI Interview</p>
          <h1>面试成长 OS</h1>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="content-area">{page === 'dashboard' && <GrowthDashboard />}</div>
    </main>
  );
}
```

- [ ] **Step 4: Replace CSS with dashboard layout styles**

Append or replace `src/styles.css` with the complete stylesheet:

```css
:root {
  font-family: Inter, "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  color: #172033;
  background: #f6f8fb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

.app-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
}

.sidebar {
  padding: 28px;
  background: #ffffff;
  border-right: 1px solid #dce3ef;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.sidebar h1 {
  margin: 0;
  font-size: 24px;
}

.sidebar nav {
  display: grid;
  gap: 8px;
}

.sidebar button {
  border: 0;
  border-radius: 8px;
  padding: 12px 14px;
  text-align: left;
  background: transparent;
  color: #52627a;
  cursor: pointer;
}

.sidebar button.active,
.sidebar button:hover {
  background: #e8f0ff;
  color: #1d4ed8;
}

.content-area {
  padding: 32px;
}

.page-grid {
  display: grid;
  gap: 24px;
}

.page-header {
  max-width: 840px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 34px;
}

.page-header p {
  color: #52627a;
}

.eyebrow,
.card-label {
  margin: 0 0 6px;
  color: #52627a;
  font-size: 13px;
  font-weight: 700;
}

.metric-grid,
.score-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card,
.score-card,
.panel {
  border: 1px solid #dce3ef;
  background: #ffffff;
  border-radius: 10px;
}

.metric-card {
  padding: 20px;
}

.metric-card span {
  font-size: 32px;
  font-weight: 800;
}

.metric-card p {
  margin: 6px 0 0;
  color: #52627a;
}

.panel {
  padding: 22px;
}

.panel h2 {
  margin: 0 0 16px;
}

.score-card {
  padding: 16px;
}

.score-card strong {
  font-size: 24px;
}

.score-bar {
  height: 8px;
  margin-top: 14px;
  border-radius: 999px;
  background: #e8edf5;
  overflow: hidden;
}

.score-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.list-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f7;
}

.list-row:last-child {
  border-bottom: 0;
}

@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid #dce3ef;
  }

  .metric-grid,
  .score-grid,
  .two-column {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/App.tsx src/styles.css src/components/AbilityScoreCard.tsx src/pages/GrowthDashboard.tsx
git commit -m "feat: build growth dashboard"
```

## Task 8: Build Job File Detail and Interview Review Flow

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/JobFileDetail.tsx`
- Create: `src/pages/InterviewReview.tsx`

- [ ] **Step 1: Create job file detail page**

`src/pages/JobFileDetail.tsx`:

```tsx
import { analyzeJd } from '../agents/jdAnalyst';
import { matchExperiences } from '../agents/experienceMatcher';
import { generateMockInterview } from '../agents/mockInterview';
import { experiences, jobFiles } from '../domain/sampleData';

export function JobFileDetail() {
  const job = jobFiles[0];
  const profile = analyzeJd(job.jdText, job.direction);
  const matches = matchExperiences(profile, experiences);
  const mockSession = generateMockInterview(job.id, profile, experiences);

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Job File</p>
        <h1>{job.company} · {job.roleTitle}</h1>
        <p>{job.stage} / {job.status}</p>
      </div>

      <section className="two-column">
        <div className="panel">
          <h2>JD 画像</h2>
          <h3>核心职责</h3>
          <ul>{profile.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>能力关键词</h3>
          <div className="tag-list">{profile.abilityKeywords.map((item) => <span key={item}>{item}</span>)}</div>
          <h3>可能高频问题</h3>
          <ul>{profile.likelyQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>

        <div className="panel">
          <h2>经历匹配</h2>
          {matches.map((match) => (
            <article className="asset-card" key={match.experience.id}>
              <h3>{match.experience.title}</h3>
              <p>{match.suggestedAngle}</p>
              <div className="tag-list">{match.matchedKeywords.map((item) => <span key={item}>{item}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>内置模拟面试题</h2>
        {mockSession.questions.map((item) => (
          <article className="question-card" key={item.id}>
            <h3>{item.question}</h3>
            <p><strong>建议追问：</strong>{item.followUps.join(' / ')}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>外部对话导入样例</h2>
        <pre className="conversation-preview">{`面试官：请设计一个面向产品经理求职者的 AI 模拟面试产品。
候选人：我会做一个 AI 面试助手，帮助用户生成问题并给出反馈。
面试官追问：你如何评估这个 AI 产品的效果？
AI 点评：回答有方向，但缺少模型边界、结构化复盘和可量化指标。`}</pre>
      </section>
    </section>
  );
}
```

- [ ] **Step 2: Create interview review page**

`src/pages/InterviewReview.tsx`:

```tsx
import { evaluateInterview } from '../agents/reviewEvaluator';
import { interviewSessions, jobFiles } from '../domain/sampleData';
import { AbilityScoreCard } from '../components/AbilityScoreCard';

export function InterviewReview() {
  const job = jobFiles[0];
  const session = interviewSessions[0];
  const report = evaluateInterview(job, session);

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Review Report</p>
        <h1>结构化面试复盘</h1>
        <p>{report.summary}</p>
      </div>

      <section className="panel">
        <h2>问题与回答拆解</h2>
        {session.questions.map((item) => (
          <article className="question-card" key={item.id}>
            <h3>{item.question}</h3>
            <p><strong>原回答：</strong>{item.answer}</p>
            <p><strong>追问：</strong>{item.followUps.join(' / ')}</p>
            <p><strong>AI 点评：</strong>{item.feedback}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>能力评分</h2>
        <div className="score-grid">
          {report.scores.map((score) => (
            <AbilityScoreCard key={score.dimension} dimension={score.dimension} score={score.score} />
          ))}
        </div>
      </section>

      <section className="two-column">
        <div className="panel">
          <h2>主要短板</h2>
          <ul>{report.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="panel">
          <h2>下一步动作</h2>
          <ul>{report.nextActions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>
    </section>
  );
}
```

- [ ] **Step 3: Add navigation**

Modify `src/App.tsx`:

```tsx
import { useState } from 'react';
import { GrowthDashboard } from './pages/GrowthDashboard';
import { InterviewReview } from './pages/InterviewReview';
import { JobFileDetail } from './pages/JobFileDetail';

type Page = 'dashboard' | 'job' | 'review';

const navItems: Array<{ id: Page; label: string }> = [
  { id: 'dashboard', label: '成长首页' },
  { id: 'job', label: '岗位档案' },
  { id: 'review', label: '面试复盘' }
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">AI Interview</p>
          <h1>面试成长 OS</h1>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="content-area">
        {page === 'dashboard' && <GrowthDashboard />}
        {page === 'job' && <JobFileDetail />}
        {page === 'review' && <InterviewReview />}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add supporting CSS**

Append to `src/styles.css`:

```css
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 16px;
}

.tag-list span {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700;
}

.asset-card,
.question-card {
  padding: 16px;
  border: 1px solid #edf1f7;
  border-radius: 8px;
  margin-bottom: 12px;
}

.asset-card h3,
.question-card h3 {
  margin-top: 0;
}

.conversation-preview {
  white-space: pre-wrap;
  padding: 16px;
  border-radius: 8px;
  background: #111827;
  color: #f8fafc;
  overflow-x: auto;
}
```

- [ ] **Step 5: Build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/App.tsx src/styles.css src/pages/JobFileDetail.tsx src/pages/InterviewReview.tsx
git commit -m "feat: add job file and review pages"
```

## Task 9: Build Answer Assets, Training Page, and README Run Instructions

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/AnswerAssetCard.tsx`
- Create: `src/components/TrainingTaskCard.tsx`
- Create: `src/pages/AssetsAndTraining.tsx`
- Modify: `README.md`

- [ ] **Step 1: Create answer asset card**

`src/components/AnswerAssetCard.tsx`:

```tsx
import type { AnswerAsset } from '../domain/types';

type Props = {
  asset: AnswerAsset;
};

export function AnswerAssetCard({ asset }: Props) {
  return (
    <article className="asset-card">
      <p className="card-label">{asset.questionType}</p>
      <h3>优化回答</h3>
      <p>{asset.improvedAnswer}</p>
      <details>
        <summary>查看原回答</summary>
        <p>{asset.originalAnswer}</p>
      </details>
      <div className="tag-list">{asset.applicableRoles.map((role) => <span key={role}>{role}</span>)}</div>
      <p><strong>使用建议：</strong>{asset.usageNote}</p>
    </article>
  );
}
```

- [ ] **Step 2: Create training task card**

`src/components/TrainingTaskCard.tsx`:

```tsx
import type { TrainingTask } from '../domain/types';

type Props = {
  task: TrainingTask;
};

export function TrainingTaskCard({ task }: Props) {
  return (
    <article className="asset-card">
      <p className="card-label">{task.status === 'open' ? '待训练' : '已完成'}</p>
      <h3>{task.goal}</h3>
      <p><strong>练习题：</strong>{task.practiceQuestion}</p>
      <p><strong>参考框架：</strong>{task.referenceFramework}</p>
      <p><strong>时间：</strong>{task.dueLabel}</p>
    </article>
  );
}
```

- [ ] **Step 3: Create assets and training page**

`src/pages/AssetsAndTraining.tsx`:

```tsx
import { AnswerAssetCard } from '../components/AnswerAssetCard';
import { TrainingTaskCard } from '../components/TrainingTaskCard';
import { answerAssets, trainingTasks } from '../domain/sampleData';

export function AssetsAndTraining() {
  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Assets & Training</p>
        <h1>回答资产与训练计划</h1>
        <p>把一次面试复盘中的好表达、薄弱点和下一步动作，沉淀为下一场面试可直接复用的资产。</p>
      </div>

      <section className="two-column">
        <div className="panel">
          <h2>回答资产库</h2>
          {answerAssets.map((asset) => (
            <AnswerAssetCard asset={asset} key={asset.id} />
          ))}
        </div>
        <div className="panel">
          <h2>训练计划</h2>
          {trainingTasks.map((task) => (
            <TrainingTaskCard task={task} key={task.id} />
          ))}
        </div>
      </section>
    </section>
  );
}
```

- [ ] **Step 4: Add navigation**

Modify `src/App.tsx`:

```tsx
import { useState } from 'react';
import { AssetsAndTraining } from './pages/AssetsAndTraining';
import { GrowthDashboard } from './pages/GrowthDashboard';
import { InterviewReview } from './pages/InterviewReview';
import { JobFileDetail } from './pages/JobFileDetail';

type Page = 'dashboard' | 'job' | 'review' | 'assets';

const navItems: Array<{ id: Page; label: string }> = [
  { id: 'dashboard', label: '成长首页' },
  { id: 'job', label: '岗位档案' },
  { id: 'review', label: '面试复盘' },
  { id: 'assets', label: '资产与训练' }
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">AI Interview</p>
          <h1>面试成长 OS</h1>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="content-area">
        {page === 'dashboard' && <GrowthDashboard />}
        {page === 'job' && <JobFileDetail />}
        {page === 'review' && <InterviewReview />}
        {page === 'assets' && <AssetsAndTraining />}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Update README run instructions**

Add this section to `README.md` after "当前状态":

````md
## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

构建检查：

```powershell
npm.cmd test
npm.cmd run build
```

PowerShell 环境中请使用 `npm.cmd`，避免系统执行策略拦截 `npm.ps1`。
````

- [ ] **Step 6: Run tests and build**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/App.tsx src/components/AnswerAssetCard.tsx src/components/TrainingTaskCard.tsx src/pages/AssetsAndTraining.tsx README.md
git commit -m "feat: add answer assets and training page"
```

## Task 10: Final Verification and GitHub Readiness

**Files:**
- Modify: `README.md`
- Optional modify: `docs/superpowers/specs/2026-07-01-ai-interview-growth-os-design.md` if implementation scope changes.

- [ ] **Step 1: Run all verification commands**

Run:

```powershell
npm.cmd test
npm.cmd run build
git status --short
```

Expected:

- Tests pass.
- Build passes.
- `git status --short` shows no uncommitted source changes before final README edit.

- [ ] **Step 2: Start dev server for manual review**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Expected:

- Vite prints a local URL such as `http://127.0.0.1:5173/`.
- Browser shows four usable navigation items: 成长首页、岗位档案、面试复盘、资产与训练.

- [ ] **Step 3: Manual acceptance checklist**

Verify in browser:

- 成长首页 shows job file count, review count, answer asset count, training task count.
- 成长首页 shows ability scores and high-frequency weakness.
- 岗位档案 shows JD 画像 and experience matching.
- 面试复盘 shows extracted question, original answer, follow-up, feedback, ability scores, weaknesses, and actions.
- 资产与训练 shows at least one answer asset and one training task.
- Mobile width around 390px does not overlap content.

- [ ] **Step 4: Add GitHub readiness section to README**

Append:

```md
## GitHub 上传前检查

- 不提交 `.env` 或任何 API Key。
- 不提交真实简历、真实公司面试记录、手机号、邮箱等敏感信息。
- Demo 数据使用脱敏或虚构样例。
- 上传前运行 `npm.cmd test` 和 `npm.cmd run build`。
```

- [ ] **Step 5: Commit final docs update**

```powershell
git add README.md
git commit -m "docs: add GitHub readiness checklist"
```

## Self-Review

Spec coverage:

- 产品定位：Task 1, Task 7, README updates.
- 个人经历库与岗位档案：Task 2, Task 8.
- JD 画像与经历匹配：Task 3, Task 8.
- 外部对话导入：Task 4, Task 8.
- 内置模拟面试：Task 5, Task 8.
- 结构化复盘：Task 4, Task 8.
- 能力图谱：Task 6, Task 7.
- 回答资产和训练任务：Task 2, Task 9.
- GitHub 展示：Task 9, Task 10.

Intentional MVP reductions:

- This plan uses deterministic local TypeScript logic instead of a real LLM API. That keeps the first GitHub demo stable, private, and runnable without API keys.
- Real-time question-by-question interviewing is deferred. The MVP still includes built-in mock interview generation and displays generated questions in the job file detail page.

No-placeholder check:

- The plan avoids red-flag placeholder language.
- Every code-producing step includes concrete file content.
- Every task has verification commands and a commit step.
