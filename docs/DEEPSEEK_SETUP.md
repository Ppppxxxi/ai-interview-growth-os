# DeepSeek 配置与开放门槛

本分支实现了可选的服务端逐题改写；不代表已接通真实账号或已经部署。默认测试不联网、不计费，不需要真实密钥。生成默认关闭，关闭时仍可整理资料、手写回答、查看历史与导出。

## 服务端配置

只由维护者在 Vercel 项目 Settings / Environment Variables 填写，区分 Preview / Production 并重新部署。不要把密钥发到聊天、命令行、Git、截图或日志，不使用 `VITE_` 前缀。

| 变量 | 要求 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 维护者账号密钥，仅服务端读取 |
| `DEEPSEEK_MODEL` | 实际账号可调用且支持 JSON 输出的模型；无默认型号，必须真实验收 |
| `AI_GENERATION_ENABLED` | 仅精确 `true` 启用；缺失或 `false` 关闭 |
| `NODEJS_HELPERS` | Vercel 项目环境变量必须为 `0`，确保原始请求流不被 Node helpers 预解析；缺失时服务端保持关闭 |

服务端仅在 `VERCEL=1` 时从平台的 `VERCEL_URL`、`VERCEL_BRANCH_URL`、`VERCEL_PROJECT_PRODUCTION_URL` 建立可信来源。请求 Origin 必须在列表且与 Host 匹配。自定义域名或分支域名必须在部署中核对实际注入值，不可假设任意域名被信任。Origin 检查不是身份认证，不能阻止伪造请求。

本地 `npm.cmd run dev` 复用同一 HTTP handler，仅信任当前实际端口的 loopback 来源。开发插件可以从忽略提交的本地 env 读取服务端变量；无密钥验收不创建、不读取这些文件。`npm.cmd run preview` 仅静态预览，不提供生成接口。

## 开放前硬门槛

1. 保持 `AI_GENERATION_ENABLED=false`，完成代码审查、全套测试、客户端及服务端类型检查、构建和产物 secret-marker 检查，推送功能分支并建立预览 PR，不合并生产。
2. 维护者在平台配置 key、实际账号 model、`NODEJS_HELPERS=0`，核对 Node 运行时、函数 60 秒上限及可信来源。账号与套餐支持情况以实际项目为准。
3. 在 Vercel WAF 为 `/api/answers/rewrite` 配置按 IP 每 60 秒最多 10 次的规则，明确保护预览与正式域名及直接 API 调用。实际验收第 11 次被限制为 HTTP 429（窗口边界需控制），非 JSON/HTML 429 也应正确提示。仅前端禁用按钮、进程内 Map 或假响应都不算 WAF 验收。不能配置/验证则不开放公开生成。
4. 在前述条件完成并获得用户真实计费授权后，仅用事先确认可公开的虚构资料短暂启用预览，实际验证账号模型、JSON schema、原文引用、missingFacts、额度/错误映射和原始请求流限制；不得仅凭 fake fetch 声称接通。防火墙拦截的请求可能仍产生平台费用。
5. 验证 `AI_GENERATION_ENABLED=false` 后重新部署，状态接口返回不可用且本地查看/编辑/导出仍工作。确认 WAF 和紧急关闭开关有效后，才能申请生产发布授权；预览授权不等于生产合并授权。

不要用真实用户材料做验收。取消前端请求不能保证上游停止计费；服务端不自动重试计费调用。账号额度限制不覆盖 Vercel 平台费用，也不替代防滥用规则。

## 请求与验收边界

- `GET /api/ai/status` 只返回 available，不返回 key、完整配置或余额；available 不是模型接通或 WAF 生效证明。
- `POST /api/answers/rewrite` 只接受当前问题上下文及明确选中的最多 6 片，每片 1,200 字符；问题上下文 8,000、总内容 20,000 字符、JSON 128 KiB。不接受客户端模型、上游地址、任意角色消息或工具调用。
- 只发送当前问题摘要、原回答、短板/改写重点、可选岗位/JD 摘要和选定片段，不上传原文件、整库或整场原始对话。发送前仍须核对预览中的个人信息，不能保证自动脱敏完整。
- 当前 JD 摘录由确认输入逐行去空白得到，预览与请求一致；不复用旧 profile，不调用模型提取。摘录超过 2000 字符或原 JD 超过 8000 字符时拒绝生成，须自行缩短，不截断。空 JD 省略摘要。
- 数据库日志状态未知或维护未恢复时，历史只读；独立无参考编辑明确未保存且不覆盖原草稿，恢复重试保留临时输入。普通岗位标签保留未采用回答，离岗/离页有丢弃确认。这些本地保护不代表真实模型或部署已验证。
- 官方 HTTPS 上游固定、非流式 JSON、最多 4,096 tokens、总超时 45 秒；函数配置 60 秒不等于平台已经接受配置，必须实际核验。响应 `Cache-Control: no-store`。
- 生产验收中覆盖有/无 Content-Length、超限原始流、非法 UTF-8、慢请求、非法 Origin/Host、禁用/缺配置路径；不得绕过 WAF 放开端点后再补验收。
- 默认 `npm.cmd test` 的 synthetic grounding/injection 是静态提示词与合约测试；有限字符串评分规则只对虚构 fixture 有意义，不测实际模型事实性、抗注入成功率或零幻觉。

## 当前状态

本地实现与真实联调、部署状态分别记录在 [发布说明](RELEASE_NOTES_MATERIALS_DEEPSEEK.md)。真实 DeepSeek、平台 WAF 429 和原始流部署验收未完成前，生成必须保持关闭。
