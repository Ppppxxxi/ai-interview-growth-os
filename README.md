# AI 面试成长 OS

面向产品经理求职者的 AI 面试成长系统。它不是替代 ChatGPT / Codex 做模拟面试，而是作为第二层工具，把分散在外部 AI 对话、岗位档案和复盘材料里的面试经验结构化沉淀，并转成下一场面试能复用的回答资产。

## 作品集完整愿景

AI 面试成长 OS 的长期目标是帮助高频面试用户持续沉淀：

- 岗位档案：每个岗位聚合 JD、面试记录、复盘和关联回答资产。
- 结构化复盘：解释原回答的问题、归因、修改方向和下一步准备重点。
- 回答资产：保存原问题、原回答、问题点、优化回答、来源面试和适用范围。
- 全局成长：识别重复短板、资产复用情况和后续能力变化。

## 当前 MVP 闭环

第一阶段先证明更高频、更容易验证的核心价值：

```text
粘贴 JD + 粘贴外部 AI 面试对话
→ 解析出问题、回答、追问和点评
→ 生成结构化复盘
→ 生成优化后的完整回答
→ 保存为回答资产
→ 在同岗位多轮 / 同方向类似岗位中复用
```

当前 Demo 默认使用“星河智能 AI 产品经理实习生”样例，展示一条完整数据链路：JD + 外部对话 → 复盘 → 优化回答 → 回答资产 → 复用场景。

## 信息架构

- **岗位工作台**：默认首页。聚合 JD、外部对话导入、面试记录、复盘报告、优化回答和该岗位关联回答资产。
- **回答资产库**：核心产出页面。支持按岗位方向、问题类型、能力短板和置信度筛选回答资产。
- **全局成长**：长期视图。数据不足时不强行展示复杂均分图谱，只展示重复短板、资产沉淀和下一场建议练习问题。

## Mock Agent 说明

当前本地 Demo 使用 deterministic mock agent，保证无需 API Key 即可稳定运行。真实上线版本会将以下模块替换为 LLM 调用：

1. `importParser`：外部对话解析
2. `jdAnalyst`：JD 画像分析
3. `reviewEvaluator`：结构化复盘生成
4. `answerAssetGenerator`：优化回答与回答资产生成
5. `growthPlanner`：跨场次短板识别

Agent 合约见：[docs/agents/agent-contracts.md](docs/agents/agent-contracts.md)。

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

PowerShell 环境中建议使用 `npm.cmd`，避免系统执行策略拦截 `npm.ps1`。

## GitHub 上传前检查

- 不提交 `.env` 或任何 API Key。
- 不提交真实简历、真实公司面试记录、手机号、邮箱等敏感信息。
- Demo 数据使用脱敏或虚构样例。
- 上传前运行 `npm.cmd test` 和 `npm.cmd run build`。
