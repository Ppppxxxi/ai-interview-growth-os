# Review Feedback V2.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the review-feedback V2.1 changes: data integrity, real local mock generation flow, answer-asset reading priority, and lighter global growth language.

**Architecture:** Keep the product as a local React/Vite demo. Add a small workflow pipeline that composes existing deterministic agents instead of introducing a real LLM or backend. Move answer assets into runtime state in `App.tsx` so generated assets are visible across the workspace, asset library, and global growth pages during the current session.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS.

---

## File Map

- Modify `src/domain/sampleData.ts`: make asset source chains internally consistent.
- Create `src/domain/__tests__/sampleDataIntegrity.test.ts`: verify every asset source points to real sample data.
- Create `src/workflow/demoPipeline.ts`: compose parser, evaluator, and answer asset generator.
- Create `src/workflow/__tests__/demoPipeline.test.ts`: verify local mock generation from pasted conversation.
- Create `src/workflow/runtimeAssets.ts`: pure helper for replacing or appending runtime assets.
- Create `src/workflow/__tests__/runtimeAssets.test.ts`: verify saved assets are visible in runtime state.
- Modify `src/App.tsx`: own runtime `answerAssets` state and pass it to pages.
- Modify `src/pages/JobFileDetail.tsx`: call the local demo pipeline and save generated assets.
- Modify `src/pages/AssetsAndTraining.tsx`: read assets from props and keep selected asset valid after filtering.
- Modify `src/pages/GrowthDashboard.tsx`: read assets from props and use snapshot wording instead of unsupported trend wording.
- Modify `src/components/AnswerAssetCard.tsx`: move improved answer to the top and make metadata secondary.
- Modify `src/styles.css`: support new asset card hierarchy and growth wording.

---

### Task 1: Fix Sample Data Integrity

**Files:**
- Create: `src/domain/__tests__/sampleDataIntegrity.test.ts`
- Modify: `src/domain/sampleData.ts`

- [ ] **Step 1: Write the failing data integrity test**

```ts
import { answerAssets, interviewSessions, jobFiles, reviewReports } from '../sampleData';

describe('sampleData answer asset integrity', () => {
  it('keeps every answer asset connected to a real job, interview session, and review', () => {
    for (const asset of answerAssets) {
      const sourceJob = jobFiles.find((job) => job.id === asset.sourceJobId);
      const sourceInterview = interviewSessions.find((session) => session.id === asset.sourceInterviewId);
      const sourceReview = reviewReports.find((report) => report.id === asset.sourceReviewId);

      expect(sourceJob, `${asset.id} source job`).toBeDefined();
      expect(sourceInterview, `${asset.id} source interview`).toBeDefined();
      expect(sourceReview, `${asset.id} source review`).toBeDefined();
      expect(sourceInterview?.jobFileId).toBe(asset.sourceJobId);
      expect(sourceReview?.jobFileId).toBe(asset.sourceJobId);
      expect(sourceReview?.sessionId).toBe(asset.sourceInterviewId);
    }
  });

  it('uses a complete source chain for assets marked as used in interviews', () => {
    const usedAssets = answerAssets.filter((asset) => asset.usedInInterview);

    expect(usedAssets.length).toBeGreaterThanOrEqual(1);
    expect(usedAssets.map((asset) => asset.id)).toContain('asset-session-ai-pm-a-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/domain/__tests__/sampleDataIntegrity.test.ts`

Expected: FAIL because `asset-demand-priority` points to missing `session-platform-pm-demo` and `review-platform-pm-demo`, or because `asset-session-ai-pm-a-1` is not marked used.

- [ ] **Step 3: Implement the minimal data fix**

In `src/domain/sampleData.ts`:

- Add a `session-platform-pm-demo` item to `interviewSessions` for `job-platform-pm-c`.
- Add a `review-platform-pm-demo` item to `reviewReports` for that session.
- Change `asset-session-ai-pm-a-1.usedInInterview` to `true`.
- Change `asset-session-ai-pm-a-1.reuseScope` to a concrete phrase such as `已用于星河智能 AI 产品经理后续准备`.
- Keep `asset-demand-priority.usedInInterview` as `true` only if its new source chain is complete; otherwise set it to `false`.

- [ ] **Step 4: Run the focused test**

Run: `npm.cmd test -- src/domain/__tests__/sampleDataIntegrity.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 2: Add Local Demo Pipeline

**Files:**
- Create: `src/workflow/demoPipeline.ts`
- Create: `src/workflow/__tests__/demoPipeline.test.ts`

- [ ] **Step 1: Write the failing pipeline test**

```ts
import { jobFiles } from '../../domain/sampleData';
import { buildDemoPipelineResult } from '../demoPipeline';

describe('buildDemoPipelineResult', () => {
  it('turns pasted interview text into a review and answer asset', () => {
    const job = jobFiles[0];
    const result = buildDemoPipelineResult({
      job,
      conversationText:
        '面试官：你如何评估一个 AI 面试成长产品是否有效？\n候选人：可以看用户满意度和使用次数。\n面试官追问：这些指标如何证明准备质量提升？\nAI 点评：回答过于泛化，缺少过程指标和复用指标。',
      fallbackConversationText: ''
    });

    expect(result.session.jobFileId).toBe(job.id);
    expect(result.session.questions[0]?.question).toContain('AI 面试成长产品');
    expect(result.review.sessionId).toBe(result.session.id);
    expect(result.asset.sourceInterviewId).toBe(result.session.id);
    expect(result.asset.sourceReviewId).toBe(result.review.id);
    expect(result.asset.improvedAnswer).toContain('过程');
  });

  it('falls back to the seeded conversation when pasted text cannot be parsed', () => {
    const job = jobFiles[0];
    const result = buildDemoPipelineResult({
      job,
      conversationText: '这是一段无法识别的普通笔记',
      fallbackConversationText:
        '面试官：如何证明产品有效？\n候选人：看使用次数。\nAI 点评：缺少指标体系。'
    });

    expect(result.session.questions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/workflow/__tests__/demoPipeline.test.ts`

Expected: FAIL because `demoPipeline.ts` does not exist.

- [ ] **Step 3: Implement the pipeline**

Create `src/workflow/demoPipeline.ts`:

```ts
import { parseImportedConversation } from '../agents/importParser';
import { evaluateInterview } from '../agents/reviewEvaluator';
import { generateAnswerAsset } from '../agents/answerAssetGenerator';
import type { AnswerAsset, InterviewSession, JobFile, ReviewReport } from '../domain/types';

type DemoPipelineInput = {
  job: JobFile;
  conversationText: string;
  fallbackConversationText: string;
};

type DemoPipelineResult = {
  session: InterviewSession;
  review: ReviewReport;
  asset: AnswerAsset;
};

function makeSession(job: JobFile, rawConversation: string, questions: InterviewSession['questions']): InterviewSession {
  return {
    id: `session-${job.id}-generated`,
    jobFileId: job.id,
    source: 'externalImport',
    interviewType: '外部 AI 模拟面试对话导入',
    createdAt: '2026-07-09',
    rawConversation,
    questions
  };
}

export function buildDemoPipelineResult({ conversationText, fallbackConversationText, job }: DemoPipelineInput): DemoPipelineResult {
  const parsedQuestions = parseImportedConversation(conversationText);
  const rawConversation = parsedQuestions.length > 0 ? conversationText : fallbackConversationText;
  const questions = parsedQuestions.length > 0 ? parsedQuestions : parseImportedConversation(fallbackConversationText);
  const session = makeSession(job, rawConversation, questions);
  const review = evaluateInterview(job, session);
  const asset = generateAnswerAsset(job, session, review);

  return { session, review, asset };
}
```

- [ ] **Step 4: Run the focused pipeline test**

Run: `npm.cmd test -- src/workflow/__tests__/demoPipeline.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 3: Add Runtime Asset State Helper

**Files:**
- Create: `src/workflow/runtimeAssets.ts`
- Create: `src/workflow/__tests__/runtimeAssets.test.ts`

- [ ] **Step 1: Write the failing runtime state test**

```ts
import type { AnswerAsset } from '../../domain/types';
import { upsertAnswerAsset } from '../runtimeAssets';

const baseAsset: AnswerAsset = {
  id: 'asset-a',
  questionType: 'AI 产品效果评估',
  originalQuestion: '如何评估效果？',
  originalAnswer: '看使用次数。',
  issue: '指标体系不完整',
  improvedAnswer: '从过程、结果和长期复用三层评估。',
  applicableRoles: ['AI 产品经理'],
  applicableQuestions: ['如何评估效果？'],
  weaknessTag: '指标体系不完整',
  sourceJobId: 'job-a',
  sourceInterviewId: 'session-a',
  sourceReviewId: 'review-a',
  reuseScope: '同岗位后续轮次',
  usedInInterview: false,
  usageNote: '结合具体业务场景使用。',
  confidence: 'high'
};

describe('upsertAnswerAsset', () => {
  it('appends a new asset', () => {
    expect(upsertAnswerAsset([], baseAsset)).toEqual([baseAsset]);
  });

  it('replaces an existing asset with the same id', () => {
    const updated = { ...baseAsset, improvedAnswer: '新版回答' };

    expect(upsertAnswerAsset([baseAsset], updated)).toEqual([updated]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/workflow/__tests__/runtimeAssets.test.ts`

Expected: FAIL because `runtimeAssets.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/workflow/runtimeAssets.ts`:

```ts
import type { AnswerAsset } from '../domain/types';

export function upsertAnswerAsset(assets: AnswerAsset[], nextAsset: AnswerAsset) {
  const existingIndex = assets.findIndex((asset) => asset.id === nextAsset.id);
  if (existingIndex === -1) return [nextAsset, ...assets];

  return assets.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset));
}
```

- [ ] **Step 4: Run the focused runtime test**

Run: `npm.cmd test -- src/workflow/__tests__/runtimeAssets.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 4: Wire Runtime Assets and Local Generation Into UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/JobFileDetail.tsx`
- Modify: `src/pages/AssetsAndTraining.tsx`
- Modify: `src/pages/GrowthDashboard.tsx`

- [ ] **Step 1: Modify `App.tsx` to own runtime assets**

Add:

```ts
import { useState } from 'react';
import { answerAssets, jobFiles } from './domain/sampleData';
import type { AnswerAsset } from './domain/types';
import { upsertAnswerAsset } from './workflow/runtimeAssets';
```

Inside `App`:

```ts
const [runtimeAssets, setRuntimeAssets] = useState(answerAssets);

function handleSaveAsset(asset: AnswerAsset) {
  setRuntimeAssets((currentAssets) => upsertAnswerAsset(currentAssets, asset));
}
```

Pass props:

```tsx
<JobFileDetail
  selectedJobId={selectedJobId}
  onSelectJob={setSelectedJobId}
  answerAssets={runtimeAssets}
  onSaveAsset={handleSaveAsset}
  onOpenAssets={() => setView('assets')}
/>
```

```tsx
<AssetsAndTraining answerAssets={runtimeAssets} />
<GrowthDashboard answerAssets={runtimeAssets} />
```

- [ ] **Step 2: Modify page prop types**

In `JobFileDetail.tsx`:

```ts
type JobFileDetailProps = {
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
  answerAssets: AnswerAsset[];
  onSaveAsset: (asset: AnswerAsset) => void;
  onOpenAssets?: () => void;
};
```

In `AssetsAndTraining.tsx`:

```ts
type AssetsAndTrainingProps = {
  answerAssets: AnswerAsset[];
};
```

In `GrowthDashboard.tsx`:

```ts
type GrowthDashboardProps = {
  answerAssets: AnswerAsset[];
};
```

- [ ] **Step 3: Replace direct sample asset imports**

Remove `answerAssets` imports from the page files and use props instead. Keep imports for `jobFiles`, `interviewSessions`, `reviewReports`, and `trainingTasks` where still needed.

- [ ] **Step 4: Wire `JobFileDetail` generation**

Import:

```ts
import { buildDemoPipelineResult } from '../workflow/demoPipeline';
```

Add state:

```ts
const [generatedSession, setGeneratedSession] = useState(primarySession);
const [generatedReview, setGeneratedReview] = useState(primaryReview);
const [generatedAsset, setGeneratedAsset] = useState(primaryAsset);
```

In `handleGenerate`:

```ts
const generated = buildDemoPipelineResult({
  job: selectedJob,
  conversationText,
  fallbackConversationText: coldStartDemo.importedConversation
});

setWorkspaceState(startAnalysis(workspaceState));
window.setTimeout(() => {
  setGeneratedSession(generated.session);
  setGeneratedReview(generated.review);
  setGeneratedAsset(generated.asset);
  setEditableAnswer(generated.asset.improvedAnswer);
  setWorkspaceState((current) => completeAnalysis(current));
}, 600);
```

In `handleSaveAsset`:

```ts
const assetToSave = {
  ...generatedAsset,
  improvedAnswer: editableAnswer
};
onSaveAsset(assetToSave);
setWorkspaceState((current) => saveGeneratedAsset(current));
```

Use `generatedSession`, `generatedReview`, and `generatedAsset` in the compare panel and side panel instead of only seeded `primarySession` / `primaryAsset`.

- [ ] **Step 5: Keep selected asset valid in `AssetsAndTraining`**

After computing `selectedAsset`, make sure an empty filter state shows the empty panel and an outdated `selectedAssetId` falls back to `filteredAssets[0]`. No effect hook is required.

- [ ] **Step 6: Run tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 7: Run build**

Run: `npm.cmd run build`

Expected: production build passes.

---

### Task 5: Reorder Answer Asset Card

**Files:**
- Modify: `src/components/AnswerAssetCard.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Change visual order**

In `AnswerAssetCard.tsx`, render sections in this order:

```tsx
<article className="asset-card asset-card--prioritized">
  <header>...</header>

  <section className="asset-section asset-section--answer asset-section--primary">
    <strong>优化后的完整回答</strong>
    <p>{asset.improvedAnswer}</p>
  </section>

  <section className="asset-section asset-section--issue">
    <strong>具体问题点</strong>
    <p>{asset.issue}</p>
  </section>

  <details className="asset-card__original">
    <summary>查看原问题和原回答</summary>
    <strong>{asset.originalQuestion}</strong>
    <p>{asset.originalAnswer}</p>
  </details>

  <p className="usage-note">...</p>

  <details className="asset-card__metadata">
    <summary>来源与适用范围</summary>
    ...
  </details>
</article>
```

- [ ] **Step 2: Adjust CSS hierarchy**

Add CSS:

```css
.asset-section--primary {
  padding: 16px;
  border: 1px solid #abc6f7;
}

.asset-section--primary strong {
  display: block;
  margin-bottom: 8px;
  color: #172033;
}

.asset-card__metadata .source-line {
  margin-top: 10px;
}
```

- [ ] **Step 3: Run tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 4: Run build**

Run: `npm.cmd run build`

Expected: production build passes.

---

### Task 6: Lower Global Growth Trend Claims

**Files:**
- Modify: `src/pages/GrowthDashboard.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Update page wording**

Change hero to:

```tsx
<p className="eyebrow">全局成长</p>
<h1>查看已沉淀的问题、回答和考前训练</h1>
<p>这里汇总当前已经有证据的复盘结果。完成更多面试复盘后，再展示跨岗位重复问题和能力变化。</p>
```

Change the first panel:

```tsx
<p className="eyebrow">当前主要问题</p>
<h2>下一场面试前优先处理</h2>
```

Use `snapshot.repeatedWeaknesses` as data but avoid rendering the word “重复” when the count is 1:

```tsx
<strong>{weakness.count > 1 ? `${weakness.count} 次出现` : '本次复盘出现'}</strong>
```

- [ ] **Step 2: Adjust empty state if no weaknesses exist**

If `repeatedWeaknesses.length === 0`, render:

```tsx
<p className="usage-note">完成一次面试复盘后，这里会显示最需要优先处理的问题。</p>
```

- [ ] **Step 3: Run tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 4: Run build**

Run: `npm.cmd run build`

Expected: production build passes.

---

### Task 7: Final Verification and Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run complete tests**

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: build passes.

- [ ] **Step 3: Inspect git diff**

Run: `git diff --stat`

Expected: only V2.1 files changed.

- [ ] **Step 4: Stage files**

Run:

```powershell
git add src docs/superpowers/plans/2026-07-09-review-feedback-v21.md
```

- [ ] **Step 5: Commit**

Run:

```powershell
git commit -m "feat: connect review feedback workflow"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: covered data integrity, local generation pipeline, runtime asset state, answer card hierarchy, and global growth downgrade.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: plan uses existing `AnswerAsset`, `InterviewSession`, `JobFile`, and `ReviewReport` types. New helpers return plain typed objects and do not require new domain types.
