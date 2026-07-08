# AI 面试成长 OS Agent 合约

当前 Demo 使用 deterministic mock agent，目的是保证本地稳定运行、便于 GitHub 展示、避免上传 API Key 或真实面试数据。真实上线版本会把下列模块替换为 LLM 调用，但保留相同的输入、输出和用户确认点。

## 1. importParser：外部对话解析

**输入**

```json
{
  "rawConversation": "面试官、候选人、追问、AI 点评组成的外部模拟面试文本"
}
```

**输出 JSON schema**

```json
{
  "questions": [
    {
      "id": "string",
      "question": "string",
      "answer": "string",
      "followUps": ["string"],
      "feedback": "string"
    }
  ]
}
```

**Prompt 目标**：从 ChatGPT / Codex 等外部对话中抽取面试问题、候选人回答、追问和点评，不改写事实。

**失败兜底**：如果角色标签缺失，保留原文并提示用户手动标注“面试官 / 候选人 / 点评”。

**用户确认点**：用户确认解析出的原问题和原回答是否准确，再进入复盘。

## 2. jdAnalyst：JD 画像分析

**输入**

```json
{
  "jdText": "岗位 JD 文本",
  "direction": "岗位方向"
}
```

**输出 JSON schema**

```json
{
  "responsibilities": ["string"],
  "abilityKeywords": ["string"],
  "hiddenRequirements": ["string"],
  "likelyQuestions": ["string"]
}
```

**Prompt 目标**：识别岗位职责、能力关键词、隐性要求和高概率面试问题。

**失败兜底**：JD 过短时只输出基础岗位拆解，并提示用户补充公司业务、岗位职责和面试轮次。

**用户确认点**：用户可编辑岗位画像，避免模型误读 JD。

## 3. reviewEvaluator：结构化复盘生成

**输入**

```json
{
  "jobFile": "JobFile",
  "interviewSession": "InterviewSession"
}
```

**输出 JSON schema**

```json
{
  "summary": "string",
  "scores": [
    {
      "dimension": "dataMetrics",
      "label": "string",
      "score": 1,
      "evidence": "string",
      "attribution": "string",
      "suggestion": "string"
    }
  ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "nextActions": ["string"]
}
```

**Prompt 目标**：优先解释“这段回答具体哪里不够、为什么不够、应该怎么改”，评分只是辅助标签。

**失败兜底**：如果回答内容不足，输出“信息不足”标签，并要求用户补充原回答或追问。

**用户确认点**：用户确认复盘归因是否符合自己的真实表达意图。

## 4. answerAssetGenerator：回答资产生成

**输入**

```json
{
  "jobFile": "JobFile",
  "interviewSession": "InterviewSession",
  "reviewReport": "ReviewReport"
}
```

**输出 JSON schema**

```json
{
  "id": "string",
  "questionType": "string",
  "originalQuestion": "string",
  "originalAnswer": "string",
  "issue": "string",
  "improvedAnswer": "string",
  "applicableRoles": ["string"],
  "applicableQuestions": ["string"],
  "weaknessTag": "string",
  "sourceJobId": "string",
  "sourceInterviewId": "string",
  "sourceReviewId": "string",
  "reuseScope": "同岗位多轮 / 同方向类似岗位",
  "usedInInterview": false,
  "usageNote": "string",
  "confidence": "high"
}
```

**Prompt 目标**：把复盘中的核心短板转成一条下次面试可直接使用的完整回答，同时保留来源问题、原回答、问题点和适用边界。

**失败兜底**：如果复盘短板不清晰，只生成“待用户补充”的草稿，不自动保存为高置信资产。

**用户确认点**：用户必须编辑或确认优化回答后，才能保存为回答资产；系统保留来源面试用于追溯。

## 5. growthPlanner：跨场次短板识别

**输入**

```json
{
  "reviewReports": ["ReviewReport"]
}
```

**输出 JSON schema**

```json
{
  "abilityAverages": {},
  "repeatedWeaknesses": [
    { "label": "string", "count": 1 }
  ],
  "recommendedFocus": ["dataMetrics"]
}
```

**Prompt 目标**：识别重复短板和资产复用情况。数据不足时不强行生成复杂能力图谱。

**失败兜底**：复盘数量少于 2 时只展示已沉淀短板和下一场练习建议。

**用户确认点**：用户可以合并同义短板，例如“指标体系不完整”和“效果评估不清晰”。
