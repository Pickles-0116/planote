# blog-editor Specification

## Purpose
TBD - created by archiving change add-blog-tiptap-editor. Update Purpose after archive.
## Requirements
### Requirement: TiptapJSON 内容格式

系统 MUST 把博客内容存储为 Tiptap JSON（`Blog.content: string`），而非 HTML / 纯文本 / 二进制。

#### Scenario: 正常 doc

- **GIVEN** 用户用 B / I / H1 / list 等工具编辑内容
- **WHEN** 触发自动保存
- **THEN** `Blog.content` 为合法 TiptapJSON 字符串
- **AND** 结构可被 `JSON.parse` 还原为 `{ type: 'doc', content: [...] }`

#### Scenario: 段落节点

- **GIVEN** 用户输入"今天读了《代码大全》"
- **WHEN** 自动保存
- **THEN** doc 含 `{ type: 'paragraph', content: [{ type: 'text', text: '今天读了《代码大全》' }] }`

#### Scenario: 标题节点

- **GIVEN** 用户选中文字应用 H1
- **WHEN** 自动保存
- **THEN** doc 含 `{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '...' }] }`

#### Scenario: 链接 mark

- **GIVEN** 用户选中文字应用链接 "https://example.com"
- **WHEN** 自动保存
- **THEN** 文本节点带 `marks: [{ type: 'link', attrs: { href: 'https://example.com' } }]`

### Requirement: 工具栏 11 个按钮

系统 MUST 在编辑器顶部提供 11 个格式按钮：B / I / H1 / H2 / H3 / bullet list / ordered list / blockquote / inline code / code block / link。

#### Scenario: 切换激活态

- **GIVEN** 用户光标在加粗文字上
- **WHEN** 渲染工具栏
- **THEN** B 按钮显激活态（`aria-pressed="true"` + brand-900 背景）
- **AND** 其他按钮显未激活态

#### Scenario: 命令触发

- **GIVEN** 用户选中文字
- **WHEN** 点 B 按钮
- **THEN** 文字应用加粗
- **AND** 撤销/重做栈同步

#### Scenario: 链接按钮

- **GIVEN** 用户选中文字
- **WHEN** 点链接按钮
- **THEN** 弹出 prompt 输入 URL
- **AND** 取消则不应用
- **AND** 确认则应用 link mark

### Requirement: 框架应用

系统 MUST 让用户手动触发「应用框架」操作，将 `FrameworkSection` 列表转换为 H2 + 空段。

#### Scenario: 按钮启用条件

- **GIVEN** `blog.frameworkId` 为空
- **WHEN** 渲染工具栏
- **THEN** 「应用框架」按钮 disabled
- **AND** tooltip 提示「请先选择框架」

#### Scenario: 首次应用

- **GIVEN** `blog.frameworkId = 'fw-21day-habit'`，sections = [{ heading: '今日打卡', placeholder: '完成了什么？' }, ...]
- **WHEN** 点「应用框架」
- **THEN** 编辑器清空
- **AND** 注入 N 个 H2 节点（文本 = section.heading）
- **AND** 每个 H2 后接一个空 paragraph，placeholder = section.placeholder
- **AND** 光标停在第一段开头

#### Scenario: 幂等

- **GIVEN** 已应用 fw-21day-habit
- **WHEN** 再点「应用框架」（同 framework）
- **THEN** 内容不动
- **AND** 按钮显对勾 + tooltip 提示「已应用」

#### Scenario: 切换 framework

- **GIVEN** 已应用 fw-A，切到 fw-B
- **WHEN** 点「应用框架」
- **THEN** 编辑器清空 + 注入 fw-B 的 sections
- **AND** 旧 fw-A 的内容不残留

### Requirement: 自动保存（500ms debounce）

系统 MUST 在用户停止输入 500ms 后自动写入 `Blog.content` / `contentText` / `excerpt`，并显示保存状态。

#### Scenario: 正常自动保存

- **GIVEN** 用户输入一段文字
- **WHEN** 停手 500ms
- **THEN** `useBlogStore.updateBlog` 被调用
- **AND** `contentText` 同步为纯文本
- **AND** `excerpt` = 首段前 100 字符
- **AND** 工具栏状态变「已保存 · 刚刚」

#### Scenario: 防抖

- **GIVEN** 用户连续输入 3 秒
- **WHEN** 仍在输入
- **THEN** 不触发保存
- **AND** 状态显「保存中…」

#### Scenario: 卸载清理

- **GIVEN** 500ms 内用户切到其他页面
- **WHEN** BlogEdit 卸载
- **THEN** clearTimeout 防写入脏数据
- **AND** 内存中 editor 被 destroy

#### Scenario: 手动保存（Cmd+S / Ctrl+S）

- **GIVEN** 用户在编辑器内
- **WHEN** 按 Cmd+S（mac）/ Ctrl+S（win/linux）
- **THEN** 立即触发保存（不等 500ms）
- **AND** 浏览器默认"另存为"被阻止

### Requirement: 字数统计

系统 MUST 在工具栏右下角实时显示「字数 N · 字符 M」。

#### Scenario: 实时更新

- **GIVEN** 用户输入字符
- **WHEN** 渲染工具栏
- **THEN** 字数 = doc 中所有 text 节点的字符数（去除空白后按空格分词）
- **AND** 字符 = 所有 text 节点字符总数（含空白）
- **AND** 数字与 `editor.getJSON()` 自计数一致

#### Scenario: 空文档

- **GIVEN** 文档为空
- **WHEN** 渲染工具栏
- **THEN** 显「字数 0 · 字符 0」

#### Scenario: 只读模式仍显示

- **GIVEN** 详情页只读模式
- **WHEN** 渲染工具栏
- **THEN** 字数仍显示
- **AND** 工具栏其他按钮隐藏

### Requirement: 只读模式

系统 MUST 让 `<RichEditor>` 在 `readOnly=true` 时禁止编辑，但渲染内容、字数、链接点击。

#### Scenario: 编辑页可用

- **GIVEN** `/blogs/:id/edit` 路由
- **WHEN** 渲染 `<RichEditor>`
- **THEN** `editable: true`
- **AND** 工具栏 + 字数 + 保存状态都显示

#### Scenario: 详情页只读

- **GIVEN** `/blogs/:id` 路由
- **WHEN** 渲染 `<RichEditor readOnly>`
- **THEN** `editable: false`
- **AND** 工具栏 + 保存状态不显示
- **AND** 字数显示

#### Scenario: 链接点击

- **GIVEN** 只读模式 + 文档含 link mark
- **WHEN** 用户点击链接
- **THEN** 浏览器新窗口打开链接
- **AND** ProseMirror 不进入编辑态

### Requirement: 旧数据迁移

系统 MUST 把旧版 `Blog.content`（纯文本字符串）迁移为合法 TiptapJSON。

#### Scenario: 旧字符串迁移

- **GIVEN** `Blog.content = "今天读了《代码大全》\n第三章讲的是命名"`
- **WHEN** 渲染编辑器
- **THEN** 显示为两段 paragraph，每段对应一行
- **AND** 自动保存后 `Blog.content` 升级为 TiptapJSON

#### Scenario: 损坏 JSON 兜底

- **GIVEN** `Blog.content = '{invalid json'`
- **WHEN** 渲染编辑器
- **THEN** 走纯文本逻辑，整串作为单个 paragraph 显示

#### Scenario: 空值兜底

- **GIVEN** `Blog.content = undefined` 或 `''`
- **WHEN** 渲染编辑器
- **THEN** 渲染空 doc（`{ type: 'doc', content: [{ type: 'paragraph' }] }`）
- **AND** 显 placeholder「开始写你的博客...」

### Requirement: 编辑器生命周期

系统 MUST 正确管理 ProseMirror editor 实例的创建与销毁。

#### Scenario: 挂载创建

- **GIVEN** BlogEdit 挂载
- **WHEN** `<RichEditor>` 首次渲染
- **THEN** `useEditor` 返回非 null 实例
- **AND** ProseMirror DOM 挂到 `<EditorContent>` 容器

#### Scenario: 卸载销毁

- **GIVEN** 用户离开 BlogEdit
- **WHEN** 组件卸载
- **THEN** `editor.destroy()` 被调用
- **AND** ProseMirror view 从 DOM 移除
- **AND** 无内存泄漏（不持有 DOM 引用）

#### Scenario: value 变化重 init

- **GIVEN** 父组件传入新的 `value`（罕见，仅外部路由切换/恢复草稿时）
- **WHEN** `useEditor` 检测 deps 变化
- **THEN** 重新创建 editor，载入新 content
- **AND** 旧 editor 销毁

### Requirement: BlogEdit 集成

系统 MUST 把现有 BlogEdit 的 `<textarea>` 替换为 `<RichEditor>`，保留其他字段（title / framework / tag / status）。

#### Scenario: textarea 替换

- **GIVEN** BlogEdit 改造前用 textarea
- **WHEN** 改造完成
- **THEN** 编辑区为 `<RichEditor>`
- **AND** 提交按钮逻辑保持（提交时读 `editor.getJSON()` → JSON.stringify → updateBlog）

#### Scenario: 其他字段不变

- **GIVEN** BlogEdit 现有 title / framework / tag / status 字段
- **WHEN** 改造后
- **THEN** 字段 UI 保持
- **AND** 提交逻辑兼容（content 是结构化 JSON，其余字段不变）

#### Scenario: BlogDetail 集成

- **GIVEN** BlogDetail 改造前用纯文本渲染
- **WHEN** 改造完成
- **THEN** 用 `<RichEditor readOnly>` 渲染内容
- **AND** 旧 MarkdownRender 组件暂保留（外部 .md 导入用）

---

