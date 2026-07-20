# GitHub 发布检查清单

## 产品叙事

- [ ] README 首屏能说明用户痛点。
- [ ] README 明确说明它不是普通模拟面试工具，而是第二层面试经验沉淀工具。
- [ ] README 说明 v0.2 Personal MVP 闭环。
- [ ] README 说明 deterministic mock agent 与未来真实 LLM 的边界。
- [ ] README 链接 Roadmap、Release Notes、Product Case Study、Agent 合约和公开风险说明。

## 工程验证

- [ ] `npm.cmd install` 可安装依赖。
- [ ] `npm.cmd run dev` 可启动本地应用。
- [ ] `npm.cmd test` 通过。
- [ ] `npm.cmd run build` 通过。
- [ ] 没有提交 `dist/`、`node_modules/`、`.env`、`*.tsbuildinfo`。

## v0.2 演示路径

- [ ] 进入岗位工作台后，能用示例岗位和示例面试对话快速跑通流程。
- [ ] 能完成：粘贴 JD -> 粘贴外部面试对话 -> 解析预览 -> 生成复盘 -> 保存回答资产。
- [ ] 能切换和删除多场面试记录。
- [ ] 能在回答资产库搜索、筛选、记录使用反馈和保存回答版本。
- [ ] 能导出单场复盘、岗位准备包和回答资产合集 Markdown。

## 公开仓库风险

- [ ] 没有 API Key、token、cookie、私有 endpoint。
- [ ] 没有真实简历、真实面试记录、手机号、邮箱、微信号。
- [ ] 样例公司、岗位、对话和经历为 mock 数据，可公开展示。
- [ ] README 明确当前是本地 Personal MVP，不承诺真实 LLM 能力。
- [ ] 真实 JD 和真实面试材料只保存在浏览器 `localStorage`，不进入 Git 仓库。
- [ ] 公开截图前已脱敏浏览器本地数据。
- [ ] 如需允许他人复用代码，补充 LICENSE。

## 发布建议

- [ ] GitHub 仓库描述建议：`AI interview review and answer asset system for PM candidates`。
- [ ] Topics 建议：`ai-product-manager`、`interview-prep`、`react`、`typescript`、`llm-agents`。
- [ ] 发布前创建 `v0.2-personal-mvp` tag。
- [ ] 如暂时没有截图，也可以先发布 README + Product Case Study，后续补图。
