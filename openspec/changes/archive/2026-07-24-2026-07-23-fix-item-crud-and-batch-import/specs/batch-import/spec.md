# batch-import Specification

## Purpose
TBD

## ADDED Requirements
### Requirement: 批量 Markdown 导入入口 MUST 支持多选

`ImportMarkdownButton` 组件 MUST 接受多个 .md 文件选择。

#### Scenario: 多选文件
- GIVEN 用户点击「导入 .md」按钮
- WHEN 弹出文件选择器
- THEN MUST 接受多选（`multiple` 属性）
- AND `accept` MUST 为 `.md,.markdown,.txt`

### Requirement: 批量导入 MUST 串行处理并报告进度

`useMarkdownImport` hook MUST 暴露 `importFiles(files: File[]): Promise<ImportResult>` 方法,串行处理每个文件,实时 toast 报告进度。

#### Scenario: 串行处理 5 个 .md
- GIVEN 用户选了 5 个 .md 文件（每个 ≤ 5MB）
- WHEN 调 `importFiles([f1, f2, f3, f4, f5])`
- THEN MUST 按顺序处理 f1 → f2 → f3 → f4 → f5
- AND 全部完成后 MUST 弹汇总 toast「成功 5 篇」
- AND 列表页 MUST 出现 5 个新博客（draft 状态）

#### Scenario: 部分失败汇总
- GIVEN 用户选了 5 个文件, 其中 1 个超 5MB
- WHEN 调 `importFiles`
- THEN 4 个成功文件 MUST 正常创建 blog
- AND 1 个失败 MUST 不影响其他文件
- AND 完成后 MUST 弹「成功 4 篇 · 失败 1 篇」

### Requirement: 文件大小限制 MUST 提升到 5MB

`MAX_SIZE` 从 1MB 提升到 5MB,超过的文件 MUST 明确提示而非静默拒绝。

#### Scenario: 1-5MB 文件正常处理
- GIVEN 文件大小 ≤ 5MB
- WHEN 导入
- THEN MUST 正常解析 + 创建 blog

#### Scenario: 超 5MB 文件明确拒绝
- GIVEN 文件大小 > 5MB
- WHEN 批量导入
- THEN 该文件 MUST 标记为失败
- AND 错误信息 MUST 包含实际大小和 5MB 限制
- AND MUST 不影响其他文件

### Requirement: 批量导入后 MUST 不跳转编辑页

批量导入完成后 MUST 留在 `/blogs` 列表页,用户能看到所有新导入的卡片。

#### Scenario: 导入 3 个文件
- GIVEN 用户在 `/blogs` 选了 3 个 .md
- WHEN 批量导入完成
- THEN MUST 留在 `/blogs` 路由
- AND 列表 MUST 实时更新显示新博客

### Requirement: Markdown 解析工具 MUST 复用现有实现

`markdownToTiptap.ts` MUST 保持不变,批量入口直接复用。

#### Scenario: 单文件 / 批量共用解析器
- GIVEN 单文件入口和批量入口
- WHEN 解析 .md
- THEN MUST 走相同的 `markdownToTiptapJSON` 函数
