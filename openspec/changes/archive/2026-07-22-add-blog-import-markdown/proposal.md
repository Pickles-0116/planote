# Change · add-blog-import-markdown

> v1.1 第一炮：博客导入 Markdown 文件。一键把外部笔记（Notion / 语雀 / 公众号 / Obsidian 等导出的 .md）转成 Planote 博客。

## Why

v1.0 收官后用户调研：用户积累了大量外部 Markdown 笔记，希望快速搬入 Planote 而不是手动复制粘贴。当前入口：
- 「设置 → 数据 → 导入」只支持**整库 JSON 导入**，不能单篇
- 「博客编辑页」无任何导入入口
- 结果：用户从外部平台导出的 .md 文件**完全无法进入** Planote

## What

实现「博客导入 Markdown」功能：

| # | 改动 | 类型 |
|---|------|------|
| 1 | 安装 `marked` + `@tiptap/html` 依赖 | 依赖 |
| 2 | 新建 `src/features/blog/utils/markdownToTiptap.ts`：Markdown → TiptapJSON 转换器 | 新增 |
| 3 | 新建 `src/features/blog/hooks/useMarkdownImport.ts`：弹文件选择 + 解析 + 创建 blog | 新增 |
| 4 | BlogList 页「新建博客」按钮旁加「导入 .md」按钮 | 新增 |
| 5 | 工具栏菜单（含 Markdown / 空白博客 / 框架三种新建入口） | 优化 |

## Scope

### 改动文件（5 新 + 2 改）
- 新建 `src/features/blog/utils/markdownToTiptap.ts`
- 新建 `src/features/blog/hooks/useMarkdownImport.ts`
- 新建 `src/features/blog/components/ImportMarkdownButton.tsx`
- 新建 `src/features/blog/components/NewBlogMenu.tsx`（统一「新建」入口）
- 改 `src/pages/blogs/BlogList.tsx`（用 NewBlogMenu 替换「新建博客」按钮）
- 改 `src/pages/blogs/BlogListToolbar.tsx`（如有 toolbar）
- 改 `package.json`（加 marked + @tiptap/html 依赖）

### 验证
- `pnpm build` 0 error
- `pnpm lint` 0 warning
- `openspec validate add-blog-import-markdown --strict` valid
- 浏览器手验：选 .md 文件 → 解析 → 创建 blog → 跳到编辑页

## AC

- AC-1：BlogList 顶部 MUST 有「导入 .md」入口（按钮或下拉菜单）
- AC-2：点击「导入 .md」→ 弹文件选择对话框（accept=".md,.markdown,.txt"）
- AC-3：选 .md 文件后 MUST 自动解析 + 创建 blog（title = 文件名，content = TiptapJSON）
- AC-4：解析完成后 MUST 跳转到新 blog 的编辑页 `/blogs/:id/edit`
- AC-5：支持基础 Markdown 语法：H1-H3、段落、列表（无序+有序）、代码块、行内代码、链接、粗体、斜体、引用
- AC-6：导入失败的 .md 文件 MUST 弹 toast 错误且不创建空 blog
- AC-7：build / lint / validate 三关全过

## Out-of-Scope

- 批量导入多个 .md（v1.2）
- Front-matter 解析（YAML 标题/标签提取）（v1.2）
- Notion / 语雀 专用解析器（v1.2）
- 拖拽上传（v1.2）
- 导入历史记录（v1.2）
- 导入 PDF / DOCX（v1.2）

## Risks

- 中等：marked 解析边缘 case 需测试
- 缓解：基础语法覆盖 + 失败兜底（toast + 不创建）
- 风险评估：~25 tasks 工时可控
