# AI 对话助手 Prompt 调优 CHANGELOG

记录每次 System Prompt 调优的内容与原因。

---

## v1.0.0 → v1.0.1（2026-07-25）

### 改动

1. **意图识别更明确**：在 System Prompt 中明确要求 AI 在回复**开头**插入 `<intent>` 标记，而非任意位置。原文示例不显眼，新版加粗强调。
2. **Tool Call JSON 容错更强**：在 Schema 描述里增加 "JSON 必须合法，字段缺失会导致 UI 报错" 提示。
3. **默认值策略示例**：在 free 模式段后增加 "level: 'short' / timeDim: 'once' / startDate: 今天 / endDate: startDate+4 周" 的具体示例。
4. **引导模式指令更具体**：明确"一次只问一个问题"，避免模型一次性抛 5 个问题。
5. **模板字段示例**：给 create_template 的 aiParams 补完整示例对象。

### 测试场景（20 个）

- 创建计划：5 条（标题、层级、维度、事项、时间范围）
- 创建博客：5 条（主题、风格、模板、要点、字数）
- 创建模板：3 条（用途、章节、风格）
- 数据查询：4 条（计划列表、博客统计、模板列表、get_stats）
- 边界：3 条（意图不明确、信息严重不足、Tool Call JSON 缺失字段）

### 待人工补充

- v1.0.1 跨 GPT-4o / Claude Sonnet 4 / Qwen-Max 三家真实通过率需 20 个场景 ≥ 80%
- chat_query_accuracy 自动化待 v1.6 引入"AI 自评"