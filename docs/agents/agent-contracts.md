# Agent contracts / LLM 替换方案

当前本地版本（v0.3）仍使用 deterministic mock agent，目标是让产品原型无需 API Key、无需真实用户数据即可稳定运行。真实上线版本应保持下列输入输出合约不变，把内部实现从规则函数替换为 LLM 调用。

## 总体原则

- **输入可追溯**：每个输出都能回到原 JD、原问题、原回答或原点评。
- **输出可编辑**：AI 产物默认是草稿，用户确认后才沉淀为资产。
- **失败可兜底**：解析失败、信息不足、低置信度时不伪装确定性。
- **边界可解释**：UI 中展示“为什么这样改”，README 中说明 mock 与 LLM 的区别。
- **隐私优先**：真实 LLM 版本默认脱敏，可让用户选择是否发送完整经历材料。

## 1. materialImportParser：整份面试材料解析

**当前 mock 实现**

- 文件：`src/agents/materialImportParser.ts`
- 方式：根据材料类型、角色标签和高频关键词，把 AI 模拟面试对话、真实面试回忆、复盘笔记或混合材料整理成可确认草稿。

**输入**

```ts
type MaterialImportParserInput = {
  rawText: string;
  sourceType:
    | 'auto'
    | 'mock_interview_dialogue'
    | 'real_interview_memory'
    | 'review_notes'
    | 'mixed_material';
  fallbackJob?: JobFile;
};
```

**输出 JSON schema**

```ts
type MaterialImportParserOutput = {
  draft: {
    sourceType: 'mock_interview_dialogue' | 'real_interview_memory' | 'review_notes' | 'mixed_material';
    jobContext: {
      company?: string;
      role?: string;
      direction?: string;
      jdText?: string;
    };
    interviewItems: Array<{
      id: string;
      title: string;
      question?: string;
      originalAnswer?: string;
      followUps?: string[];
      issue?: string;
      evidence?: string;
      improvementSuggestion?: string;
      improvedAnswer?: string;
      answerAssetCandidate: boolean;
      assetCandidateReason?: string;
      confidence: 'high' | 'medium' | 'low';
      rejectedReason?: string;
    }>;
    globalInsights: {
      summary?: string;
      strengths?: string[];
      weaknesses?: string[];
      nextPrepTopics?: string[];
    };
    missingInfoWarnings: string[];
  };
};
```

**LLM prompt 目标**

把一整份非标准面试材料拆成“可确认草稿”，而不是直接给最终结论。模型需要识别材料来源、岗位上下文、面试问题、候选人原回答、追问、点评、复盘短板和可沉淀回答资产候选。

**失败兜底**

- 无法识别问题时，生成低置信草稿，并要求用户手动拆分。
- 缺少原回答时，不自动生成高置信回答资产。
- 不确定适用范围时，只限制在当前岗位当前问题。
- 低置信条目默认不勾选保存为回答资产。

**用户确认点**

用户必须确认或编辑问题、原回答、具体问题和优化回答，再决定哪些条目保存为回答资产。

## 2. importParser：外部对话解析

**当前 mock 实现**

- 文件：`src/agents/importParser.ts`
- 方式：按常见“面试官 / 候选人 / AI 点评”文本结构解析。

**输入**

```ts
type ImportParserInput = {
  rawConversation: string;
  jobFileId: string;
};
```

**输出 JSON schema**

```ts
type ImportParserOutput = {
  session: {
    id: string;
    jobFileId: string;
    source: 'externalImport';
    interviewType: string;
    createdAt: string;
    rawConversation: string;
    questions: Array<{
      id: string;
      question: string;
      answer: string;
      followUps: string[];
      feedback: string;
    }>;
  };
};
```

**LLM prompt 目标**

从外部 AI 面试对话中识别面试官问题、候选人回答、追问、AI 点评和轮次信息。不要重写内容，只做结构化抽取。

**失败兜底**

- 如果角色标签缺失，保留原文并提示用户手动标注。
- 如果无法识别问题和回答，不进入复盘，只展示导入失败原因。

**用户确认点**

用户确认“原问题 / 原回答 / 点评”是否解析准确，再进入复盘。

## 3. jdAnalyst：JD 画像分析

**当前 mock 实现**

- 文件：`src/agents/jdAnalyst.ts`
- 方式：基于关键词提取职责、能力关键词、隐藏要求和可能问题。

**输入**

```ts
type JdAnalystInput = {
  jdText: string;
  roleDirection: string;
};
```

**输出 JSON schema**

```ts
type JdAnalystOutput = {
  profile: {
    responsibilities: string[];
    abilityKeywords: string[];
    hiddenRequirements: string[];
    likelyQuestions: string[];
  };
};
```

**LLM prompt 目标**

把 JD 转换为候选人面试准备视角：岗位要做什么、考察哪些能力、面试官可能追问什么、回答中需要补哪些业务或指标。

**失败兜底**

JD 过短时只输出基础岗位拆解，并提示用户补充公司业务、岗位职责、轮次和面试官背景。

**用户确认点**

用户可编辑岗位画像，避免模型误读 JD。

## 4. reviewEvaluator：结构化复盘生成

**当前 mock 实现**

- 文件：`src/agents/reviewEvaluator.ts`
- 方式：根据问题类型和回答内容生成复盘摘要、短板和下一步建议。

**输入**

```ts
type ReviewEvaluatorInput = {
  jobProfile: JdAnalystOutput['profile'];
  session: ImportParserOutput['session'];
};
```

**输出 JSON schema**

```ts
type ReviewEvaluatorOutput = {
  review: {
    id: string;
    jobFileId: string;
    sessionId: string;
    summary: string;
    scores: Array<{
      dimension: string;
      label: string;
      score: number;
      evidence: string;
      attribution: string;
      suggestion: string;
    }>;
    strengths: string[];
    weaknesses: string[];
    nextActions: string[];
  };
};
```

**LLM prompt 目标**

优先回答“这段回答具体哪里不好、为什么、怎么改”。评分只作为辅助标签，不作为主展示。

**失败兜底**

- 回答内容不足时输出“信息不足”，要求用户补充原回答或追问。
- 不确定归因时标记低置信度，不生成强结论。

**用户确认点**

用户确认复盘归因是否符合自己的真实表达意图。

## 5. answerAssetGenerator：回答资产生成

**当前 mock 实现**

- 文件：`src/agents/answerAssetGenerator.ts`
- 方式：结合复盘短板、原问题和岗位画像生成可编辑优化回答。

**输入**

```ts
type AnswerAssetGeneratorInput = {
  jobFileId: string;
  sessionId: string;
  reviewId: string;
  originalQuestion: string;
  originalAnswer: string;
  issue: string;
  jobProfile: JdAnalystOutput['profile'];
};
```

**输出 JSON schema**

```ts
type AnswerAssetGeneratorOutput = {
  asset: {
    id: string;
    questionType: string;
    originalQuestion: string;
    originalAnswer: string;
    issue: string;
    improvedAnswer: string;
    applicableRoles: string[];
    applicableQuestions: string[];
    weaknessTag: string;
    sourceJobId: string;
    sourceInterviewId: string;
    sourceReviewId: string;
    reuseScope: string;
    usedInInterview: boolean;
    linkedExperienceId?: string;
    usageNote: string;
    confidence: 'high' | 'medium' | 'low';
  };
  explanation: {
    issue: string;
    evidence: string;
    suggestion: string;
    risk: string;
  };
};
```

**LLM prompt 目标**

生成一段下次面试可直接使用的完整回答，同时保留原回答对比、改动依据、适用场景和使用建议。回答必须基于用户已有经历，不能编造项目结果。

**失败兜底**

- 短板不清晰时只生成低置信草稿。
- 缺少真实经历支撑时要求用户补充经历，不生成“看起来完整但不真实”的回答。
- 无法判断适用范围时限制为当前岗位当前问题，不扩展到跨岗位复用。

**用户确认点**

用户必须编辑或确认优化回答后，才能保存为回答资产。

## 6. growthPlanner：跨场次短板识别

**当前 mock 实现**

- 文件：`src/agents/growthPlanner.ts`
- 方式：聚合复盘和资产，识别重复短板、资产沉淀和训练建议。

**输入**

```ts
type GrowthPlannerInput = {
  reviews: ReviewEvaluatorOutput['review'][];
  assets: AnswerAssetGeneratorOutput['asset'][];
};
```

**输出 JSON schema**

```ts
type GrowthPlannerOutput = {
  repeatedWeaknesses: Array<{
    label: string;
    evidenceCount: number;
    relatedAssetIds: string[];
    nextPracticeQuestion: string;
  }>;
  reusableAssets: Array<{
    assetId: string;
    applicableRoles: string[];
    confidence: 'high' | 'medium' | 'low';
  }>;
  nextPractice: string[];
};
```

**LLM prompt 目标**

从多场复盘中识别重复出现的问题，给出下一场面试前最值得练的 1-2 个问题。不要在样本不足时强行生成能力趋势结论。

**失败兜底**

复盘数量少于 2 时只展示已沉淀短板和下一场练习建议。

**用户确认点**

用户可以合并同义短板，例如“指标体系不完整”和“效果评估不清晰”。

## LLM 替换顺序

1. 先替换 `materialImportParser`，因为真实材料格式最不稳定，也是当前主入口。
2. 再替换 `answerAssetGenerator`，因为它直接承载用户价值。
3. 再替换 `reviewEvaluator`，提升复盘解释质量。
4. 标准格式对话仍可继续使用 `importParser`，也可以在材料 parser 稳定后合并。
5. 最后替换 `jdAnalyst` 和 `growthPlanner`，作为长期能力增强。

## 生产化注意事项

- 所有 LLM 输出必须过 JSON schema 校验。
- 保存资产前必须有用户确认。
- 低置信输出不得自动进入资产库。
- 原始对话和个人经历应支持本地脱敏。
- 需要记录 prompt 版本、模型版本和生成时间，便于问题追溯。
