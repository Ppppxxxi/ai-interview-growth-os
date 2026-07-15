# Trust And Control V2.2 Design

## Goal

在 V2.1 已经打通“导入对话 -> 生成复盘 -> 生成回答资产 -> 保存资产”的基础上，补强真实面试用户最关心的可信度和控制权。这个版本不扩大产品边界，只让用户更清楚地判断：AI 为什么这样改、我是否认可、是否保存为可复用回答。

## Scope

本版本采用轻量可信工作流方案，只做三件事：

1. 展示 AI 改动依据。
2. 保存前增加用户确认动作。
3. 输入区增加示例格式和一键填入示例。

不做 `localStorage`、账号、后端、真实 LLM、完整 onboarding 流程，也不改变当前三栏工作台信息架构。

## Product Rationale

当前 Demo 已经能生成结果，但真实用户会继续追问：

- 这段优化回答哪里来自我的原回答？
- AI 补了什么？
- 这个回答会不会不符合我的真实经历？
- 我是否必须保存？
- 第一次使用时应该粘贴什么格式？

V2.2 的产品重点不是让 AI 输出更多，而是让用户能判断、编辑、确认和拒绝 AI 输出。

## User Experience Design

### 1. 改动依据面板

在岗位工作台的原回答 / 优化回答对比区中，增加一个“为什么这样改”区块。

内容包含：

- 原回答暴露的问题：沿用当前 `generatedAsset.issue`。
- 来自原回答的证据：优先展示 `generatedSession.questions[0].answer` 或 review score evidence。
- 建议改法：优先展示 `generatedReview.scores[0].suggestion`。
- 风险提示：固定提示“如果优化回答不符合你的真实经历，请先编辑后再保存。”

这个区块不新增复杂算法，先用已有 review / asset 数据生成可解释内容。

### 2. 用户确认后保存

当前按钮是“保存为回答资产”。V2.2 改为更明确的三态操作：

- `确认并保存`：保存当前编辑后的优化回答。
- `继续编辑`：聚焦优化回答输入区，不改变状态。
- `暂不保存`：保留生成结果，但不写入资产库。

保存成功后，按钮状态显示“已保存到回答资产库”，侧栏资产状态显示“已确认保存”。

产品原则：

- 用户编辑后的回答才是最终资产。
- 未确认的 AI 输出只是草稿。
- 保存动作必须让用户感知“我确认这段内容可代表我”。

### 3. 冷启动输入示例

在 JD 和外部面试对话输入区上方增加轻量提示，不做完整 wizard。

增加：

- “推荐粘贴格式”说明：
  - 面试官：问题
  - 候选人：回答
  - 面试官追问：追问
  - AI 点评：反馈
- “填入示例”按钮：把 `coldStartDemo.importedConversation` 和当前岗位 JD 填入输入框。
- 对话为空时，生成按钮旁显示“先粘贴一段面试对话，或使用示例开始”。

这个改动降低第一次使用的不确定感，但不把主流程改成多步骤表单。

## Technical Design

### Data Model

暂不改 `AnswerAsset` 类型。V2.2 的确认状态只存在于当前工作台状态中：

- `workspaceState.status === 'assetSaved'` 表示已确认保存。
- 未保存时，生成结果保留在 `generatedAsset`，但不进入 runtime assets。

如果后续做真实使用版，再考虑给资产增加：

- `acceptanceStatus`
- `acceptedAt`
- `editedBeforeSave`

### Component Changes

主要修改 `src/pages/JobFileDetail.tsx`：

- 在 compare panel 下方或右侧加入 explanation block。
- 保存按钮区改为三按钮操作。
- 输入区增加推荐格式提示和填入示例按钮。
- `handleSaveAsset` 只在用户点击“确认并保存”时调用 `onSaveAsset`。

辅助修改 `src/styles.css`：

- 增加 explanation block 样式。
- 增加 input hint / example action 样式。
- 增加 confirm action row 样式。

### Tests

新增或调整测试：

- `demoPipeline` 继续证明生成结果可用于解释。
- 新增纯 helper 测试，如果抽出 `buildAnswerExplanation`：
  - 输入 session / review / asset。
  - 输出包含 issue、evidence、suggestion、risk。
- UI 行为测试暂不引入 React Testing Library；当前项目仍以 agent / workflow 单元测试为主。

## Acceptance Criteria

1. 用户在岗位工作台能看到“为什么这样改”。
2. 保存前用户必须点击“确认并保存”，不会把 AI 草稿直接当最终资产。
3. 用户可以选择继续编辑或暂不保存。
4. 输入区清楚告诉用户应该粘贴什么格式，并可以一键填入示例。
5. `npm.cmd test` 和 `npm.cmd run build` 通过。

## Non-Goals

- 不做数据持久化。
- 不做登录和云同步。
- 不接真实 LLM。
- 不做完整新手引导 wizard。
- 不修改三 Tab 信息架构。
- 不重写现有 agent。

## Open Risks

- 确认状态刷新后仍会丢失。这符合当前本地产品原型边界。
- 改动依据仍然来自 deterministic mock agent，不能代表真实模型解释能力。
- “填入示例”可能让用户误以为只能处理固定格式，因此文案要强调“推荐格式”，不是唯一格式。
