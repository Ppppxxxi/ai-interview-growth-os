# GitHub 发布检查清单

## 产品叙事

- [ ] README 首屏能说明用户痛点。
- [ ] README 明确说明它不是普通模拟面试工具，而是第二层经验沉淀工具。
- [ ] README 能说明当前 MVP 闭环。
- [ ] README 能说明 mock agent 与未来 LLM 的边界。
- [ ] README 链接 Roadmap、Agent 合约和公开风险说明。

## 工程验证

- [ ] `npm.cmd install` 可安装依赖。
- [ ] `npm.cmd run dev` 可启动本地 Demo。
- [ ] `npm.cmd test` 通过。
- [ ] `npm.cmd run build` 通过。
- [ ] 没有提交 `dist/`、`node_modules/`、`.env`、`*.tsbuildinfo`。

## 公开仓库风险

- [ ] 没有 API Key、token、cookie、私有 endpoint。
- [ ] 没有真实简历、真实面试记录、手机号、邮箱、微信号。
- [ ] 样例公司、岗位、对话和经历可公开展示。
- [ ] README 明确当前是本地 Demo，不承诺真实 LLM 能力。
- [ ] 如需允许他人复用代码，补充 LICENSE。

## 面试展示

- [ ] 打开首页后 30 秒内能看懂“导入对话 -> 复盘 -> 优化回答 -> 保存资产”。
- [ ] 岗位工作台能展示一条完整数据链路。
- [ ] 回答资产库能看到来源岗位、来源面试、原回答、问题点和优化回答。
- [ ] 全局成长只展示有证据的短板和复用情况。
- [ ] 可以解释为什么第一阶段不做登录、持久化和真实 LLM。

## 发布建议

- [ ] GitHub 仓库描述建议：`AI interview review and answer asset system for PM candidates`.
- [ ] Topic 建议：`ai-product-manager`、`interview-prep`、`react`、`typescript`、`llm-agents`。
- [ ] 发布前创建 `v0.1` tag。
- [ ] README 截图可在后续补充，但不要阻塞 v0.1 发布。
