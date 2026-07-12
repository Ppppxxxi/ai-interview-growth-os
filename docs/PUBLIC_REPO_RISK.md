# 公开仓库风险检查

检查日期：2026-07-12

## 当前结论

当前项目可以作为 v0.2 Personal MVP 作品集仓库发布。风险重点不是代码安全，而是公开仓库里的样例数据、浏览器本地数据截图、过程文档和产品能力边界是否容易被误读。

## 已检查项目

### 密钥与环境变量

未发现：

- `.env` 文件。
- API Key、token、secret、cookie。
- 真实 LLM endpoint 或私有服务地址。

已有保护：

- `.gitignore` 已忽略 `.env`、`.env.*`、`node_modules/`、`dist/`、`*.tsbuildinfo`。

### 个人隐私与真实求职材料

未发现：

- 手机号、邮箱、微信号、身份证等个人联系方式。
- 真实简历正文。
- 真实公司面试记录。

注意：

- `src/domain/sampleData.ts` 中的公司、岗位和对话是 Demo 样例，应在 README 中保持“样例数据 / mock agent”表述。
- v0.2 会把用户导入的真实 JD 和面试对话保存在浏览器 `localStorage`，这些数据不会进入 Git 仓库。
- 如果公开截图或录屏，必须确认浏览器本地数据已经替换为样例数据或完成脱敏。

### 产品能力边界

当前风险：

- 面试官可能误以为 Demo 已经接入真实 LLM。
- 面试官可能误以为回答资产已经云端同步。
- 面试官可能误以为“跨岗位复用”适用于所有岗位。

已处理：

- README 明确当前是 deterministic mock agent。
- README 明确当前仅做浏览器本地持久化，暂不做登录、云同步和真实 LLM。
- 文案收窄为“同岗位多轮 / 同方向类似岗位复用”。

### 过程文档

当前仓库保留 `docs/superpowers/`，包含产品设计、执行计划和迭代过程。

发布建议：

- 如果目标是展示产品经理思考过程，可以保留。
- 如果目标是让仓库更轻量，可以后续把过程文档移到 portfolio case study，只保留 README、Roadmap 和 Agent 合约。

## 发布前建议

1. 不上传真实个人求职材料。
2. 不在 README 中写“已上线”“真实 AI 复盘”等容易误导的表述。
3. 如需公开给他人复用代码，补充 LICENSE。
4. 如后续接入 LLM，把 API Key 放在本地 `.env`，并继续保持 `.env` 不提交。
5. v0.2 开始使用浏览器 `localStorage` 保存个人数据；这些数据不会进入 Git 仓库，但公开截图前仍需要脱敏。
6. 每次发布前运行：

```powershell
npm.cmd test
npm.cmd run build
```
