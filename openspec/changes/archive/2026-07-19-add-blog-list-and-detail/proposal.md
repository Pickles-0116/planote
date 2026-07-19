# Proposal · 博客列表 + 博客详情

## Why

PRD v1.0 §6 明确博客有「列表浏览 + 详情查阅」两条主路径，但当前现状：

- `/blogs` 路由仍是 `PlaceholderPage`（仅显示「功能开发中」），用户没有任何入口能看到已有博客的全量矩阵
- `/blogs/:id` 详情页（`BlogDetail.tsx`）已落地「标题 + 元数据 + 只读 Tiptap 渲染」核心能力，但缺「字数 + 创建/更新时间 + 状态 badge + 标签 chips」等完整元信息
- `add-blog-tiptap-editor` 把「富文本编辑」做完了，**但写完的博客没有「可被找到 + 可被读」**的承载层
- `add-blog-attachment`（Round 10）让详情页能展示附件，但**详情页的整体能力（来源计划跳转 / 字数 / 状态 / 标签）还不完整**

用户在 Tiptap 编辑器写完博客后，没有任何"列表浏览 / 详情查阅"的入口，编辑/阅读闭环不成立。`add-plan-list-view` 已是成功参考（卡片网格 / 搜索 / 视图切换 / 智能排序），本 change 复用其模式落地博客侧。

## What Changes

### 1. /blogs 路由实现 BlogList（替换 PlaceholderPage）

- 路径：`src/pages/blogs/BlogList.tsx`（当前是 PlaceholderPage）
- 布局：标题栏 + 排序说明条 + 工具栏（搜索 + 视图切换器 + 排序下拉 + 框架筛选 + 标签筛选 + 状态切换 + 新建按钮）+ 内容区
- 标题栏：标题「博客」+ 副标题「共 N 篇博客」+ 右侧主操作按钮「写新博客」（跳转 `/blogs/new`，本 change 不实现新建页）

### 2. 视图切换器（BlogListToolbar 的一部分）

- 2 段切换：卡片网格 / 列表紧凑行
- 复用 `useUIStore`（新增 `blogListView: 'grid' | 'list'`，持久化到 localStorage）
- 切换不重渲染数据，hooks pipeline 在顶层完成

### 3. 排序：useFilteredBlogs hook

- 路径：`src/features/blog/hooks/useFilteredBlogs.ts`
- 内部用 useMemo 组合：search + framework + tag + status + sort
- sort 复用 `add-smart-sort` 的 sort-engine 模式，3 种 preset：
  - `created-desc`（最近创建，默认）
  - `updated-desc`（最近更新）
  - `title-asc`（标题字母升序）
- 暴露 `useFilteredBlogs(filters) → Blog[] | undefined`

### 4. 筛选 UI（BlogListFilters）

- 搜索框：实时过滤（按 title / excerpt / contentText / tagIds 任意匹配）
- 框架下拉：单选（4 个内置 + 「全部」）
- 标签多选：chip 列表（v1.0 简化为「选 tag 后过滤」，多选 OR）
- 状态切换：3 个 tab 互斥（全部 / 草稿 / 已发布 / 已归档）
- 「清除筛选」按钮：搜索 / 框架 / 标签一键清空

### 5. 博客卡片 BlogCard

- 路径：`src/features/blog/components/BlogCard.tsx`
- 视觉：复用 `PlanCard` 规范（rounded-2xl + shadow + hover 上浮）
- 内容：标题（line-clamp-2）+ 摘要（line-clamp-2）+ 状态 badge + 标签 chips + 框架名 + 更新时间 + 来源计划（可选）
- 点击进入 `/blogs/:id`
- 支持 2 个密度：grid 卡片（大图样式）/ list 行（紧凑横排）

### 6. BlogDetail 改造

- 路径：`src/pages/blogs/BlogDetail.tsx`（已是真实实现，扩展为完整版）
- 新增：字数统计、创建/更新时间、状态 badge、标签 chips、来源计划跳转、附件（Round 10 已落地，本 change 不动）
- 顶栏：返回 + breadcrumb + 「编辑」按钮 + 「删除」按钮（带 confirm）
- 「删除」按钮：复用现有 confirm 基建（v1.0 用 window.confirm）

### 7. uiStore 增量

- 新增 `blogListView: 'grid' | 'list'` 字段 + 持久化白名单
- 新增 `blogListSort: BlogSortKey` 字段 + 持久化白名单
- 新增 `blogListStatusFilter: BlogStatus | 'all'` 字段（可选 + 持久化）

## Scope

**In Scope**：

- 新建 `src/pages/blogs/BlogList.tsx`（列表 + 搜索 + 筛选 + 视图切换 + 排序）
- 改造 `src/pages/blogs/BlogDetail.tsx`（完整版，含来源计划 + 标签 + 状态 + 字数 + 创建/更新时间 + 删除）
- 新建 `src/features/blog/components/BlogCard.tsx`（列表卡片）
- 新建 `src/features/blog/components/BlogListFilters.tsx`（搜索 + 框架下拉 + 标签多选 + 状态切换）
- 新建 `src/features/blog/components/BlogListToolbar.tsx`（视图切换 + 排序 + 新建按钮）
- 新建 `src/features/blog/hooks/useFilteredBlogs.ts`（按筛选/搜索/排序组合）
- `useUIStore` 增量：`blogListView` / `blogListSort` / `blogListStatusFilter` + persist 集成
- spec 增量：新增 `blog-list-and-detail` capability，10-12 个 ADDED Requirements

**Out of Scope**（明确划清边界）：

- 博客分页（v1.0 全本地数据，< 1000 篇无需分页；后续接云端再加）
- 批量操作（多选 + 批量删除/打标）→ 下一轮 `add-blog-batch-ops`
- 拖拽排序 → v1.1
- 标签筛选 UI 在博客侧的扩展（v1.0 用现有 tagId 数组过滤即可）
- 全文检索（按 contentText）→ v1.1 `add-global-search`
- 博客「新建」页面（`/blogs/new` 流程由 `add-blog-generation-flow` 接手）
- 博客封面图（`Blog.coverImageId` 字段已就绪；v1.0 不渲染）
- Markdown 导出 / PDF 导出 → v1.1
- 单测（Sprint 1-2 不强制）

## Acceptance Criteria

- [ ] **AC-1**：列表页默认按创建时间倒序展示所有博客
- [ ] **AC-2**：搜索框输入即筛（按 title / excerpt / tagIds 匹配，不区分大小写）
- [ ] **AC-3**：框架下拉筛选（单选：全部 / 4 个内置）
- [ ] **AC-4**：标签多选筛选（chip 列表，多选 OR）
- [ ] **AC-5**：状态切换（全部 / 草稿 / 已发布 / 已归档）
- [ ] **AC-6**：排序切换（最近创建 / 最近更新 / 标题）
- [ ] **AC-7**：视图切换（卡片网格 / 列表紧凑行）
- [ ] **AC-8**：博客卡片点击进入详情页 `/blogs/:id`
- [ ] **AC-9**：详情页显示标题、元数据（字数 + 创建/更新时间 + 状态 + 标签 + 来源计划）、只读 RichEditor、附件
- [ ] **AC-10**：详情页「编辑」按钮跳到 `/blogs/:id/edit`
- [ ] **AC-11**：详情页「删除」按钮带 confirm 确认，删除后跳回 `/blogs`
- [ ] **AC-12**：空数据态友好（无博客时显示 EmptyState + 「写新博客」引导）
- [ ] **AC-13**：搜索无结果时显示 EmptyState + 「清除筛选」按钮
- [ ] **AC-14**：筛选/排序/视图 状态持久化（刷新后保留）
- [ ] **AC-15**：`pnpm build` 0 error / `pnpm lint` 0 warning
- [ ] **AC-16**：`openspec validate add-blog-list-and-detail --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| 列表页 useFilteredBlogs 多次 useMemo 嵌套性能问题 | 中 | hooks 顶层组合；useMemo 缓存按 filter / sort 变化精确触发；v1.0 数据量小（< 1000）实测 < 50ms |
| 标签筛选 UI 复杂度（多选 OR vs AND）| 低 | v1.0 显式 OR；按钮文案「包含任一标签」避免歧义 |
| BlogDetail 改造时回归（Round 10 的附件 + Round 9 的元数据）| 中 | 不破坏现有结构；增量添加「字数 + 时间 + 删除」3 块；附件不变 |
| 删除博客时未同步清附件 blob | 中 | `attachmentRepo` 不级联删附件；v1.0 简化为「删 blog 时保留孤儿附件」+ 状态栏提示（v1.1 加 cascade）|
| uiStore 持久化白名单与现有字段冲突 | 低 | 沿用 add-plan-list-view 模式；新增字段独立命名（blogListView / blogListSort）|
| BlogCard 视图切换不重渲染数据 | 低 | hooks pipeline 在 BlogList 顶层完成，切换只切渲染分支 |
| BlogList 搜索实时过滤高频重算 | 低 | useMemo 缓存；v1.1 可加 200ms debounce |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：`Blog` 模型 + `BlogRepo`（含 list / search / duplicate / archive / delete）
  - `add-zustand-stores`：`useBlogStore`（deleteBlog / updateBlog）+ `useBlogs` hook（live query）
  - `add-blog-tiptap-editor`：`<RichEditor readOnly>` 已可用
  - `add-framework-drawer`：4 个内置框架（`useFrameworks` 可读）
  - `add-blog-attachment`（Round 10）：详情页附件展示 + ImageLightbox + 附件删除
  - `add-smart-sort`（Round 7）：sort-engine 模式可复用
  - `add-plan-list-view`（参考）：BlogCard / BlogListFilters / BlogListToolbar 视觉规范参考
  - `add-app-shell`：EmptyState / LoadingOverlay / Skeleton 通用组件

- **下游（待启动）**：
  - `add-blog-generation-flow`：从计划生成博客（`/blogs/new` 流程）
  - `add-blog-batch-ops`：多选 + 批量打标/删除/归档
  - `add-blog-cover-image`：博客封面图（`Blog.coverImageId` UI 落地）
  - `add-global-search`（v1.1）：全文搜索（含 contentText 索引）

## Out of Scope Reminder

- 不实现博客分页
- 不实现批量操作
- 不实现拖拽排序
- 不实现标签 CRUD
- 不实现全文检索
- 不实现博客新建流程
- 不实现封面图 UI
- 不实现导出（Markdown / PDF）
- 不写单测
- 不引入新依赖（用现有 lucide-react / Tailwind / zustand / dexie）
- 不破坏 Round 9 框架抽屉、Round 10 附件、Round 7-8 状态机
- 不写 README（v1.0 项目级 README 留单独 change）
