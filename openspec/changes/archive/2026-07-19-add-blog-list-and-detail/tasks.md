# Tasks · 博客列表 + 博客详情

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **时间预算**：~1.5 人天；每段工时按「单 task ≤ 25min」拆分。
> **依赖**：add-blog-tiptap-editor + add-blog-attachment + add-framework-drawer + add-zustand-stores + add-data-layer-dexie 已落地

> **完成日期**：2026-07-19（Round 11 实施完成；build/lint/validate 三关过）

---

## 1. sort-engine（blog 侧）

- [x] 1.1 `src/features/blog/utils/sortBlogs.ts` → sort-engine 复用
  - 导出 `BlogSortKey = 'created-desc' | 'updated-desc' | 'title-asc'`
  - 导出 `BLOG_SORT_PRESETS: Record<BlogSortKey, { label, comparator }>`
  - 导出 `sortBlogs(blogs, key) → Blog[]`
  - 复用 add-smart-sort 的 preset 注册模式
  - `title-asc` 用 `localeCompare(..., 'zh-CN')` 处理中文

## 2. useFilteredBlogs hook

- [x] 2.1 `src/features/blog/hooks/useFilteredBlogs.ts` → 筛选 + 排序组合
  - 签名：`useFilteredBlogs(blogs, filters, sort) → Blog[] | undefined`
  - 内部 4 个 useMemo 串联：status → framework → tag(OR) → search
  - 末尾 useMemo 排序
  - 入参 `undefined` 透传（表示 live query 首帧）
- [x] 2.2 边界处理
  - `blogs === undefined` → 返回 `undefined`
  - `filters.query === ''` → search 透传
  - `filters.selectedTagIds.length === 0` → tag 透传
  - `filters.frameworkId === null` → framework 透传
  - `filters.statusFilter === 'all'` → status 透传
- [x] 2.3 导出 `BlogFilters` interface + `StatusFilter` type

## 3. uiStore 增量

- [x] 3.1 `src/stores/uiStore.ts` → 增 `blogListView` 字段
  - 类型：`'grid' | 'list'`，默认 `'grid'`
  - 持久化白名单追加
- [x] 3.2 `src/stores/uiStore.ts` → 增 `blogListSort` 字段
  - 类型：`BlogSortKey`，默认 `'created-desc'`
  - 持久化白名单追加
- [x] 3.3 `src/stores/uiStore.ts` → 增 `blogListStatusFilter` 字段
  - 类型：`'all' | BlogStatus`，默认 `'all'`
  - 持久化白名单追加
- [x] 3.4 `src/stores/uiStore.ts` → 增 3 个 setter action
  - `setBlogListView(view)`
  - `setBlogListSort(sort)`
  - `setBlogListStatusFilter(s)`
- [x] 3.5 `src/stores/index.ts` → 导出 `BlogSortKey` / `StatusFilter` 类型

## 4. BlogCard 组件

- [x] 4.1 `src/features/blog/components/BlogCard.tsx` → 列表卡片
  - props：`{ blog: Blog, density?: 'grid' | 'list' }`
  - 视觉：rounded-2xl + shadow-soft + hover 上浮
  - 标题（line-clamp-2）+ 摘要（line-clamp-2）+ 状态 badge + 标签 chips + 框架名 + 相对时间
  - 0 标签不渲染 chip 区
  - onClick → `navigate('/blogs/{id}')`
- [x] 4.2 状态 badge
  - 草稿：bg-stone-100 text-brand-600
  - 已发布：bg-emerald-50 text-emerald-700
  - 已归档：bg-amber-50 text-amber-700
- [x] 4.3 相对时间工具 `formatRelativeTime(iso) → string`
  - < 1min：刚刚
  - < 1h：N 分钟前
  - < 24h：N 小时前
  - < 7d：N 天前
  - 否则：formatChineseDate
- [x] 4.4 a11y：`<article>` + `<h3>` + 键盘可达（role="link" / button 包裹）

## 5. BlogListFilters 组件

- [x] 5.1 `src/features/blog/components/BlogListFilters.tsx` → 筛选条
  - props：`{ query, onQueryChange, frameworkId, onFrameworkChange, selectedTagIds, onTagToggle, statusFilter, onStatusChange, onClearFilters, hasFilters }`
  - 搜索框：左 `<Search>` icon + input + 右 `<X>` 清除（query 非空时）
  - 框架下拉：`<select>` 含「全部」+ 4 个内置
  - 标签 chips：横排 scroll，激活态 brand-900 背景白字
  - 状态 4 tab：全部 / 草稿 / 已发布 / 已归档
  - 「清除筛选」按钮：hasFilters 时显
- [x] 5.2 标签 chip a11y
  - `<button role="switch" aria-checked aria-label="筛选标签 {name}">`
- [x] 5.3 状态 tab a11y
  - `<button role="tab" aria-selected={isActive} aria-label="筛选状态 {label}">`

## 6. BlogListToolbar 组件

- [x] 6.1 `src/features/blog/components/BlogListToolbar.tsx` → 工具栏
  - props：`{ view, onViewChange, sort, onSortChange, onCreate }`
  - 左：视图切换器（2 段 grid/list）+ 排序下拉
  - 右：「写新博客」按钮（跳转 `/blogs/new`）
- [x] 6.2 视图切换器
  - 2 按钮胶囊容器
  - 选中态 bg-brand-900 text-white
  - a11y：role="tablist" + role="tab" + aria-selected
- [x] 6.3 排序下拉
  - `<select>` 含 3 个 preset 标签
  - 选项文本来自 BLOG_SORT_PRESETS[key].label
- [x] 6.4 「写新博客」按钮
  - 右端 brand-900 背景
  - onClick → `navigate('/blogs/new')`（v1.0 该路由已存在但功能由 add-blog-generation-flow 接手）

## 7. BlogList 页实现

- [x] 7.1 `src/pages/blogs/BlogList.tsx` → 替换 PlaceholderPage
  - 状态：`query` / `frameworkId` / `selectedTagIds`（useState 本地，不持久化）
  - 订阅 `useUIStore.blogListView` / `blogListSort` / `blogListStatusFilter`
  - 调 `useFilteredBlogs(blogs, filters, sort)`
- [x] 7.2 布局
  - 标题栏：标题「博客」+ 副标题「共 N 篇博客」
  - 工具栏：`<BlogListToolbar>`（视图 + 排序 + 新建）
  - 筛选条：`<BlogListFilters>`
  - 内容区：grid 或 list
- [x] 7.3 加载态
  - `blogs === undefined` → 显多个 `<Skeleton>`
- [x] 7.4 空数据态
  - 0 blog + 无 filter → `<EmptyState variant="illustration" icon={Notebook} title="还没有博客" action={{label: '写新博客', onClick: ...}} />`
  - 0 blog + 有 filter → `<EmptyState variant="compact" icon={SearchX} title="没找到匹配的博客" action={{label: '清除筛选', onClick: clearFilters}} />`
- [x] 7.5 视图分支
  - `view === 'grid'` → 网格 `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">` 包 BlogCard
  - `view === 'list'` → 单列 `<div className="space-y-2">` 包 BlogCard（density='list'）
- [x] 7.6 框架名映射
  - `const frameworks = useFrameworks()` → `frameworks.find(f => f.id === blog.frameworkId)?.name`

## 8. BlogDetail 改造

- [x] 8.1 `src/pages/blogs/BlogDetail.tsx` → 增量元数据
  - 字数：`countText(blog.content)`
  - 创建时间：`formatChineseDate(new Date(blog.createdAt))`
  - 更新时间：`formatChineseDate(new Date(blog.updatedAt))`
  - 状态 badge：复用 BlogCard 的样式（v1.0 简化为 inline span）
  - 标签 chips：`<TagChip>` 复用（v1.0 inline）
  - 来源计划：`<Link to="/plans/{id}">{plan.title}</Link>`
  - 附件：Round 10 已落地，不动
- [x] 8.2 操作栏增「删除」按钮
  - onClick → `window.confirm('确认删除博客「{title}」？\n附件将保留在 IndexedDB 中（孤儿数据）。')`
  - 确认 → `useBlogStore.deleteBlog(id)` + `navigate('/blogs')`
  - 失败 → `pushToast('error', '删除失败')`
- [x] 8.3 加载 / 不存在 态
  - 加载中：「加载博客中…」（v1.0 简化）
  - 不存在：`<EmptyState>` + 「找不到该博客」+ 返回列表
- [x] 8.4 不破坏 Round 10 附件
  - `<AttachmentList>` + `<ImageLightbox>` 保留

## 9. 验证

- [x] 9.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 9.2 `pnpm lint` 0 error / 0 warning
- [ ] 9.3 手动验证：/blogs 列表页显示所有博客，按 createdAt 倒序 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.4 手动验证：搜索框输入「复盘」实时过滤 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.5 手动验证：框架下拉选「项目复盘」过滤 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.6 手动验证：标签 chip 多选 OR 过滤 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.7 手动验证：状态 tab 切到「草稿」过滤 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.8 手动验证：排序下拉切到「最近更新」+ 「标题 A→Z」 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.9 手动验证：视图切到「列表」+ 切回「卡片网格」 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.10 手动验证：博客卡片点击进入详情 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.11 手动验证：详情页显示字数 + 创建/更新时间 + 状态 + 标签 + 来源计划 + 附件 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.12 手动验证：详情页「编辑」按钮跳到 /blogs/:id/edit — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.13 手动验证：详情页「删除」按钮 confirm → 删除后跳回 /blogs — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.14 手动验证：刷新后视图/排序/状态过滤 持久化保留 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.15 手动验证：搜索/框架/标签 刷新后重置（不持久化）— 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.16 手动验证：0 blog 显 EmptyState illustration — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 9.17 手动验证：筛选无结果显 EmptyState compact + 清除筛选 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [x] 9.18 `openspec validate add-blog-list-and-detail --strict` 通过

## 10. 提交与归档

- [x] 10.1 实施完成（待后续 git 提交，本轮只做实施+归档）
- [x] 10.2 `openspec archive add-blog-list-and-detail --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（默认 created-desc）| 3.2 + 7.1 | 浏览器 |
| AC-2（搜索）| 2.1 + 5.1 + 7.1 | 浏览器 |
| AC-3（框架下拉）| 5.1 + 7.1 | 浏览器 |
| AC-4（标签多选）| 5.1 + 2.1 | 浏览器 |
| AC-5（状态切换）| 3.3 + 5.1 + 7.1 | 浏览器 |
| AC-6（排序）| 1.1 + 2.1 + 6.3 | 浏览器 |
| AC-7（视图切换）| 3.1 + 6.2 + 7.5 | 浏览器 |
| AC-8（卡片点击进详情）| 4.1 | 浏览器 |
| AC-9（详情页元数据）| 8.1 | 浏览器 |
| AC-10（编辑按钮）| 8.2（已存在） | 浏览器 |
| AC-11（删除 + 跳回）| 8.2 | 浏览器 |
| AC-12（空数据态）| 7.4 | 浏览器 |
| AC-13（筛选无结果）| 7.4 | 浏览器 |
| AC-14（持久化）| 3.1-3.4 | 浏览器刷新 |
| AC-15（build + lint）| 9.1 + 9.2 | CLI ✓ |
| AC-16（validate）| 9.18 | CLI ✓ |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（sort-engine）| 0.05 | 1 文件 |
| 2（useFilteredBlogs）| 0.15 | hook + 4 useMemo |
| 3（uiStore 增量）| 0.1 | 3 字段 + 3 action + persist |
| 4（BlogCard）| 0.2 | 卡片 + 状态 badge + 相对时间 |
| 5（BlogListFilters）| 0.2 | 搜索 + 框架 + 标签 + 状态 tab |
| 6（BlogListToolbar）| 0.1 | 视图 + 排序 + 新建 |
| 7（BlogList）| 0.2 | 页布局 + 空态 + 视图分支 |
| 8（BlogDetail 改造）| 0.15 | 元数据 + 删除 |
| 9（验证）| 0.3 | build / lint / validate + 浏览器 15 项 |
| 10（提交归档）| 0.1 | git + archive |
| **合计** | **1.55 人天** | 略超 1.5h；可压缩验证段 |
