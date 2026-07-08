# Portfolio UI V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the demo from a static feature prototype into a portfolio-grade, usable local workflow for generating review feedback and reusable answer assets.

**Architecture:** Keep the existing React + TypeScript + local sample data architecture. Add a small pure workflow module for interaction state, then reshape existing pages into high-fidelity SaaS-style layouts without adding backend or real LLM dependencies.

**Tech Stack:** React, TypeScript, Vite, Vitest, plain CSS.

---

## Task 1: Add Demo Workflow State

**Files:**
- Create: `src/workflow/demoFlow.ts`
- Create: `src/workflow/__tests__/demoFlow.test.ts`

- [ ] Write a failing test for the idle -> generating -> reviewReady -> assetSaved state sequence.
- [ ] Implement pure helpers to create initial workspace state, start analysis, complete analysis, and save the answer asset.
- [ ] Run `npm.cmd test -- src/workflow/__tests__/demoFlow.test.ts`.

## Task 2: Rebuild Job Workspace UI

**Files:**
- Modify: `src/pages/JobFileDetail.tsx`
- Modify: `src/styles.css`

- [ ] Replace the current card stack with a three-column workspace.
- [ ] Add editable JD and conversation textareas.
- [ ] Add primary CTA and generation states.
- [ ] Add side-by-side original answer and improved answer comparison.
- [ ] Add right sidebar for saved asset and training context.

## Task 3: Upgrade Answer Asset Library

**Files:**
- Modify: `src/pages/AssetsAndTraining.tsx`
- Modify: `src/components/AnswerAssetCard.tsx`
- Modify: `src/styles.css`

- [ ] Change from full card list to list + detail layout.
- [ ] Keep existing filters.
- [ ] Add selected asset state.
- [ ] Show source job, source interview, original answer, issue, improved answer, similar questions, and usage note in the detail pane.

## Task 4: Visual System Pass

**Files:**
- Modify: `src/styles.css`

- [ ] Add product-shell spacing, panel hierarchy, badges, status steps, compare cards, and focus states.
- [ ] Keep restrained SaaS style: light gray background, white surfaces, blue primary action, orange warning state, green saved state.
- [ ] Verify responsive behavior at narrow widths via CSS media queries.

## Task 5: Verify and Commit

**Files:**
- All changed files

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Run a local Vite HTTP smoke test.
- [ ] Commit with `feat: upgrade demo to portfolio UI v1`.
