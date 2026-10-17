# 我的资料与 DeepSeek 引用回答

状态：分支本地实现，不是生产上线公告。无真实模型接通、WAF 生效或生产发布完成的声明。

## 本地能力

- 我的经历/知识笔记保存到浏览器 IndexedDB；支持粘贴、TXT、Markdown、DOCX、文字版 PDF 的本地文本提取与确认。单文件 5 MiB，文本 50,000 字符；不做 OCR，不保存原文件。
- 本地关键词匹配推荐片段，用户明确选择最多 6 片；发送预览后逐题生成。主流程与岗位详情复用服务端改写接口；用户采用并保存后才成为回答资产。
- 回答保存引用与版本快照；编辑源资料显示源已更新，手动改答案需重审引用。引用校验只验证 ID、原文摘录和段落对应，不证明推理正确或事实无误。
- 删除资料清系统维护的当前/历史/草稿引用摘录、标题与定位，保留答案正文。正文和手写内容可能仍含已采用经历，需自行修改；旧下载和备份无法撤回。
- 全量 JSON 备份/恢复、异常备份拒绝、清空本地数据及未完成删除恢复。备份含私人正文和引用，必须自行妥善保管，不可上传公开仓库。

岗位、面试与回答仍在 localStorage；资料及可恢复主流程草稿在 IndexedDB。仅当前浏览器/网站来源可用，无云同步、登录或永久备份保证。不同预览/生产域名不自动共享。临时 no-ref 资料故障分支及 JobAnswersPanel 未保存页内草稿，不承诺导航后恢复。

## AI 边界

只有可选逐题改写接入 DeepSeek 服务端；materialImportParser、importParser、jdAnalyst、reviewEvaluator、growthPlanner 等仍为本地规则，非全 Agent AI。缺配置/关闭/失败不静默生成固定模板冒充实时模型。

只发送当前问题摘要和用户选中的片段，不发送整库/原文件。知识笔记只能支持方法；未证实职责、成果、数值要求列入 missingFacts。模型仍可能误读、捏造或受注入影响，用户必须核对。业务不主动保存请求/回答正文或密钥日志，但不能替平台或提供商承诺零日志、零留存、零幻觉。

## 验证分层

| 层次 | 本次范围与状态 |
| --- | --- |
| 本地 | 离线单元/集成、客户端与服务端构建、产物 marker、隔离浏览器 fake API 验收；结果以 Task10 报告和独立审查为准 |
| 实际模型 | 未执行，不读真实 key、不调用 provider；虚构 fixture 与 fake fetch 通过不等于真实模型已接通 |
| 部署 | 未执行 push/PR/云配置/发布，由 controller 在本地验收后处理；生成默认关闭，不合并生产 |

`server/ai/__tests__/groundingEvaluation.test.ts` 全虚构数据，覆盖事实/建议、知识冒充业绩、缺数值、注入指令隔离与 schema/引用拒绝。有限 rubric 不是一般语义检测器；测试还显式记录“结构和引用合法的捏造答案仍可通过服务端”的缺口。没有模型质量分数或抗注入成功率结论。

## 发布门槛与残余风险

按 [配置说明](DEEPSEEK_SETUP.md) 和 [部署 SOP](DEPLOYMENT_VALIDATION_WORKFLOW.md) 操作。key、实际账号 model、可信来源、项目 `NODEJS_HELPERS=0` 原始流、WAF 10/IP/60 秒的实际 429、用户授权的真实计费虚构材料联调及关闭开关验收前，不开放公开生成。Origin 非身份认证，分布式滥用仍可能发生；账号额度不覆盖平台费用。

controller 提供的依赖审计：生产 3 moderate / 0 high / 0 critical；全量 11（5 moderate / 4 high / 2 critical）。生产告警链为 mammoth -> argparse -> sprintf-js，当前 `mammoth/mammoth.browser` 路径不经过 CLI 的 argparse；这不是 audit clean 或所有输入安全的证明。dev Vitest/tinypool/@vitest/mocker、browserslist/baseline、nanoid、postcss/source-map-js 仍待维护评估；不为本任务做 major upgrade/force fix。压缩 DOCX 资源耗尽、浏览器配额和本地数据丢失风险仍存在。测试已有 React act 警告，不称日志全净。详见 [风险说明](PUBLIC_REPO_RISK.md)。
