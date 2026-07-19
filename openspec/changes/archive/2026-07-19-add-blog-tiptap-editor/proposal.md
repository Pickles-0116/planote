# Proposal · 博客 Tiptap 富文本编辑器

## Why

Planote 的博客编辑（`/blogs/:id/edit`）目前是一段 `<textarea>`，用户写出来的「总结博客」只能以纯文本 + 换行呈现：

- 没有标题层级（永远只有一段），「项目复盘 / 21天习惯 / 读书笔记」这些框架的章节语义全丢；
- 没有加粗、列表、引用、代码块——技术笔记与读书笔记的核心呈现力缺失；
- 没有内链/外链——所有相关计划、博客只能粘贴 ULID 或标题；
- 没有"占位符"提示——用户面对一面白纸，常不知道每章该写什么。

这一轮把博客编辑器升级为 Tiptap v2 富文本 + 自研工具栏 + 框架章节结构注入，让"完成计划 → 一键生成总结博客"的体验真正可用。

## What Changes

### 1. Tiptap 集成

- 新增依赖：`@tiptap/react` / `@tiptap/pm` / `@tiptap/starter-kit` / `@tiptap/extension-link` / `@tiptap/extension-placeholder`
- 创建 `<RichEditor>` 容器组件（受控模式：value = TiptapJSON 字符串）
- 使用 ProseMirror schema，输出 `JSON`（**不**退 HTML，方便后续结构化检索与导出）
- 通过 `useEditor` hook 初始化，依赖数组稳定避免重渲

### 2. 自研工具栏

- `<EditorToolbar>` 组件，挂在编辑器顶部
- 支持：B / I / H1 / H2 / H3 / bullet list / ordered list / blockquote / code / code block / link
- 与 `PlanViewSwitcher` / `PlanSortDropdown` 同色系（stone-100 容器 + brand-900 激活态）
- a11y：每个按钮 `aria-label` + 激活态 `aria-pressed`
- 与 ProseMirror 命令联动（`editor.chain().focus().toggleBold().run()`）

### 3. 框架章节应用

- 当博客选了 framework（`frameworkId` 非空），编辑器加载时调用 `applyFramework(framework)`：
  - 每个 `FrameworkSection.heading` 转为 `H2` 节点
  - 紧随其后插入一个空 `paragraph`，`placeholder` 作为节点 `data-placeholder` 提示
  - 已存在的 `frameworkId` 不会被重复注入（幂等）
- 工具栏加「应用框架」按钮（v1.0 仅在未应用过时启用，应用后禁用并显示对勾）

### 4. 自动保存（500ms debounce）

- 监听 Tiptap `onUpdate`，将当前 JSON 写入 store action
- 500ms debounce（`useDebouncedCallback` 或自研 setTimeout）→ 减少 IndexedDB 写入
- 写入时同步刷新 `Blog.contentText`（纯文本，用于全文检索/摘要）
- 写入时同步刷新 `Blog.excerpt`（首段前 100 字符，无前段则取前 100 字符纯文本）
- 保存状态指示：右上角「已保存 · 刚刚」 / 「保存中…」

### 5. 字数统计

- 工具栏右下角实时显示「字数 N · 字符 M」
- 字数：去除空白后非空 token 数（与 Tiptap `editor.storage.characterCount` 对齐）
- 字符：含空白
- 切换到「只读模式」时统计仍可见

### 6. 只读模式

- `<RichEditor>` 接受 `readOnly?: boolean` prop
- 工具栏在只读模式下完全隐藏
- 链接仍可点击（ProseMirror 默认行为）
- 详情页（`/blogs/:id`）复用同一组件 + `readOnly`

### 7. 现有 BlogEdit 改造

- `src/pages/blogs/BlogEdit.tsx` 把 `<textarea>` 换成 `<RichEditor value={content} onChange={setContent} />`
- 现有 title / framework / tag / status 字段不动
- 提交逻辑（`updateBlog`）保持

## Scope

**In Scope**：

- 4 个新依赖安装（`@tiptap/react` / `@tiptap/pm` / `@tiptap/starter-kit` / `@tiptap/extension-link` / `@tiptap/extension-placeholder`）
- `<RichEditor>` 容器组件 + `<EditorToolbar>` 工具栏
- 框架应用 hook：`useApplyFramework(editor, framework)`
- 自动保存 hook：`useAutoSave(value, onSave, delay)`
- 字数统计组件：`<CharacterCount>`
- BlogEdit 改造：textarea → RichEditor
- 详情页（`/blogs/:id`）只读模式接入
- spec 增量：新增 `blog-editor` capability，8–10 个 ADDED Requirements，~25 个 Scenarios

**Out of Scope**（明确不做）：

- 附件上传（图片/文件拖入编辑器）— 下一轮 add-blog-attachments
- 协作编辑 / 评论 / 修订历史 — v2.0
- 导出 Markdown / PDF — v1.1（先 JSON 落地）
- 自定义工具栏按钮（用户自配）— v1.2
- 移动端手势 / iOS Safari 键盘适配 — v1.1（v1.0 桌面优先）
- 撤销/重做 UI 按钮（ProseMirror 内建 Ctrl+Z 即可，v1.0 不暴露）
- 标签输入 UI（用现有多选 select）— 后续 add-blog-tag-picker 接手

## Acceptance Criteria

- [ ] **AC-1**：打开 `/blogs/:id/edit`，编辑器渲染 Tiptap，工具栏所有按钮可用
- [ ] **AC-2**：B / I / H1 / H2 / list / quote / code / link 全部生效（键盘命令 + 按钮 + 输入测试均通过）
- [ ] **AC-3**：选了 framework 后，点「应用框架」，编辑器看到 N 个 H2 + N 个空段落（每段 placeholder = section.placeholder）
- [ ] **AC-4**：编辑后停手 500ms，自动写入 `Blog.content` + 刷新 `contentText` + `excerpt`；保存状态显示「已保存」
- [ ] **AC-5**：字数统计实时更新（输入即变），数字与 `editor.storage.characterCount` 一致
- [ ] **AC-6**：详情页 `/blogs/:id` 用同一 `<RichEditor readOnly>` 渲染，工具栏不显示，链接可点
- [ ] **AC-7**：刷新后博客内容保留（IndexedDB 持久化）
- [ ] **AC-8**：`pnpm build` 0 error / `pnpm lint` 0 warning
- [ ] **AC-9**：`openspec validate add-blog-tiptap-editor --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| Tiptap 依赖体积（pm + react + 4 ext ≈ 200KB gzip）| 中 | 接受；编辑器是博客页核心，不可避免 |
| `onUpdate` 高频触发 → 性能问题 | 中 | 500ms debounce + 仅写 content 字段，不重渲整页 |
| 框架重复应用污染内容 | 低 | apply 入口检查 `frameworkId` 是否已注入（按 H2 文本比对），未匹配才注入 |
| 旧 textarea 用户的纯文本内容迁移 | 中 | 旧 Blog.content 是字符串，新版存 TiptapJSON；migration helper 把字符串包成 `{type:'doc', content:[{type:'paragraph', content:[{type:'text', text:s}]}]}` |
| 详情页只读模式性能 | 低 | 1000+ 字 ProseMirror 仍 < 50ms 渲染，可接受 |
| Tiptap 与 React 18 strict mode 双调用 | 中 | useEditor 已是幂等；v1.0 接受 dev 模式 warning |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：`Blog` 模型 + `content` / `contentText` / `excerpt` 字段
  - `add-zustand-stores`：`useBlogStore` + `updateBlog` action
  - `add-app-shell`：`/blogs/:id/edit` 路由
  - `add-blog-edit-form`：现有 BlogEdit 表单 + 提交逻辑

- **下游（待启动）**：
  - `add-blog-list`：详情页跳转目标（编辑器嵌入只读模式）
  - `add-blog-attachments`：图片拖入编辑器（v1.1 后续）
  - `add-blog-markdown-export`：TiptapJSON → MD 导出

## Out of Scope Reminder

- 不做附件/图片上传
- 不做协作/评论
- 不做 Markdown 导出
- 不做移动端适配优化
- 不写单测
- 不破坏现有 BlogEdit 的 title / framework / tag / status 字段
