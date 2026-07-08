# Demo Focus Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the local demo around the first-stage loop: paste JD and external interview conversation, generate a structured review, create an improved answer, save it as an answer asset, and reuse it in the same role or similar role direction.

**Architecture:** Keep the client-side React + TypeScript app and deterministic local agents. Add a focused `answerAssetGenerator` pure function with Vitest coverage, enrich local sample data with linked source metadata, and reorganize pages into three top-level views: job workspace, answer asset library, and global growth.

**Tech Stack:** React, TypeScript, Vite, Vitest, deterministic mock agents, local sample data.

---

## Task 1: Add Answer Asset Generator

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/agents/answerAssetGenerator.ts`
- Create: `src/agents/__tests__/answerAssetGenerator.test.ts`

- [ ] Write a failing test that generates an asset from one review report and one interview question.
- [ ] Implement the minimal generator returning source job, source interview, original question, original answer, issue, improved answer, applicable roles, similar questions, weakness tag, confidence, and usage note.
- [ ] Run `npm.cmd test -- src/agents/__tests__/answerAssetGenerator.test.ts`.

## Task 2: Rebuild Sample Closed Loop

**Files:**
- Modify: `src/domain/sampleData.ts`

- [ ] Make the 星河智能 AI 产品经理实习生 data show one complete chain: JD, imported interview conversation, structured review, generated answer asset, reuse scenarios.
- [ ] Keep secondary platform PM data only as a similar-direction reuse example.

## Task 3: Refactor Information Architecture

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/JobFileDetail.tsx`
- Modify: `src/pages/InterviewReview.tsx`
- Modify: `src/pages/AssetsAndTraining.tsx`
- Modify: `src/pages/GrowthDashboard.tsx`
- Modify: `src/styles.css`

- [ ] Change navigation to 岗位工作台 / 回答资产库 / 全局成长.
- [ ] Make 岗位工作台 the default page and primary cold-start flow.
- [ ] Show the primary CTA: 粘贴 JD + 粘贴面试对话 -> 生成复盘与优化回答.
- [ ] Add explicit links and source labels between job, review, and asset views.
- [ ] De-emphasize numeric scores and focus on explanation, improvement, and reusable answer.

## Task 4: Add Agent Contract Documentation and README Updates

**Files:**
- Create: `docs/agents/agent-contracts.md`
- Modify: `README.md`

- [ ] Document deterministic mock agent scope and LLM replacement points.
- [ ] Add input, output JSON schema, prompt goal, fallback strategy, and user confirmation point for each agent.
- [ ] Update README to distinguish full OS vision from current MVP loop and narrow reuse to same role rounds / similar role direction.

## Task 5: Verify and Commit

**Files:**
- All changed files

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git status --short`.
- [ ] Commit with `feat: refocus demo around answer asset loop`.
