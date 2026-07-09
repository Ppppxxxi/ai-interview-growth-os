# Trust And Control V2.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight trust-and-control layer to the interview workspace: explain why the answer was changed, require user confirmation before saving, and make the first input easier with a recommended format and example fill.

**Architecture:** Keep V2.1 runtime state and deterministic mock agents unchanged. Add one small pure workflow helper for answer explanations, then render that helper in `JobFileDetail`. UI state remains local to the workspace; saving still flows through `onSaveAsset` into `App.tsx` runtime assets.

**Tech Stack:** React, TypeScript, Vite, Vitest, CSS.

---

## File Map

- Create `src/workflow/answerExplanation.ts`: builds the “why this change” content from existing session, review, and asset data.
- Create `src/workflow/__tests__/answerExplanation.test.ts`: TDD coverage for explanation content and fallback behavior.
- Modify `src/pages/JobFileDetail.tsx`: add recommended input format, fill-example action, explanation panel, and three confirmation actions.
- Modify `src/styles.css`: add styling for input hint, explanation panel, and confirmation actions.

---

### Task 1: Add Answer Explanation Helper

**Files:**
- Create: `src/workflow/answerExplanation.ts`
- Create: `src/workflow/__tests__/answerExplanation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/workflow/__tests__/answerExplanation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { answerAssets, interviewSessions, reviewReports } from '../../domain/sampleData';
import { buildAnswerExplanation } from '../answerExplanation';

describe('buildAnswerExplanation', () => {
  it('builds evidence, suggestion, issue, and risk copy from generated results', () => {
    const session = interviewSessions[0];
    const review = reviewReports[0];
    const asset = answerAssets[0];

    const explanation = buildAnswerExplanation({ asset, review, session });

    expect(explanation.issue).toBe(asset.issue);
    expect(explanation.evidence).toContain(session.questions[0].answer);
    expect(explanation.suggestion).toBe(review.scores[0].suggestion);
    expect(explanation.risk).toContain('真实经历');
  });

  it('falls back to review summary when score evidence is missing', () => {
    const session = {
      ...interviewSessions[0],
      questions: [{ ...interviewSessions[0].questions[0], answer: '' }]
    };
    const review = { ...reviewReports[0], scores: [] };
    const asset = answerAssets[0];

    const explanation = buildAnswerExplanation({ asset, review, session });

    expect(explanation.evidence).toBe(review.summary);
    expect(explanation.suggestion).toContain('先编辑确认');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm.cmd test -- src/workflow/__tests__/answerExplanation.test.ts
```

Expected: FAIL because `src/workflow/answerExplanation.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

Create `src/workflow/answerExplanation.ts`:

```ts
import type { AnswerAsset, InterviewSession, ReviewReport } from '../domain/types';

type BuildAnswerExplanationInput = {
  asset: AnswerAsset;
  review: ReviewReport;
  session: InterviewSession;
};

export type AnswerExplanation = {
  issue: string;
  evidence: string;
  suggestion: string;
  risk: string;
};

export function buildAnswerExplanation({ asset, review, session }: BuildAnswerExplanationInput): AnswerExplanation {
  const primaryAnswer = session.questions[0]?.answer.trim();
  const primaryScore = review.scores[0];

  return {
    issue: asset.issue,
    evidence: primaryAnswer || primaryScore?.evidence || review.summary,
    suggestion: primaryScore?.suggestion || '先编辑确认这段回答是否符合你的真实经历，再保存为回答资产。',
    risk: '如果优化回答不符合你的真实经历，请先编辑后再保存。'
  };
}
```

- [ ] **Step 4: Run the focused test**

Run:

```powershell
npm.cmd test -- src/workflow/__tests__/answerExplanation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run:

```powershell
npm.cmd test
```

Expected: all tests pass.

---

### Task 2: Add Explanation Panel And Confirmation Actions

**Files:**
- Modify: `src/pages/JobFileDetail.tsx`

- [ ] **Step 1: Import the helper**

In `src/pages/JobFileDetail.tsx`, add:

```ts
import { buildAnswerExplanation } from '../workflow/answerExplanation';
```

- [ ] **Step 2: Add a textarea ref**

Change the React import:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
```

Add state support below `editableAnswer`:

```ts
const answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
const answerExplanation = buildAnswerExplanation({
  asset: generatedAsset,
  review: generatedReview,
  session: generatedSession
});
```

- [ ] **Step 3: Rename save handler to confirmation**

Replace `handleSaveAsset` with:

```ts
function handleConfirmSaveAsset() {
  onSaveAsset({
    ...generatedAsset,
    improvedAnswer: editableAnswer
  });
  setWorkspaceState((current) => saveGeneratedAsset(current));
}

function handleContinueEditing() {
  answerTextareaRef.current?.focus();
}

function handleSkipSave() {
  setWorkspaceState((current) => ({
    ...current,
    status: 'reviewReady'
  }));
}
```

- [ ] **Step 4: Attach the ref to the optimized answer textarea**

Change the optimized answer textarea to:

```tsx
<textarea ref={answerTextareaRef} value={editableAnswer} onChange={(event) => setEditableAnswer(event.target.value)} />
```

- [ ] **Step 5: Replace the single save button with three actions**

Replace the current `.compare-actions` content with:

```tsx
<div className="compare-actions compare-actions--confirm">
  <button type="button" onClick={handleConfirmSaveAsset}>
    {workspaceState.status === 'assetSaved' ? '已保存到回答资产库' : '确认并保存'}
  </button>
  <button className="secondary-action" type="button" onClick={handleContinueEditing}>
    继续编辑
  </button>
  <button className="ghost-action" type="button" onClick={handleSkipSave}>
    暂不保存
  </button>
  <span>{workspaceState.status === 'assetSaved' ? '已确认保存' : 'AI 草稿，保存前请确认符合你的真实经历'}</span>
</div>
```

- [ ] **Step 6: Add explanation block after the compare panel**

Immediately after `</section>` for `.compare-panel`, add:

```tsx
<section className="explanation-panel">
  <div className="section-heading">
    <p className="eyebrow">为什么这样改</p>
    <h2>改动依据</h2>
  </div>
  <div className="explanation-grid">
    <article>
      <strong>原回答暴露的问题</strong>
      <p>{answerExplanation.issue}</p>
    </article>
    <article>
      <strong>来自原回答的证据</strong>
      <p>{answerExplanation.evidence}</p>
    </article>
    <article>
      <strong>建议改法</strong>
      <p>{answerExplanation.suggestion}</p>
    </article>
    <article>
      <strong>保存前确认</strong>
      <p>{answerExplanation.risk}</p>
    </article>
  </div>
</section>
```

- [ ] **Step 7: Update the side panel status text**

Change the side panel status expression to:

```tsx
<h2>{workspaceState.status === 'assetSaved' ? '已确认保存' : '待确认'}</h2>
```

- [ ] **Step 8: Run tests**

Run:

```powershell
npm.cmd test
```

Expected: all tests pass.

- [ ] **Step 9: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: production build passes.

---

### Task 3: Add Input Format Hint And Fill Example Action

**Files:**
- Modify: `src/pages/JobFileDetail.tsx`

- [ ] **Step 1: Add the fill example handler**

In `JobFileDetail.tsx`, add this function near the other handlers:

```ts
function handleFillExample() {
  setJdText(selectedJob.jdText);
  setConversationText(coldStartDemo.importedConversation);
}
```

- [ ] **Step 2: Add input hint above the input textareas**

Immediately before `<section className="workspace-inputs">`, add:

```tsx
<section className="input-helper-panel">
  <div>
    <p className="eyebrow">推荐粘贴格式</p>
    <p>面试官：问题 / 候选人：回答 / 面试官追问：追问 / AI 点评：反馈</p>
    {!conversationText.trim() && <span>先粘贴一段面试对话，或使用示例开始。</span>}
  </div>
  <button className="secondary-action" type="button" onClick={handleFillExample}>
    填入示例
  </button>
</section>
```

- [ ] **Step 3: Run tests**

Run:

```powershell
npm.cmd test
```

Expected: all tests pass.

- [ ] **Step 4: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: production build passes.

---

### Task 4: Add Styles For V2.2 UI

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add input helper styles**

Append:

```css
.input-helper-panel,
.explanation-panel {
  border: 1px solid #dce3ef;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 36px rgba(23, 32, 51, 0.045);
}

.input-helper-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.input-helper-panel p:not(.eyebrow),
.input-helper-panel span {
  margin: 0;
  color: #53647d;
  line-height: 1.6;
}

.input-helper-panel span {
  display: block;
  margin-top: 6px;
  color: #c2410c;
  font-size: 14px;
}
```

- [ ] **Step 2: Add explanation styles**

Append:

```css
.explanation-panel {
  padding: 18px;
}

.explanation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.explanation-grid article {
  border: 1px solid #e3e9f2;
  border-radius: 8px;
  padding: 14px;
  background: #fbfcfe;
}

.explanation-grid strong {
  display: block;
  margin-bottom: 8px;
}

.explanation-grid p {
  margin: 0;
  color: #53647d;
  line-height: 1.65;
}
```

- [ ] **Step 3: Add secondary and ghost action styles**

Append:

```css
.secondary-action,
.ghost-action {
  border-radius: 8px;
  padding: 11px 15px;
  font-weight: 800;
}

.secondary-action {
  border: 1px solid #b9c8df;
  color: #2f6fed;
  background: #ffffff;
}

.ghost-action {
  border: 1px solid transparent;
  color: #65758f;
  background: transparent;
}

.compare-actions--confirm {
  align-items: center;
}
```

- [ ] **Step 4: Add responsive behavior**

Inside the existing `@media (max-width: 920px)` block, include:

```css
.input-helper-panel,
.explanation-grid {
  grid-template-columns: 1fr;
}

.input-helper-panel {
  align-items: flex-start;
  flex-direction: column;
}
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all tests and production build pass.

---

### Task 5: Final Verification And Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected:

- `npm.cmd test`: all tests pass.
- `npm.cmd run build`: build passes.

- [ ] **Step 2: Inspect diff**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected:

- Only V2.2 files changed.
- No whitespace errors.

- [ ] **Step 3: Stage files**

Run:

```powershell
git add src docs/superpowers/plans/2026-07-09-trust-control-v22.md
```

- [ ] **Step 4: Commit**

Run:

```powershell
git commit -m "feat: add trust and control workflow"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: covers explanation panel, user confirmation before saving, continue editing, skip save, input format hint, and fill example action.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: new `AnswerExplanation` helper uses existing `AnswerAsset`, `InterviewSession`, and `ReviewReport` types. No domain type changes are required.
- Scope control: no persistence, auth, real LLM, onboarding wizard, tab restructuring, or agent rewrite.
