# AI Interview Growth OS Design

Date: 2026-07-01

## 1. Product Positioning

AI Interview Growth OS is an AI-powered interview growth system for product manager candidates. The MVP focuses on AI product manager interview preparation while keeping the structure extensible to other PM tracks such as B2B, data, growth, and platform PM.

The product does not position itself as a one-off mock interview chatbot. Its core value is turning scattered interview sessions into reusable growth assets: ability insights, answer assets, and targeted training tasks.

### One-line Pitch

Help product manager candidates convert every mock interview and real interview review into reusable preparation assets for the next interview.

## 2. Target Users

Primary target users:

- Product manager candidates preparing for multiple interview rounds.
- Early-career or graduate candidates who frequently use AI tools for mock interviews.
- Users who need to manage many job descriptions, interview sessions, feedback notes, and revised answers.

MVP focus:

- Product manager candidates preparing for AI product manager roles.

## 3. Problem Statement

Current AI-assisted interview preparation has four major pain points:

1. Session fragmentation: each job or interview often lives in a separate AI chat session, making historical learning hard to reuse.
2. Information overload: JD analysis, question references, answers, follow-up questions, feedback, and generated documents become difficult to navigate.
3. Weak review persistence: useful interview feedback, repeated weaknesses, and strong answer fragments are not automatically saved as structured assets.
4. Poor transfer across interviews: users struggle to extract reusable lessons from previous interviews and apply them to similar future interviews.

The deeper problem is not the lack of AI-generated interview questions. The deeper problem is that interview experience is not converted into durable preparation capital.

## 4. Product Strategy

The product uses a hybrid structure:

- Product narrative: ability growth system.
- Core data unit: job/interview file.

Job files remain essential, but they are not the main product story. Each job file records one target role and its related preparation or interview sessions. The global growth system aggregates insights across all job files.

### Layered Structure

```text
AI Interview Growth OS
  -> Growth dashboard
  -> Global ability map
  -> Answer asset library
  -> Training tasks

Job / interview files
  -> JD profile
  -> Experience matching
  -> Built-in mock interview
  -> External chat import
  -> Structured review report
```

The key product judgment is: job files collect evidence, while the growth system turns evidence into reusable learning.

## 5. User Journey

1. The user creates a personal experience library with internships, projects, research, competitions, and other reusable stories.
2. The user creates a job/interview file by pasting a JD and selecting a PM direction.
3. The system analyzes the JD and matches relevant personal experiences.
4. The user either starts a built-in mock interview or imports an external AI interview conversation.
5. The system extracts questions, answers, follow-up questions, and feedback.
6. The system generates a structured review report using a consistent scoring rubric.
7. The review updates the global ability map.
8. The system extracts reusable answer assets.
9. The system generates user training tasks for the next interview.
10. Before a future interview, the user retrieves similar past questions, reusable answer assets, repeated weaknesses, and targeted training tasks.

## 6. Core Pages

### 6.1 Growth Dashboard

The dashboard is the product's main entry point. It emphasizes long-term interview growth rather than one isolated interview session.

Key modules:

- Global ability map.
- Recent recurring weaknesses.
- Ability trend across interview sessions.
- Reusable answer asset count.
- Next training tasks.
- Recently updated job/interview files.

First-stage demo priority: high.

### 6.2 Job / Interview File List

This page manages all target jobs and interview records.

Each file displays:

- Company.
- Role title.
- PM direction.
- Interview stage.
- Preparation status.
- Last review summary.
- Ability changes contributed by the latest session.

First-stage demo priority: medium.

### 6.3 Job File Detail

This page is the structured workspace for one target role.

Key modules:

- JD profile.
- Experience matching.
- Built-in mock interview entry.
- External chat import entry.
- Interview session history.
- Related review reports.
- Related answer assets.
- Job-specific training suggestions.

First-stage demo priority: high.

### 6.4 Interview Review Page

This page is where the AI Agent value becomes visible.

Key modules:

- Extracted question list.
- Original answers.
- Follow-up questions.
- AI feedback.
- Ability scoring.
- Evidence snippets.
- Problem attribution.
- Suggested improved answer.
- Save as answer asset action.
- Generate training task action.

First-stage demo priority: high.

### 6.5 Answer Assets and Training Plan

For MVP, answer assets and training tasks can share one page to reduce scope.

Answer asset fields:

- Question type.
- Original answer.
- Improved answer.
- Applicable roles.
- Linked experience.
- Usage notes.
- Confidence level.

Training task fields:

- Training goal.
- Related ability dimension.
- Practice question.
- Reference framework.
- Due date.
- Completion status.
- Retry result.

First-stage demo priority: medium.

## 7. Data Model

### 7.1 Experience

Represents a reusable personal story.

Fields:

- Title.
- Context.
- Task.
- Action.
- Result.
- Ability tags.
- Evidence metrics.
- Applicable question types.

Used by:

- JD matching.
- Mock interview question generation.
- Answer improvement.
- Answer asset creation.

### 7.2 JobFile

Represents one target role or preparation file.

Fields:

- Company.
- Role title.
- PM direction.
- JD raw text.
- JD profile.
- Interview stage.
- Preparation status.
- Linked interview sessions.

Used by:

- JD profile generation.
- Experience matching.
- Interview session grouping.

### 7.3 InterviewSession

Represents one built-in mock interview or imported external conversation.

Fields:

- Source: built-in mock or external import.
- Timestamp.
- Interview type.
- Questions.
- Answers.
- Follow-up questions.
- AI feedback.
- Raw conversation text.

Used by:

- Structured review generation.
- Ability map update.
- Answer asset extraction.

### 7.4 ReviewReport

Represents the structured analysis of one interview session.

Fields:

- Ability scores.
- Evidence snippets.
- Main weaknesses.
- Strong expressions.
- Suggested improvements.
- Next actions.

Used by:

- Global ability map.
- Answer asset extraction.
- Training task generation.

### 7.5 AnswerAsset

Represents a reusable answer asset.

Fields:

- Question type.
- Original answer.
- Improved answer.
- Applicable roles.
- Linked experience.
- Usage notes.
- Confidence level.

Used by:

- Future interview preparation.
- Answer retrieval for similar questions.

### 7.6 TrainingTask

Represents a user interview ability training task. This is not model training or fine-tuning.

Fields:

- Training goal.
- Related ability dimension.
- Practice question.
- Reference framework.
- Due date.
- Completion status.
- Retry result.

Used by:

- Next interview preparation.
- Growth dashboard.

## 8. AI Agent Workflow

The MVP should avoid overcomplicated multi-agent orchestration, but it should expose clear AI capability stages.

### 8.1 JD Analyst

Input:

- JD raw text.
- PM direction.

Output:

- Core responsibilities.
- Ability keywords.
- Hidden requirements.
- Likely interview question types.

Value:

- Ensures preparation starts from the target role instead of generic interview advice.

### 8.2 Experience Matcher

Input:

- JD profile.
- Personal experience library.

Output:

- Best-fit experiences.
- Ability evidence for each experience.
- Missing or weak evidence.
- Suggested story angle.

Value:

- Helps users decide which experience to use for which interview question.

### 8.3 Interview Simulator / Import Parser

Built-in mock interview mode:

- Generates role-specific questions.
- Asks follow-up questions.
- Records answers.
- Produces immediate interviewer-style feedback.

External import mode:

- Accepts pasted ChatGPT, Codex, or other AI interview conversation.
- Extracts questions, answers, follow-up questions, and feedback.
- Preserves the original raw conversation text.

Value:

- Supports both in-product mock interviews and users' existing AI interview workflows.

### 8.4 Review Evaluator

Input:

- Interview session.
- JD profile.
- Matched experiences.
- Scoring rubric.

Output:

- Scores by ability dimension.
- Evidence snippets.
- Strengths.
- Weaknesses.
- Problem attribution.
- Improved answer suggestions.

Value:

- Converts subjective feedback into structured review assets.

### 8.5 Growth Planner

Input:

- Current review report.
- Historical review reports.
- Existing answer assets.
- Existing training tasks.

Output:

- Updated ability map.
- Reusable answer assets.
- Next training tasks.
- Repeated weakness summary.

Value:

- Converts failed or imperfect interviews into preparation data for future interviews.

## 9. Scoring Rubric

MVP uses six product-manager-oriented ability dimensions. The first version is optimized for AI PM interviews.

### 9.1 Role Understanding

Checks whether the user understands the company's business, role responsibilities, user scenarios, and hiring intent.

### 9.2 Product Analysis

Checks whether the user can break down users, scenarios, needs, workflows, priorities, and product tradeoffs.

### 9.3 AI Product Understanding

Checks whether the user understands model capability boundaries, Agent workflow, evaluation, hallucination risk, safety, cost, and fallback design.

### 9.4 Data and Metrics

Checks whether the user can define goals, success metrics, experiments, and effect evaluation methods.

### 9.5 Project Storytelling

Checks whether the user can clearly explain personal experience using a structured format such as STAR.

### 9.6 Communication and Structure

Checks whether the user answers with hierarchy, focus, clarity, and responsiveness to follow-up questions.

### Scoring Format

Each ability score must contain:

- Score from 1 to 5.
- Evidence snippet.
- Problem attribution.
- Improvement suggestion.

Example:

```text
AI Product Understanding: 2/5
Evidence: The answer mentioned using an LLM to improve efficiency, but did not explain model boundaries, fallback design, or evaluation metrics.
Attribution: The answer stayed at the concept level and lacked product implementation detail.
Suggestion: Add Agent task decomposition, human confirmation points, and measurable evaluation metrics.
```

## 10. MVP Scope

### Must Have

1. Personal experience library with manual entry.
2. Job/interview file creation with pasted JD.
3. JD profile generation.
4. Experience matching.
5. Built-in mock interview.
6. External conversation import by pasted text.
7. Structured interview review.
8. Global growth dashboard.
9. Answer asset extraction.
10. User interview training task generation.

### Out of Scope

- Automatic job scraping from recruitment sites.
- Resume file upload and parsing.
- Browser plugin for reading ChatGPT history.
- Real multi-user account system.
- Model fine-tuning or model training.
- Voice interview mode.
- Payment, subscription, or commercial admin backend.

## 11. Success Metrics

The MVP should be evaluated with product validation metrics rather than vanity traffic metrics.

Suggested metrics:

- A user can create a job file and complete one review within 10 minutes.
- Each review generates at least 3 reusable answer assets.
- The system can identify repeated ability weaknesses across 3 interview sessions.
- A user can reuse past questions, answers, or training tasks before preparing for a new interview.
- User-rated review clarity is higher than directly asking ChatGPT for a summary.

## 12. Portfolio Deliverables

The project should be presented as a full product project, with first-stage delivery focused on a working demo and a product case study.

### 12.1 Web App Demo

Demo pages:

- Growth dashboard.
- Job file detail.
- External chat import.
- Interview review.
- Answer assets and training tasks.

### 12.2 Product Case Study

Case study structure:

- Background and personal pain point.
- Target user and scenario.
- Problem definition.
- Current workflow problems.
- Product strategy.
- User journey.
- Core information architecture.
- MVP scope.
- Metrics and validation plan.
- Iteration plan.

### 12.3 PRD

The PRD should include:

- User roles.
- Scenarios.
- Functional requirements.
- Data model.
- AI Agent workflow.
- Scoring rubric.
- Error handling.
- Non-goals.

### 12.4 Iteration Review

After real use, record:

- Which outputs were useful.
- Which outputs were inaccurate.
- Which review insights were reusable.
- Which product assumptions were wrong.
- What should change in the next version.

## 13. Resume Story

Suggested resume bullet:

```text
Designed and vibe-coded an AI Interview Growth OS for product manager candidates, supporting job files, AI mock interviews, external AI conversation import, structured review, ability mapping, answer asset extraction, and user training tasks. The project addressed fragmented interview sessions, overloaded review materials, and weak cross-interview learning transfer, completing a full loop from user pain point validation and PRD to interactive demo.
```

## 14. Key Design Decisions

1. Growth dashboard is the product's top-level narrative, while job files are the evidence collection layer.
2. Training tasks refer to user interview ability training, not model training or fine-tuning.
3. External conversation import is included in MVP because target users already use external AI tools for mock interviews.
4. All AI outputs should be structured into durable objects rather than stored only as chat text.
5. Scores must be evidence-based to avoid generic AI feedback.

## 15. Risks and Mitigations

### Risk: Cold Start

The global growth dashboard may look weak without multiple interview sessions.

Mitigation:

- Provide demo seed data with 3 to 5 interview sessions.
- Let the dashboard show onboarding tasks when data is insufficient.

### Risk: Generic AI Feedback

AI review may produce broad comments that do not help users improve.

Mitigation:

- Require every score to include evidence snippets, attribution, and specific suggestions.
- Use a fixed rubric for consistency.

### Risk: Scope Creep

The product could expand into resume editing, job search, CRM, and full career coaching.

Mitigation:

- MVP focuses only on interview records, review, answer assets, and training tasks.
- Resume upload, job scraping, and browser plugins remain out of scope.

### Risk: Privacy Sensitivity

Interview records and personal experiences contain sensitive data.

Mitigation:

- MVP can use local demo data.
- The product should clearly separate raw conversation text from structured derived assets.
- Future versions should support deletion and redaction controls.

## 16. First-stage Demo Priority

High priority:

- Growth dashboard.
- Job file detail.
- Interview review page.
- External conversation import.

Medium priority:

- Job file list.
- Answer asset and training task page.

Low priority:

- Account system.
- Advanced settings.
- Cross-device sync.
