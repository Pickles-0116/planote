# Spec · blog-import（add-blog-import-markdown）

> v1.1 第一炮：博客导入 Markdown 文件。

## ADDED Requirements

### Requirement: 博客列表必须含「导入 .md」入口

BlogList 页面 MUST 提供「导入 .md」入口，让用户能选择本地 Markdown 文件导入为博客。

#### Scenario: BlogList 显示「导入 .md」按钮
- GIVEN 用户访问 `/blogs` 页面
- WHEN 渲染 BlogList
- THEN 顶部 MUST 出现「导入 .md」按钮或下拉菜单项
- AND 点击 MUST 触发文件选择对话框（accept=".md,.markdown,.txt"）

#### Scenario: 选 .md 文件后自动创建博客
- GIVEN 用户点击「导入 .md」并选择了合法 .md 文件
- WHEN 文件被解析成功
- THEN MUST 自动创建一条 blog（title = 文件名或首个 H1，content = TiptapJSON）
- AND MUST 跳转到新 blog 的编辑页 `/blogs/:id/edit`

### Requirement: Markdown 解析覆盖基础语法

导入功能 MUST 支持基础 Markdown 语法解析到 TiptapJSON。

#### Scenario: 解析 H1-H3
- GIVEN Markdown 含 `# 标题` / `## 子标题` / `### 三级`
- WHEN 解析
- THEN 内容 MUST 渲染为 Tiptap heading 节点（level 1-3）

#### Scenario: 解析段落
- GIVEN Markdown 含普通段落文本
- WHEN 解析
- THEN MUST 渲染为 Tiptap paragraph 节点

#### Scenario: 解析列表
- GIVEN Markdown 含 `- item` 或 `1. item`
- WHEN 解析
- THEN MUST 渲染为 Tiptap bulletList / orderedList 节点

#### Scenario: 解析代码块
- GIVEN Markdown 含 3 个反引号包裹的代码块
- WHEN 解析
- THEN MUST 渲染为 Tiptap codeBlock 节点

#### Scenario: 解析行内代码 + 链接 + 粗斜体
- GIVEN Markdown 含 `inline code` / `[text](url)` / `**bold**` / `*italic*`
- WHEN 解析
- THEN MUST 渲染为对应 Tiptap mark / node

### Requirement: 非法输入必须安全失败

文件大小 / 格式 / 解析失败 MUST 安全处理，不创建空 blog。

#### Scenario: 文件 > 1MB 拒绝
- GIVEN 用户选择 > 1MB 的文件
- WHEN 触发导入
- THEN MUST 弹 toast 错误「文件超过 1MB」
- AND MUST NOT 创建 blog

#### Scenario: 非 .md 格式拒绝
- GIVEN 用户选择 .pdf / .docx 等非 Markdown 文件
- WHEN 触发导入
- THEN MUST 弹 toast 错误
- AND MUST NOT 创建 blog

#### Scenario: 解析异常安全失败
- GIVEN Markdown 内容触发 marked 解析异常
- WHEN 触发导入
- THEN MUST 弹 toast 错误
- AND MUST NOT 创建 blog

### Requirement: 验证三关全过

变更实施后 MUST 通过 build / lint / validate 三关。

#### Scenario: 验证
- WHEN 实施完成
- THEN `pnpm build` MUST exit 0 / 0 error
- AND `pnpm lint` MUST exit 0 / 0 warning
- AND `cmd /c openspec.cmd validate add-blog-import-markdown --strict` MUST valid
