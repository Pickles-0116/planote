# Tasks · add-blog-import-markdown

> v1.1 第一炮。每条任务可独立 commit。

## 1. 安装依赖

- [ ] 1.1 `pnpm add marked @tiptap/html`
- [ ] 1.2 验证 lockfile 更新 + 跑 `pnpm install` 无 error

## 2. 工具函数：markdownToTiptap.ts

- [ ] 2.1 新建 `src/features/blog/utils/markdownToTiptap.ts`
- [ ] 2.2 `markdownToTiptapJSON(md: string): TiptapJSON` — marked.parse → generateJSON
- [ ] 2.3 `extractTitle(md, filename): string` — 优先 H1，回退文件名去扩展名
- [ ] 2.4 导出 Tiptap extensions 常量（StarterKit + Link.configure）

## 3. Hook：useMarkdownImport

- [ ] 3.1 新建 `src/features/blog/hooks/useMarkdownImport.ts`
- [ ] 3.2 校验文件大小 ≤ 1MB
- [ ] 3.3 校验扩展名 .md / .markdown / .txt
- [ ] 3.4 FileReader → markdownToTiptapJSON → createBlog → navigate
- [ ] 3.5 try/catch 失败 → pushToast 错误 + 不创建
- [ ] 3.6 title 优先 H1，回退文件名

## 4. UI 组件

- [ ] 4.1 新建 `src/features/blog/components/ImportMarkdownButton.tsx`
- [ ] 4.2 隐藏 `<input type="file" accept=".md,.markdown,.txt">`
- [ ] 4.3 「导入 .md」按钮触发 input click
- [ ] 4.4 onChange → 调 useMarkdownImport
- [ ] 4.5 新建 `src/features/blog/components/NewBlogMenu.tsx`（统一「新建」入口）
- [ ] 4.6 NewBlogMenu 下拉：空白博客 / 导入 .md / 应用框架（v1.0 已有入口迁移）

## 5. BlogList 集成

- [ ] 5.1 改 `src/pages/blogs/BlogList.tsx`：用 NewBlogMenu 替换「新建博客」按钮
- [ ] 5.2 ImportMarkdownButton 嵌入 NewBlogMenu

## 6. 验证

- [ ] 6.1 `pnpm build` 0 error
- [ ] 6.2 `pnpm lint` 0 warning
- [ ] 6.3 `cmd /c openspec.cmd validate add-blog-import-markdown --strict` valid
- [ ] 6.4 浏览器手验：选含 H1+列表+代码块+链接 的 .md → 创建 + 跳转 + 内容完整
- [ ] 6.5 浏览器手验：选 > 1MB 文件 → toast 错误 + 不创建
- [ ] 6.6 浏览器手验：选 .pdf → toast 错误 + 不创建

## 7. 归档

- [ ] 7.1 `cmd /c openspec.cmd archive add-blog-import-markdown --yes`
- [ ] 7.2 确认 `openspec validate --specs --strict` 18/18 通过（17 旧 + 1 新）

## 时间预算

| 段 | 工时 |
|----|------|
| 1（依赖）| 0.1 |
| 2（utils）| 0.2 |
| 3（hook）| 0.3 |
| 4（UI）| 0.3 |
| 5（集成）| 0.1 |
| 6（验证）| 0.2 |
| 7（归档）| 0.05 |
| **合计** | **1.25 人天** | 预计 1.5 天内完成 |
