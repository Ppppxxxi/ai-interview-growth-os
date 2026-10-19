# 从本地到部署的验收流程

本 SOP 适用于“我的资料 + 可选 DeepSeek 逐题改写”。本地实现、实际模型联调、部署完成必须分别报告。默认生成关闭；预览 PR 授权不等于合并生产授权。

## 1. 本地提交门槛

```powershell
git status --short
npm.cmd test
npm.cmd run build
git diff --check
```

build 同时检查客户端 TypeScript、build:server 与 Vite 产物。测试默认不联网、不计费；不得把 fake fetch 或 synthetic 通过称为真正模型接通。检查 dist 无测试 secret marker、服务端配置/上游鉴权信息；文档出现公开变量名不等于泄密，但客户端不应包含密钥、服务端 env 配置读取器。

隔离浏览器、全虚构资料、无外部 provider，桌面与窄屏跑：空白起始 -> 资料导入/编辑 -> 选片/发送预览 -> 逐题 fake 生成/采用/保存 -> 回答库及版本 -> 删除系统引用 -> 备份恢复/非法备份 -> 取消/失败 -> 清空。检查刷新持久化、溢出、控制台错误；保留截图与结果但不提交私人备份或运行日志，临时服务 finally 关闭。fake browser 只验证本地链路，不验证真实 DeepSeek 或 WAF。

只暂存目标文件，审查 git diff --cached。不要 git add .；用户 README 额外修改、聊天上下文、旧风格计划、logs/output 不得混入提交。混合修改通过精确 index patch 保留用户工作树内容。

## 2. 功能分支与关闭生成的预览

本地全验收后由授权 controller 推送功能分支、创建预览 PR，记录精确 commit 与 URL，不 merge 生产。核对 Vercel 构建 Ready、预览指向目标 commit，先在生成关闭状态检查页面及不可用提示。

部署预检提供的项目记录：prj_rdt7LoUjonOZjAUwFAXnzZyIT3ds、Vite、Node 24.x；未读到 teamId/slug，env metadata 列表为空。显式 team scope env/WAF 请求 403、unscoped WAF 404；未改配置。这些记录不是“无需配置”“无任何 secret”或 WAF 不存在的证明，需要有权限的维护者在平台核对。

## 3. 云端前置门槛

按 [DEEPSEEK_SETUP](DEEPSEEK_SETUP.md) 由用户在平台填写 key 和实际账号 model，不经聊天/源码/日志传递。核对 Preview/Production scopes、重新部署后的可信 Origin/Host、项目环境 NODEJS_HELPERS=0 与实际原始请求流、函数 60 秒配置和平台限制。

配置 WAF：仅生成接口 /api/answers/rewrite，10 次/IP/60 秒，预览和正式域名及直接 API 均覆盖。实际控制窗口验证第 11 次 429，并检查 HTML/非 JSON 错误提示。按钮禁用、mock 429、进程内限流不算验收。权限/套餐/规则无法验证则保持生成关闭，不绕过。

## 4. 经授权的真实联调

仅用户确认可公开的虚构内容；明确真实请求可能计费。前置条件齐备后短暂启用预览，验证实际账号模型支持、非流式 JSON、missingFacts、引用原文/版本、无资料零引用、注入样例的人工事实核对、额度/限流/超时错误不破坏本地答案。

用真实部署验证 128 KiB 原始流限制、非法 UTF-8/Origin/Host、慢请求和关闭开关；本地 handler 测试不能代替项目 NODEJS_HELPERS=0 实验。不要通过大量付费请求盲测额度。只记录脱敏状态、commit、时间与结论，不记录正文或 key。取消无法保证撤销上游费用；账号额度不包含平台费用。

## 5. 生产与回退

先验证 AI_GENERATION_ENABLED=false 并重新部署后状态接口不可用，本地查看/编辑/导出仍正常。只有得到单独生产发布授权才合并；核对 production commit、Ready 和正式域名，再完成授权的真实虚构材料闭环及 WAF/关闭验证。

异常时先关闭生成并重新部署；必要时平台回滚上一稳定部署，另做修复提交，不改写已推送历史。关闭不撤回已发请求，不保证无平台费用。备份/本地数据在回滚中不能假定自动恢复。

## 验收记录

每次记录：分支/精确 SHA、命令和退出码、测试数及警告、客户端/服务端 build、marker 结果、浏览器桌面/窄屏场景与截图、临时服务已关闭、真实模型是否执行、WAF 实际 429 是否执行、部署 URL/commit/Ready、生产授权与未解决风险。不得省略失败或把“待用户配置”写成“部署完成”。
