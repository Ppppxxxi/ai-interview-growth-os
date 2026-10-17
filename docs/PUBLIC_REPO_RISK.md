# 公开仓库与公开生成风险

本分支含本地资料与可选 DeepSeek 服务端实现；默认关闭，不代表已接通真实账号、配置 WAF 或发布生产。旧 v0.2 的“纯前端/不接 LLM”结论不再代表当前代码。

## 隐私与数据

- 资料及可恢复主流程草稿存 IndexedDB，岗位/面试/回答存 localStorage，仅当前浏览器和网站来源，无云同步。隐私模式、配额、清理和不同预览域名会影响可用性。
- 只发送当前问题摘要/原回答/确认短板/改写重点、可选岗位/JD 摘要和明确选中的最多 6 片，不发整库、原文件或整场原始对话。用户必须核对发送预览，不能保证自动脱敏完整。
- JSON 全量备份包含私人正文、草稿和引用；Markdown 含答案及引用摘录。不可提交私人备份、真实截图、运行日志或真实求职材料。删除只清系统引用，不改答案正文或用户手写内容，旧下载无法撤回。
- 临时 no-ref 故障分支及 JobAnswersPanel 未保存页内草稿不能承诺导航恢复；本地保存也不是永久磁盘备份。
- 业务不主动记录材料/回答/密钥，不等于平台/模型提供商零日志或零留存。错误、监控、录屏与分享仍需审查脱敏。

## 公共接口与费用

密钥仅服务端，无 VITE_ 前缀；.env*、node_modules、dist 忽略提交。不得将真实 key 发给代理或写入测试、快照、浏览器和日志。产物 marker 检查只能证明所测标记未泄漏，不是全面安全认证。

生成默认关闭。实际账号模型、可信来源、NODEJS_HELPERS=0 项目原始流、WAF 10/IP/60 秒及实际 429、用户授权的真实计费联调与紧急关闭验证全部通过才可开放。Origin 非认证，IP 限流无法杜绝分布式滥用。账号额度不覆盖平台费用；取消不能保证不计费；服务端不自动重试。

45 秒、4,096 tokens、128 KiB 是应用限制，不是费用上限或平台统一保证。函数 60 秒配置需实际核对套餐/运行时。配置权限不足时保持关闭，不宣称保护已经生效。详见 [配置门槛](DEEPSEEK_SETUP.md)。

## AI 与解析边界

只有逐题改写可选 DeepSeek；parser/JD/复盘/成长仍为本地规则。synthetic grounding/injection 是静态/合约验证，不是实际模型事实性评估或抗注入成功率。知识笔记不能作为个人成果，缺数值要求 missingFacts；提示词与引用校验不能保证零幻觉，合法来源摘录也不能证明答案事实正确。

文档本地提取不执行宏/HTML，不做 OCR，不保存原二进制；5 MiB 压缩文件限制不排除 DOCX 解压资源耗尽等风险。不要把不调用 CLI 等同任意不可信文档安全。

## 依赖审计残留

以下为 controller 两次审计提供的结果，不是 Task10 新的联网 audit，也未进行 force fix：生产 3 moderate、0 high、0 critical；全量 11（5 moderate、4 high、2 critical）。生产链 mammoth -> argparse -> sprintf-js，当前 src/materials/importDocument.ts 使用 mammoth/mammoth.browser，其浏览器 bundle 不经过 CLI bin/mammoth 的 argparse 路径；仅说明该告警路径在当前浏览器导入中不可达，不等于 audit clean 或依赖无风险。

dev Vitest/tinypool/@vitest/mocker、browserslist/baseline、nanoid、postcss/source-map-js 仍需后续维护。api/server 运行时代码未导入上述 dev 测试工具（仅测试使用），但开发工具链风险仍在；本任务不做 major upgrade。不要对公网暴露测试/开发服务。React 测试已有 act 警告，不能把通过写成 log pristine。

发布前只提交代码和全虚构 fixture，检查暂存差异、产物 marker、测试/build、隔离浏览器结果与准确能力声明；公开过程文档也不得混入私人上下文。无真实联调/部署证据时分别写“未执行”。
