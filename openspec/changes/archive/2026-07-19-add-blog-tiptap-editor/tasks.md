# Tasks · 博客 Tiptap 富文本编辑器

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **时间预算**：~1.5 人天；每段工时按「单 task ≤ 25min」拆分。
> **完成日期**：2026-07-19 (Round 8)

---

## 1. 安装依赖

- [x] 1.1 `package.json` → 添加 5 个 Tiptap 依赖
  - `@tiptap/react` `^2.6.0`
  - `@tiptap/pm` `^2.6.0`
  - `@tiptap/starter-kit` `^2.6.0`
  - `@tiptap/extension-link` `^2.6.0`
  - `@tiptap/extension-placeholder` `^2.6.0`
- [x] 1.2 运行 `pnpm install`，确认无 peer 警告 / lockfile 更新

## 2. 类型与基础工具

- [x] 2.1 `src/types/editor.ts` → TiptapJSON 类型
  - `TiptapJSON` / `TiptapNode` / `TiptapInlineNode` / `TiptapMark` 类型
  - 集中导出供整个项目用
- [x] 2.2 `src/features/blog/utils/extractPlainText.ts` → doc → 纯文本
  - DFS 遍历所有 text 节点
  - 段落间 `\n` 分隔
- [x] 2.3 `src/features/blog/utils/countText.ts` → 字数 / 字符统计
  - 复用 extractPlainText
  - 字数 = trim 后按 `\s+` split 长度
  - 字符 = 总字符数
- [x] 2.4 `src/features/blog/utils/migrateBlogContent.ts` → 旧数据迁移
  - undefined / '' → 空 doc
  - '{' 开头 → JSON.parse，try/catch 失败回退
  - 其他 → 纯文本包装

## 3. 通用 hooks

- [x] 3.1 `src/shared/hooks/useDebouncedCallback.ts` → 通用 debounce
  - `useDebouncedCallback(fn, delay)`
  - ref 持有 fn 避免 deps 频繁变化
  - unmount clearTimeout
- [x] 3.2 `src/features/blog/hooks/useApplyFramework.ts` → 框架应用 hook
  - 接收 `editor` + `framework`
  - 幂等检查（扫 H2 比对 heading）
  - 应用：clearContent + 逐 section insertContent（H2 + paragraph with placeholder）
  - 返回 `{ apply, isApplied }`
- [x] 3.3 `src/features/blog/hooks/useAutoSave.ts` → 自动保存 hook
  - 接收 `editor` + `blogId` + `onSave(json, plain, excerpt)` + `delay = 500`
  - 监听 `editor.on('update')` + debounce
  - 返回 `{ status }`：`'idle' | 'saving' | 'saved'`
  - unmount clearTimeout + editor.off

## 4. 编辑器组件

- [x] 4.1 `src/features/blog/components/RichEditor.tsx` → 容器组件
  - props: `{ value, onChange?, readOnly?, placeholder?, onSaveStatusChange?, onEditorReady? }`
  - 内部 `useEditor({ extensions, content: migrateBlogContent(value), editable: !readOnly })`
  - 挂载 `EditorContent` + `EditorToolbar`（只读时 toolbar 传 readOnly）
  - unmount → `editor.destroy()`
  - deps 包含 value（外部路由切换/草稿恢复时重 init）
- [x] 4.2 `src/features/blog/components/EditorToolbar.tsx` → 工具栏
  - 11 按钮：B / I / H1 / H2 / H3 / bulletList / orderedList / blockquote / code / codeBlock / link
  - 每个按钮 `aria-label` + 激活态 `aria-pressed` + brand-900 背景
  - 「应用框架」按钮：disabled if !frameworkId；显对勾 if isApplied
  - Cmd/Ctrl+S 处理（preventDefault + 触发保存）
  - 接收 `editor` + `saveStatus` + `charCount` + `onApplyFramework` + `frameworkApplied` + `readOnly`
- [x] 4.3 `src/features/blog/components/CharacterCount.tsx` → 字数统计
  - props: `{ words, chars }`
  - 文案：`字数 ${words} · 字符 ${chars}`
  - 只读模式也显示
- [x] 4.4 `src/features/blog/components/SaveStatusBadge.tsx` → 保存状态
  - props: `{ status }`
  - 'idle' → 空白
  - 'saving' → 「保存中…」text-amber-600
  - 'saved' → 「已保存 · 刚刚」text-emerald-600

## 5. BlogEdit 改造

- [x] 5.1 `src/pages/blogs/BlogEdit.tsx` → 接入 RichEditor
  - 删除 `<textarea>` 区域
  - 引入 `<RichEditor>` + `useAutoSave` + `useApplyFramework`
  - 提交按钮逻辑：读 `editor.getJSON()` → `JSON.stringify` → `updateBlog({ content, contentText, excerpt })`
  - title / framework / tag / status 字段保持
- [x] 5.2 `src/pages/blogs/BlogEdit.tsx` → 框架联动
  - 当用户改 framework 字段，通知 `<RichEditor>` 知道新 framework
  - 工具栏「应用框架」按钮启用条件：`frameworkId` 非空

## 6. BlogDetail 改造

- [x] 6.1 `src/pages/blogs/BlogDetail.tsx` → 用 RichEditor 只读模式
  - 替换原有内容渲染（纯文本 or MarkdownRender）
  - `<RichEditor value={blog.content} readOnly onEditorReady={(ed) => /* 仅为暴露链接点击 */} />`
  - 工具栏 + 保存状态不显示
  - 链接可点（ProseMirror 默认）

## 7. 依赖类型与 store 验证

- [x] 7.1 `src/types/domain.ts` → `Blog.content` 字段注释更新
  - 注释由「Markdown / 纯文本」改为「TiptapJSON string (JSON.parse 可还原)」
- [x] 7.2 `src/stores/useBlogStore.ts` → 验证 `updateBlog` 接受新 content
  - 现有 `updateBlog` 不限制字段类型，应无需改动
  - 验证 content 写入 → reload 后可读

## 8. 验证

- [x] 8.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 8.2 `pnpm lint` 0 error / 0 warning
- [ ] 8.3 手动验证：打开 `/blogs/:id/edit`，编辑器渲染 + 工具栏 11 按钮可见
  > **agent 环境受限，留待人工验证**
- [ ] 8.4 手动验证：每个按钮 + 键盘命令生效
  > **agent 环境受限，留待人工验证**
- [ ] 8.5 手动验证：选 framework → 应用 → 看到 N 个 H2 + 空段 + placeholder
  > **agent 环境受限，留待人工验证**
- [ ] 8.6 手动验证：输入 → 500ms 后自动保存 → 状态变「已保存」+ 刷新数据在
  > **agent 环境受限，留待人工验证**
- [ ] 8.7 手动验证：字数实时更新
  > **agent 环境受限，留待人工验证**
- [ ] 8.8 手动验证：详情页只读模式（工具栏不显，链接可点）
  > **agent 环境受限，留待人工验证**
- [ ] 8.9 手动验证：刷新后博客内容保留
  > **agent 环境受限，留待人工验证**
- [ ] 8.10 手动验证：迁移旧数据（手工塞一条纯文本 Blog.content）→ 渲染为段落
  > **agent 环境受限，留待人工验证**
- [x] 8.11 `openspec validate add-blog-tiptap-editor --strict` 通过

## 9. 提交与归档

- [ ] 9.1 `git add .` + `git commit -m "feat(blog): integrate Tiptap rich editor with framework injection and auto-save"`
- [ ] 9.2 `openspec archive add-blog-tiptap-editor --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（工具栏可用）| 4.1 + 4.2 | 浏览器 |
| AC-2（B/I/H1/H2/list/quote/code/link）| 4.2 | 浏览器 |
| AC-3（框架应用）| 3.2 + 4.2 | 浏览器 |
| AC-4（自动保存）| 3.3 + 5.1 | 浏览器 |
| AC-5（字数统计）| 2.3 + 4.3 | 浏览器 |
| AC-6（详情页只读）| 4.1 + 6.1 | 浏览器 |
| AC-7（持久化）| 7.2 | 浏览器刷新 |
| AC-8（build + lint）| 8.1 + 8.2 | CLI |
| AC-9（validate）| 8.11 | CLI |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（依赖）| 0.1 | 5 个包 + install |
| 2（类型/工具）| 0.2 | 4 个工具函数 |
| 3（hooks）| 0.2 | 3 个 hook |
| 4（组件）| 0.4 | 4 个组件，EditorToolbar 11 按钮占大头 |
| 5（BlogEdit）| 0.2 | 替换 textarea + 接入 |
| 6（BlogDetail）| 0.1 | 只读替换 |
| 7（store/类型）| 0.1 | 注释 + 验证 |
| 8（验证）| 0.3 | 11 项 |
| 9（提交归档）| 0.1 | git + archive |
| **合计** | **1.7 人天** | 略超 1.5h；可压缩组件段到 0.3 |
