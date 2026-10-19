# 我的资料与 DeepSeek 引用回答实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有公开网页版中，完成资料本地导入、用户选定片段、真实 DeepSeek 优化回答及可追溯引用的闭环。

**Architecture:** 保留现有岗位与回答的 localStorage，新增 IndexedDB 资料 repository。前端本地解析、检索和选择资料，Vercel 无状态接口调用维护者提供的 DeepSeek 密钥；主流程与岗位详情共用真实生成客户端，答案与引用按版本保存。

**Tech Stack:** React、TypeScript、Vite、Vitest；idb、Zod、pdfjs-dist、mammoth；测试采用 fake-indexeddb、jsdom、Testing Library。服务端使用 Node fetch 与 Vercel Functions，限流使用 Vercel WAF。

**Spec:** [已通过设计](../specs/2026-10-13-my-materials-deepseek-design.md)

状态：待用户确认执行方式；尚未开始实现。任务按依赖顺序执行，在当前会话内逐任务完成测试与提交，不并发修改共享接口。

## 全局约束

- 公开使用，无登录、邀请码或用户填写密钥；维护者统一提供 DeepSeek 密钥。
- 本地保存不等于离线推理，生成时明确展示必要内容会发送至 DeepSeek。
- 单文件最大 5 MiB，提取文本最多 50,000 字符；只支持粘贴、TXT、Markdown、DOCX、文字版 PDF，不做 OCR。
- 片段最多 6 个，单片段最多 1,200 字符，问题上下文最多 8,000 字符，总内容最多 20,000 字符，JSON 请求最多 128 KiB。
- 非流式 JSON，max_tokens 上限 4,096，总超时 45 秒，函数执行上限配置 60 秒并核对平台实际限制。
- WAF 按 IP 每 60 秒最多 10 次生成；未完成实际限流验收不开放生产生成。
- 无向量库、云业务数据库、联网搜索、独立资料聊天、自动云同步或全 Agent 替换。
- 知识笔记不是个人经历；缺失职责或成果列待补充，不编造。
- 密钥不得进入客户端、仓库、测试快照或日志；任何真实资料不得进入代码和公开测试。
- 用户确认前不保存模型答案；失败不覆盖已有答案、不静默返回固定模板。
- 保持首次空白流程、简洁浅色 UI，不恢复已删除的示例入口和预置岗位说明。

## 审查重点

1. 导入后用户改了文本：旧 PDF 页码不能误定位到新文本，任务 3 覆盖。
2. 生成中切题、编辑或清空数据：迟到响应不能覆盖新状态，任务 7 与 9 覆盖。
3. 同一资料被多版答案引用：删除必须清除所有系统管理的摘录，不改写答案正文，任务 9 覆盖。
4. WAF 返回 HTML 而不是 JSON：客户端仍能提示限流而不是解析报错，任务 5 覆盖。
5. 浏览器配额不足或两个标签页并发：不得显示假保存成功或覆盖新版资料，任务 2 与 9 覆盖。

## 文件边界

- `src/domain/materialTypes.ts`：文档、片段、草稿、删除任务类型。
- `src/domain/llmContracts.ts`：请求响应 schema、限制值与可公开错误码，不含服务端配置。
- `src/domain/types.ts`：现有答案类型增加可选 evidence、generation、missingFacts。
- `src/materials/`：repository、文件提取、分段、检索、变更恢复与备份，纯数据逻辑。
- `src/llm/`：客户端、生成状态 hook、请求准备和引用校验，不导入服务端模块。
- `src/pages/MyMaterials.tsx` 与 `src/components/materials/`：资料页面与选择组件。
- `src/components/AnswerEvidence.tsx`：统一展示证据状态、摘录与段落。
- `server/ai/`：配置、固定提示词、上游调用、HTTP 验证和错误映射。
- `api/answers/rewrite.ts`、`api/ai/status.ts`：薄 Vercel 入口。
- `server/devApiPlugin.ts`：本地开发转交同一处理函数，不向浏览器注入密钥。
- 现有 App、FocusFlowPage、JobFileDetail、AnswerAssetCard 与保存/导出 workflow 仅修改对应接入点，不重构整个页面系统。

每任务遵循先写失败测试、确认失败原因、最小实现、测试通过、审查差异、定向提交。不运行 git add .，不提交用户上下文、无关 README、运行日志或构建产物。

## 任务 1：建立资料与生成合约

**文件：** 创建 `src/domain/materialTypes.ts`、`src/domain/llmContracts.ts`、`src/llm/validateEvidence.ts`、`src/llm/__tests__/contracts.test.ts`；修改 `src/domain/types.ts`、`package.json`、锁文件。

**接口：** 定义 MaterialDocument、MaterialChunk、MaterialDraft、PendingDeletion、AnswerEvidence、AnswerGeneration（字段遵照设计）；类型从 Zod schema 推导 RewriteRequest 与 RewriteResponse。提供 `validateEvidence(request: RewriteRequest, response: RewriteResponse): AnswerEvidence[]`，失败抛公开错误 `INVALID_RESPONSE`。

响应引用只接受 chunkId、quote、answerParagraphIndex；文档名、版本和类别由已验证请求映射，不信任模型提供的标题。服务端元数据 questionId、generationId、model、generatedAt 不由模型生成。段落按空行分隔、忽略空段，索引从 0 开始。

- [ ] 写 `rejects_seven_chunks`、`rejects_1201_character_chunk`、`rejects_unknown_fields`、`rejects_wrong_quote_and_paragraph`、`accepts_zero_citations` 测试；断言 schema 边界及不存在的来源无法通过。
- [ ] 运行 `npm.cmd test -- --run src/llm/__tests__/contracts.test.ts`，确认新增模块未实现而失败。
- [ ] 安装 Zod，实现严格 schema 与纯引用校验；总字符数统计所有可发送内容字段，重复 chunkId 拒绝。引用只允许空白归一化后原文子串。
- [ ] 给 DraftItem、AnswerAsset、AnswerAssetVersion 增加可选 generation、evidence、missingFacts；旧数据无字段仍合法。
- [ ] 同一命令全部通过，现有测试通过；提交 `feat: add material and grounded answer contracts`。

## 任务 2：实现本地资料 repository

**文件：** 创建 `src/materials/repository.ts`、`src/materials/__tests__/repository.test.ts`；修改依赖与锁文件。

**接口：** `createMaterialRepository(factory?: IDBFactory): MaterialRepository`。方法签名：

```ts
listDocuments(): Promise<MaterialDocument[]>;
listChunks(): Promise<MaterialChunk[]>;
getDocument(id: string): Promise<MaterialDocument | undefined>;
saveDocument(document: MaterialDocument, chunks: MaterialChunk[], expectedVersion: number | null): Promise<void>;
saveDraft(draft: MaterialDraft): Promise<void>;
listDrafts(): Promise<MaterialDraft[]>;
deleteDraft(id: string): Promise<void>;
putDeletion(task: PendingDeletion): Promise<void>;
listDeletions(): Promise<PendingDeletion[]>;
deleteDocumentAndChunks(id: string): Promise<void>;
finishDeletion(id: string): Promise<void>;
clearAll(): Promise<void>;
exportSnapshot(): Promise<MaterialSnapshot>;
replaceSnapshot(snapshot: MaterialSnapshot): Promise<void>;
```

MaterialSnapshot 包含 documents、chunks、drafts；未完成删除先由协调器恢复，不导出恢复日志。saveDocument 在同一事务内更新文档及分段，expectedVersion=null 表示新增，版本冲突抛 `VERSION_CONFLICT`。本任务测试传入虚构片段；任务 3 提供实际分段，避免 repository 依赖尚未实现的解析器。

- [ ] 用 fake-indexeddb 写 `persists_after_reopen`、`increments_version_atomically`、`rejects_stale_version`、`preserves_data_on_quota_error`、`retains_pending_deletion` 测试。
- [ ] 运行 `npm.cmd test -- --run src/materials/__tests__/repository.test.ts`，确认红灯。
- [ ] 使用 idb 封装固定版本数据库的 documents、chunks、drafts、pendingDeletions 四个 store；失效连接可以重新打开，但写失败不回退内存。
- [ ] 测试全绿；提交 `feat: persist personal materials locally`。

## 任务 3：本地提取、分段与检索

**文件：** 创建 `src/materials/importDocument.ts`、`src/materials/chunkDocument.ts`、`src/materials/searchMaterials.ts` 与对应 `__tests__/*.test.ts`；创建虚构文件夹具 `src/materials/__tests__/fixtures/`；修改依赖与锁文件。

**接口：** `importDocument(file: File): Promise<ImportedMaterial>` 返回 text、format、sourceFileName、可选页边界；`chunkDocument(document: MaterialDocument, pages?: PageText[]): MaterialChunk[]`；`searchMaterials(chunks: MaterialChunk[], query: string, limit = 6): MaterialChunk[]`；`suggestMaterialTags(text: string): string[]` 只产出建议，不直接保存。

- [ ] 写四种格式可提取、5 MiB/50,000 字符边界、旧 DOC/扫描与加密 PDF拒绝、PDF页码保留、编辑文本后定位降为段落、1,200 字符长段落切分、中英查询、零匹配与稳定排序测试。
- [ ] 运行 `npm.cmd test -- --run src/materials/__tests__`，确认新增测试失败。
- [ ] TXT/MD 使用 File.text；DOCX 使用 mammoth.extractRawText；PDF 使用 pdfjs-dist，仅本地打包 worker，不从 CDN 下载。PDF 禁用脚本执行，不触发外链资源；用真实虚构 PDF/DOCX 夹具检验而非只 mock 解析器。
- [ ] 段落优先、长句硬切，ID 使用文档 ID/版本/片段序号；检索使用标签权重、英文词和中文二字片段重叠，按分数及稳定 ID 排序。无有效重叠返回空，不拼凑推荐。
- [ ] 测试全绿；构建确认 worker 产物可加载；提交 `feat: import and search local reference materials`。

## 任务 4：真实 DeepSeek 服务端

**文件：** 创建 `server/ai/config.ts`、`server/ai/prompts.ts`、`server/ai/rewrite.ts`、`server/ai/httpHandlers.ts`、`server/ai/__tests__/rewrite.test.ts`、`server/ai/__tests__/httpHandlers.test.ts`、`api/answers/rewrite.ts`、`api/ai/status.ts`、`server/devApiPlugin.ts`、`tsconfig.server.json`、`.env.example`；修改 `.gitignore`、`vite.config.ts`、构建脚本。

**接口：** `rewriteAnswer(request: RewriteRequest, deps: {fetch: typeof fetch; config: AIConfig; now: () => string}): Promise<RewriteResponse>`；Node `handleRewrite(req: IncomingMessage, res: ServerResponse): Promise<void>` 与 `handleAIStatus(req, res): void` 共用于开发与 Vercel。配置仅 server 导入。

- [ ] 写 `calls_official_host_with_server_key`、`does_not_retry`、`rejects_invalid_citation`、`times_out_at_45_seconds`、`rejects_128_kib_overflow`、`does_not_expose_provider_body`、`disabled_or_unconfigured_never_calls_fetch` 测试，用假 fetch/虚构 key，不读取真实环境密钥。
- [ ] 运行 `npm.cmd test -- --run server/ai/__tests__`，确认红灯。
- [ ] 服务端严格验证 POST/application-json、请求字节与字段；Origin 只允许当前可信 Host，部署 Host 依据平台文档获取，不直接信任客户端任意转发头；拒绝未知参数和来源。固定官方上游和系统指令，传 JSON 数据块、JSON 输出示例及 schema。
- [ ] 固定 max_tokens=4096，AbortController 45 秒总超时，禁止自动重试。生成开关仅 `AI_GENERATION_ENABLED=true` 开启；状态端点只返回 `{available: boolean}`。
- [ ] 用任务 1 校验输出；公开错误码：INVALID_REQUEST、AI_UNAVAILABLE、RATE_LIMITED、QUOTA_EXCEEDED、TIMEOUT、UPSTREAM_ERROR、INVALID_RESPONSE。HTTP 对应 400/503/429/503/504/502/502；不把原始错误或正文返回浏览器。
- [ ] Node API 入口配置 60 秒执行上限；开发插件调用同一 handler，服务端加载 .env.local，不在 define 中传变量；独立 tsc 检查服务端，避免 Vite build 只编译前端造成漏检。
- [ ] 测试及客户端/服务端构建通过；提交 `feat: add protected DeepSeek answer endpoint`。

## 任务 5：生成客户端与防过期状态

**文件：** 创建 `src/llm/client.ts`、`src/llm/useAnswerGeneration.ts`、`src/llm/prepareRewriteRequest.ts`、对应测试；安装 jsdom、Testing Library 测试依赖。

**接口：** `getAIStatus(signal?: AbortSignal): Promise<{available: boolean}>`；`requestAnswerRewrite(request: RewriteRequest, signal?: AbortSignal): Promise<RewriteResponse>`；`prepareRewriteRequest(item: InterviewMaterialDraftItem, job: JobFile, chunks: MaterialChunk[], generationId: string): RewriteRequest`；`useAnswerGeneration()` 返回 generate(request)、cancel() 与按 questionId 存储的 idle/pending/success/error 状态。

- [ ] 写 `handles_html_429`、`rejects_wrong_generation_id`、`sends_only_selected_chunks`、`ignores_response_after_cancel`、`allows_one_inflight_request` 测试，断言失败保留原结果。
- [ ] 运行 `npm.cmd test -- --run src/llm/__tests__`，确认红灯。
- [ ] 同源 fetch，先按状态处理非 JSON 错误，验证合约与引用；request builder 不包含整份文件和整场对话，超限提示缩短而非静默截断。
- [ ] hook 使用 AbortController 与本地请求序号，取消/卸载/编辑失效后不得 commit 旧响应；用户主动重试使用新的 generationId。
- [ ] 测试全绿；提交 `feat: add race-safe grounded generation client`。

## 任务 6：我的资料页面

**文件：** 创建 `src/pages/MyMaterials.tsx`、`src/components/materials/MaterialEditor.tsx`、`src/materials/useMaterials.ts`、`src/pages/MyMaterials.test.tsx`；修改 `src/App.tsx`、`src/productUI.css`。

**接口：** `useMaterials(repository: MaterialRepository)` 返回 documents、chunks、loading、error、refresh、saveDocument。`MyMaterials` 接收 repository、onMaterialsChanged 与 onDeleteMaterial 回调；跨存储删除由任务 9 提供，不在此页直接删除来源。

- [ ] 写 `starts_empty_without_required_setup`、`requires_confirmation_before_save`、`keeps_editor_after_save_failure`、`labels_restored_draft`、`does_not_execute_imported_html`；没有删除协调器时删除按钮禁用，不能留下可点但无实现的入口。
- [ ] 运行 `npm.cmd test -- --run src/pages/MyMaterials.test.tsx`，确认红灯。
- [ ] 实现两类标签、搜索列表、详情编辑、文件/粘贴导入、可选经历字段、标签建议确认、草稿恢复；未保存编辑切换前询问，不自动替用户确认。
- [ ] App 增加导航；数据库加载失败可重试，不妨碍原面试页面。异步加载不会向 localStorage 写空资料覆盖历史。
- [ ] 测试通过并检查桌面/窄屏；提交 `feat: add personal materials workspace`。

## 任务 7：主流程接入引用与真实生成

**文件：** 创建 `src/components/materials/MaterialReferencePicker.tsx`、`src/components/AnswerEvidence.tsx`、`src/pages/FocusFlowPage.test.tsx`；修改 FocusFlowPage、`src/workflow/materialImportDraft.ts` 与对应测试、`src/agents/materialImportParser.ts`。

**接口：** ReferencePicker 接收 chunks、query、selectedChunkIds、onChange，初始空选；AnswerEvidence 接收 evidence、missingFacts；生成结果通过任务 5 转换成当前 DraftItem 的 improvedAnswer/evidence/generation/missingFacts，保存 workflow 原样写入答案。

- [ ] 写 `does_not_autoselect_references`、`requires_first_send_confirmation`、`generates_only_current_question`、`cannot_save_model_suggestion_before_acceptance`、`ignores_response_after_edit_or_navigation`、`failed_generation_keeps_accepted_answer` 测试。
- [ ] 运行 `npm.cmd test -- --run src/pages/FocusFlowPage.test.tsx src/workflow/__tests__/materialImportDraft.test.ts`，确认红灯。
- [ ] 改造当前布尔 answersGenerated 为按题结果状态，只对已生成或用户手写当前答案展示确认按钮。去掉本地 parser 预置答案作为真实生成结果的路径，保留本地问题识别/草稿建议。
- [ ] 增加折叠资料选择、发送预览、首次确认、加载/取消/重试；选中项变化或编辑使旧生成失效。允许无资料生成和模型不可用时手写答案。
- [ ] 保存仅处理用户确认的条目，未生成条目留在问题列表；真实回答与引用无损存储。
- [ ] 测试通过，虚构资料走完生成/采用/保存；提交 `feat: ground focused answers in selected materials`。

## 任务 8：岗位详情与回答版本统一

**文件：** 修改 `src/pages/JobFileDetail.tsx`、`src/components/AnswerAssetCard.tsx`、`src/pages/AssetsAndTraining.tsx`、`src/workflow/answerAssetVersions.ts`、`src/workflow/assetUsageFeedback.ts`；创建 JobFileDetail/AnswerAssetCard 组件测试，扩展现有 workflow 测试。

**接口：** 岗位详情使用任务 5 的生成 hook 与任务 7 的选择/证据组件；沿用 `saveAnswerAssetVersion(asset, draft, now)`、`restoreAnswerAssetVersion(asset, versionId, now)`，AnswerVersionDraft 新增可选 evidence、generation、missingFacts。

- [ ] 写 `job_generation_uses_same_endpoint`、`old_assets_without_evidence_still_render`、`manual_edit_marks_evidence_needs_review`、`restore_version_restores_its_evidence`、`feedback_edit_does_not_claim_new_model_output` 测试。
- [ ] 运行 `npm.cmd test -- --run src/workflow/__tests__/answerAssetVersions.test.ts src/workflow/__tests__/assetUsageFeedback.test.ts src/components/AnswerAssetCard.test.tsx src/pages/JobFileDetail.test.tsx`，确认红灯。
- [ ] 去除岗位生成路径的固定模板回退；所有新增实时优化使用统一接口。只读示例保持 sample 来源，不误标为本次模型生成。
- [ ] 保存上一版时同时保存其引用/元数据；恢复历史版本同样恢复证据，手写修改标记 needs-review。反馈派生新答案的模板不得被标为真实模型结果。
- [ ] 引用默认折叠，现有答案编辑、搜索与反馈功能保留；测试全绿；提交 `feat: preserve grounded answer evidence across versions`。

## 任务 9：可恢复删除、清空与备份

**文件：** 创建 `src/materials/workspaceDataCoordinator.ts`、`src/materials/backup.ts` 与对应测试；修改 App、MyMaterials、`src/workflow/personalWorkspace.ts`、`src/workflow/markdownExport.ts` 与测试。

**接口：** `deleteMaterial(id, repository, workspaceStore): Promise<void>`、`resumePendingDeletions(repository, workspaceStore): Promise<void>`、`clearAllUserData(repository, workspaceStore): Promise<void>`；workspaceStore 提供 read():PersonalWorkspaceData/write(data):Promise<void>，失败不能吞掉。`exportUserBackup(workspace, snapshot): UserBackup`、`validateUserBackup(value: unknown): UserBackup`、`restoreUserBackup(backup, repository, workspaceStore): Promise<void>`。

- [ ] 写 `purges_all_version_quotes_but_keeps_answer_body`、`resumes_after_workspace_write_failure`、`clears_both_stores_before_success`、`invalid_backup_preserves_current_data`、`roundtrips_all_optional_fields`、`restore_example_keeps_materials`、`clear_invalidates_generation` 测试。
- [ ] 运行 `npm.cmd test -- --run src/materials/__tests__ src/workflow/__tests__/markdownExport.test.ts src/workflow/__tests__/personalWorkspace.test.ts`，确认红灯。
- [ ] 持久化删除任务，按设计清除草稿和所有答案版本引用，再删来源；启动重试未完成清理。清空前取消生成；失败留在可重试状态，不报告已清空。
- [ ] 全量备份带 schemaVersion=1，只序列化用户内容；备份最大 20 MiB，验证已确认设计中的所有文档/片段长度和引用关系。恢复用事务与可恢复日志防止跨存储部分更新；配额失败保留原快照用于恢复，不静默丢失数据。
- [ ] 备份恢复和清空采用同源跨标签页互斥，BroadcastChannel 通知重载；其他标签页旧写入需版本检查，不覆盖恢复后的状态。引用被删除后 generationId 失效。
- [ ] Markdown 只导出已保存答案与对应引用；全部测试通过；提交 `feat: safely manage local materials and backups`。

## 任务 10：公开接口验收、联调与发布说明

**文件：** 创建 `docs/RELEASE_NOTES_MATERIALS_DEEPSEEK.md`、`docs/DEEPSEEK_SETUP.md`、`server/ai/__tests__/groundingEvaluation.test.ts`；修改 `docs/agents/agent-contracts.md`、`docs/DEPLOYMENT_VALIDATION_WORKFLOW.md`、`docs/PUBLIC_REPO_RISK.md`（存在时）与 README 对应功能段，不覆盖既有用户改动。

- [ ] 写虚构事实与注入材料的评测夹具：事实/建议分开、知识不能冒充成果、缺数值报告 missingFacts、资料中指令不能改变输出合约。提示词静态测试与真实模型评测分开，默认单元测试不联网也不计费。
- [ ] 运行全部测试与生产构建，确认客户端和服务端都被检查。检查客户端产物无 server 配置或密钥；文档明确其他 Agent 仍是本地规则，不声称全流程真实 AI。
- [ ] 用浏览器检查桌面与窄屏，资料导入/编辑/删除/备份、逐题生成/确认/保存/引用版本、取消和失败各走一次；保存必要验收截图，不使用真实经历。
- [ ] 先提交/推送 PR 与预览，保持生成关闭。由用户在 Vercel 界面填写 DEEPSEEK_API_KEY、DEEPSEEK_MODEL，不通过聊天、代码或日志传递；配置 WAF 规则并验证 429，不把前端按钮禁用当限流。
- [ ] 密钥及 WAF 配置完成后，用户确认以虚构材料进行真实计费联调，核验账号模型可用、schema、引用与额度错误。不得仅凭 fake fetch 测试声称接通真实模型。
- [ ] 启用生成后验收预览及紧急关闭开关；未经发布授权不合并正式站点。授权后按现有 SOP 核对生产 commit、Ready 和正式域名，再走一次真实闭环。
- [ ] 提交 `docs: document materials and DeepSeek release validation`；最终报告分开列本地实现、真实联调、部署完成情况与未解决风险。

## 执行前后检查

- [ ] 执行前记录 git status；当前 UI 清理与用户上下文文件保留，不回退、不混入文档提交。
- [ ] 使用现有隔离 worktree，不额外复制含个人资料的目录。实现任务每次只暂存其范围内文件。
- [ ] 每任务提交前运行相关测试与 `git diff --check`，记录实际输出，不依据预期宣布成功。
- [ ] 全部任务后进行独立代码审查，重点查看用户输入、匿名接口、引用可信度和跨存储恢复。
- [ ] 如模型配置/平台限流缺失，可完成其余实现，但明确报告真实联调与公开生成仍未验收，不标记上线完成。

## 执行方式

推荐同会话顺序执行：任务之间共享类型、生成状态与保存接口，先稳定接口再接 UI，减少并行造成的数据合约冲突。完成后安排独立审查。

可选逐任务子代理执行并独立审查：审查更细，但每任务上下文交接和接口同步成本更高。

用户确认计划与执行方式后开始实现。密钥配置与真实请求只在相关上线步骤进行，不作为编写本地功能的前置阻塞。
