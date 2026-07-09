# Review Feedback V2.1 Design

## Goal

把“双重评审”里最有价值的意见落地为一个小版本：修正 Demo 数据可信度，让生成按钮真正产出本地 mock 复盘和回答资产，降低全局成长页在数据不足时的趋势暗示，并让回答资产库更符合真实求职用户的阅读优先级。

## Scope

本版本不接真实后端、不接真实 LLM、不引入账号体系或云端存储。继续保持本地 deterministic mock agent，重点证明产品闭环和工程边界：

1. 用户粘贴 JD 和外部面试对话。
2. 点击生成后，本地 agent 解析并生成复盘和回答资产。
3. 用户可以编辑优化回答，并保存为当前会话中的回答资产。
4. 回答资产库优先展示“下次怎么答”，弱化元数据。
5. 全局成长页只展示当前数据能支撑的内容。

## Product Decisions

### 1. 数据链路一致性

当前样例里有一条 `usedInInterview: true` 的资产来自没有真实面试记录的岗位，容易被理解为数据造假。本版本改为让已使用资产有完整来源链路：岗位、面试记录、复盘、回答资产彼此一致。

验收标准：

- “已实战使用”不再来自孤儿资产。
- `sourceJobId`、`sourceInterviewId`、`sourceReviewId` 都能在样例数据里找到。
- 全局成长页的统计和资产库标签含义一致。

### 2. 生成按钮接入本地工作流

当前按钮已经有状态切换，但核心结果仍主要来自 `sampleData`。本版本把 `importParser`、`reviewEvaluator`、`answerAssetGenerator` 串起来，形成最小可交互链路。

交互：

- 点击“生成复盘与优化回答”后进入 `generating` 状态。
- 使用当前 textarea 中的 JD 和对话内容生成结果。
- 生成完成后展示新的原问题、原回答、问题点和优化回答。
- 点击“保存为回答资产”后，新资产出现在当前会话资产列表和回答资产库中。

兜底：

- 如果对话解析不到问答，使用当前冷启动样例作为兜底，不让页面空白。
- 如果 JD 文本为空，保留当前岗位方向作为分析上下文。

### 3. 回答资产卡片重排

资产库用户的核心任务不是审计元数据，而是快速拿走可复用回答。本版本把视觉优先级改成：

1. 优化后的完整回答
2. 具体问题点
3. 原始问题与原始回答
4. 使用建议
5. 来源、适用问题、标签和置信度

来源和标签保留，但不抢主视觉。

### 4. 全局成长页降级表达

只有 1 条复盘数据时，不使用“重复短板”“趋势”这类需要多样本支撑的表达。本版本把页面改为当前状态快照：

- “当前主要问题”
- “已沉淀回答”
- “覆盖岗位”
- “考前优先训练”

仍保留“长期面试成长 OS”的叙事，但不假装已经有足够数据做趋势分析。

## Technical Design

### Runtime Data Layer

在 `App.tsx` 或轻量 hook 中维护运行时资产状态：

- 初始值来自 `sampleData.answerAssets`。
- 保存新资产时追加到运行时数组。
- 传给 `JobFileDetail`、`AssetsAndTraining`、`GrowthDashboard`，避免每个页面直接读取静态资产后互相不同步。

暂不做 `localStorage`，避免把本轮变成持久化项目。真实使用版本再加。

### Agent Pipeline

`JobFileDetail` 点击生成时调用：

1. `parseImportedConversation(conversationText, selectedJob.id)`
2. `evaluateReview(parsedSession, selectedJob.id)`
3. `generateAnswerAsset(review, parsedSession, selectedJob.direction)`

如果现有函数签名不完全匹配，以最小适配函数包一层，不重写 agent。

### Tests

新增或调整测试覆盖：

- 样例资产来源链路完整。
- 生成流程能从输入对话产出 answer asset。
- 保存资产后运行时资产列表包含新资产。
- 全局成长文案不再把 1 次问题称为“重复短板”。

## Non-Goals

- 不接 OpenAI API。
- 不做账号、数据库、云同步。
- 不做完整训练任务管理。
- 不增加复杂图表。
- 不把所有 mock 数据扩展成多岗位大数据集。

## Open Risks

- 运行时资产状态会在刷新后丢失。这符合当前本地 Demo 边界，但后续真实使用需要 `localStorage` 或后端。
- deterministic parser 无法覆盖复杂真实对话格式。本版本只保证冷启动样例和常见“面试官/候选人/AI 点评”格式稳定。
