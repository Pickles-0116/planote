# blog-list-and-detail Specification

## Purpose
TBD - created by archiving change add-blog-list-and-detail. Update Purpose after archive.
## Requirements
### Requirement: 博客列表数据 pipeline

系统 MUST 在 `/blogs` 路由使用 `useFilteredBlogs(blogs, filters, sort)` hook 组合筛选 + 搜索 + 排序，输出最终展示列表。

#### Scenario: hook 返回 undefined 表示加载中

- **GIVEN** `useBlogs()` live query 首次返回 `undefined`
- **WHEN** 调用 `useFilteredBlogs(undefined, filters, 'created-desc')`
- **THEN** 返回 `undefined`（让上层走 Skeleton）

#### Scenario: hook 链式 useMemo 缓存

- **GIVEN** `blogs` 与 `filters` 引用未变化
- **WHEN** 多次调用 `useFilteredBlogs(blogs, filters, sort)`
- **THEN** 内部各 useMemo 缓存命中，不重算

#### Scenario: 状态 → 框架 → 标签 → 搜索 → 排序 顺序

- **GIVEN** 5 个 blog：A(draft, fw1, [t1]) / B(pub, fw2, [t2]) / C(draft, fw1, [t2]) / D(pub, fw1, [t1]) / E(archived, fw2, [])
- **WHEN** `filters = { statusFilter: 'draft', frameworkId: 'fw1', selectedTagIds: ['t1', 't2'], query: '' }`
- **THEN** 过滤后：仅 A 满足（draft + fw1 + 至少含 t1 或 t2）

### Requirement: 搜索（title / excerpt / tagIds）

系统 MUST 在列表页搜索框实时过滤博客，匹配 title / excerpt / tagIds 字段（不区分大小写、空 query 透传）。

#### Scenario: title 匹配

- **GIVEN** 1 个 blog title='复盘 7 月'
- **WHEN** 搜索 query='复盘'
- **THEN** 命中并显示

#### Scenario: excerpt 匹配

- **GIVEN** 1 个 blog excerpt='本月读了 3 本书'
- **WHEN** 搜索 query='读书'
- **THEN** 命中并显示

#### Scenario: tagIds 匹配

- **GIVEN** 1 个 blog tagIds=['t_21day', 't_review']
- **WHEN** 搜索 query='21day'
- **THEN** 命中并显示

#### Scenario: 空 query 透传

- **GIVEN** blogs 数组长度 N
- **WHEN** 搜索 query=''
- **THEN** 返回 blogs 原数组（不过滤）

#### Scenario: 大小写不敏感

- **GIVEN** 1 个 blog title='Plan Alpha'
- **WHEN** 搜索 query='plan'
- **THEN** 命中（不区分大小写）

### Requirement: 框架下拉筛选

系统 MUST 提供框架下拉（单选），含「全部」+ 4 个内置 framework。

#### Scenario: 默认「全部」

- **GIVEN** 首次进入 /blogs
- **WHEN** 渲染 BlogListFilters
- **THEN** 框架下拉默认「全部」，不过滤

#### Scenario: 选具体 framework

- **GIVEN** 选 frameworkId='fw_project_review'
- **WHEN** 列表渲染
- **THEN** 仅显 frameworkId 匹配该值的 blog

#### Scenario: framework 0 命中

- **GIVEN** 选 frameworkId='fw_no_match'
- **WHEN** 列表渲染
- **THEN** 显空态 EmptyState + 「清除筛选」

### Requirement: 标签多选筛选（OR）

系统 MUST 允许用户多选标签 chip，筛选关系为 OR（任一命中即通过）。

#### Scenario: 选 1 个 tag

- **GIVEN** 2 个 blog：A.tagIds=['t1'] / B.tagIds=['t2']
- **WHEN** 选 selectedTagIds=['t1']
- **THEN** 显 A，不显 B

#### Scenario: 选多个 tag OR 命中

- **GIVEN** 3 个 blog：A.tagIds=['t1'] / B.tagIds=['t2'] / C.tagIds=['t3']
- **WHEN** 选 selectedTagIds=['t1', 't2']
- **THEN** 显 A + B（OR），不显 C

#### Scenario: 取消 tag

- **GIVEN** selectedTagIds=['t1', 't2']
- **WHEN** 用户点 't1' 取消
- **THEN** selectedTagIds 变为 ['t2']，列表重新过滤

#### Scenario: 标签 a11y

- **GIVEN** 渲染标签 chip
- **WHEN** 检查 DOM 属性
- **THEN** `<button role="switch" aria-checked={isActive} aria-label="筛选标签 {name}">`

### Requirement: 状态切换

系统 MUST 提供状态过滤 4 段 tab（全部 / 草稿 / 已发布 / 已归档），互斥单选。

#### Scenario: 默认「全部」

- **GIVEN** 首次进入 /blogs
- **WHEN** 渲染 BlogListFilters
- **THEN** 状态 tab 默认「全部」激活

#### Scenario: 选「草稿」

- **GIVEN** 3 个 blog：A.draft / B.published / C.archived
- **WHEN** 选 statusFilter='draft'
- **THEN** 仅显 A

#### Scenario: 选「已发布」

- **GIVEN** 3 个 blog：A.draft / B.published / C.archived
- **WHEN** 选 statusFilter='published'
- **THEN** 仅显 B

### Requirement: 排序（3 个 preset）

系统 MUST 提供排序下拉，3 个 preset：最近创建（默认）/ 最近更新 / 标题 A→Z。

#### Scenario: 默认最近创建

- **GIVEN** 2 个 blog：b1.createdAt=T1 / b2.createdAt=T2（T2 > T1）
- **WHEN** 列表渲染（默认 sort='created-desc'）
- **THEN** 顺序：b2 → b1（最新创建在前）

#### Scenario: 选「最近更新」

- **GIVEN** 切换 sort='updated-desc'
- **WHEN** 列表渲染
- **THEN** 按 updatedAt 降序

#### Scenario: 选「标题 A→Z」

- **GIVEN** 2 个 blog：b1.title='Z' / b2.title='A'
- **WHEN** 切换 sort='title-asc'
- **THEN** 顺序：b2 → b1

#### Scenario: 排序不受筛选影响

- **GIVEN** 已按 statusFilter='draft' 过滤后剩 2 个 blog
- **WHEN** 切换 sort
- **THEN** 2 个 blog 仍都在，但顺序按新 sort 重排

### Requirement: 视图切换（grid / list）

系统 MUST 在工具栏提供 2 段视图切换器（卡片网格 / 列表紧凑行），当前选中态视觉清晰。

#### Scenario: 默认 grid

- **GIVEN** 首次进入 /blogs
- **WHEN** 渲染 BlogListToolbar
- **THEN** 视图默认 'grid'，显示卡片网格

#### Scenario: 切换 list

- **GIVEN** 当前为 grid
- **WHEN** 用户点「列表」按钮
- **THEN** 切到单列紧凑横排（`<BlogListView>`）
- **AND** 切换无白屏（hooks pipeline 在顶层完成）

#### Scenario: 视图切换不重算数据

- **GIVEN** 数据已加载
- **WHEN** 视图切换
- **THEN** `useBlogs` live query 不重复订阅
- **AND** 切换耗时 < 100ms

#### Scenario: 视图 a11y

- **GIVEN** 视图切换器容器
- **WHEN** 检查 DOM 属性
- **THEN** 容器 `role="tablist"`，按钮 `role="tab" aria-selected={isActive}`

### Requirement: 博客卡片 BlogCard

系统 MUST 在列表中渲染博客卡片，含标题、摘要、状态 badge、标签 chips、框架名、更新时间。

#### Scenario: 卡片基础渲染

- **GIVEN** 1 个 blog：title='7 月复盘' / excerpt='本月读了 3 本书' / status='draft' / tagIds=['t1'] / frameworkId='fw_review' / updatedAt='2026-07-19T10:00:00Z'
- **WHEN** 渲染 BlogCard（grid 密度）
- **THEN** 显示标题 + 摘要（line-clamp-2）+ 状态 badge（draft）+ 标签 chip（t1）+ 框架名（review）+ 相对时间（"刚刚" 或 "1 小时前"）

#### Scenario: 卡片点击进入详情

- **GIVEN** 列表中有 1 个 blog
- **WHEN** 用户点击该 card
- **THEN** 导航到 `/blogs/{blog.id}`

#### Scenario: list 密度变体

- **GIVEN** 视图 = 'list'
- **WHEN** 渲染 BlogCard（list 密度）
- **THEN** 单行紧凑布局：标题 + 状态 badge 在左，框架名 + 时间在右

#### Scenario: 无 tagIds

- **GIVEN** 1 个 blog tagIds=[]
- **WHEN** 渲染 BlogCard
- **THEN** 标签 chips 区域不渲染（不显空区）

### Requirement: 详情页元数据

系统 MUST 在 `/blogs/:id` 详情页显示完整元数据：标题、字数、创建/更新时间、状态 badge、标签 chips、来源计划、附件（Round 10）。

#### Scenario: 标题渲染

- **GIVEN** blog.title='7 月复盘'
- **WHEN** 渲染 BlogDetail
- **THEN** `<h1>` 渲染该标题

#### Scenario: 字数统计

- **GIVEN** blog.content 含 3 段文字
- **WHEN** 渲染 BlogDetail
- **THEN** 元数据条显「N 字」（N = 提取纯文本后字符数）

#### Scenario: 创建时间

- **GIVEN** blog.createdAt='2026-07-19T10:00:00Z'
- **WHEN** 渲染 BlogDetail
- **THEN** 元数据条显「创建：2026 年 7 月 19 日 · 周日」

#### Scenario: 更新时间

- **GIVEN** blog.updatedAt='2026-07-19T15:00:00Z'
- **WHEN** 渲染 BlogDetail
- **THEN** 元数据条显「更新：2026 年 7 月 19 日 · 周日」

#### Scenario: 状态 badge

- **GIVEN** blog.status='published'
- **WHEN** 渲染 BlogDetail
- **THEN** 元数据条显「已发布」badge

#### Scenario: 标签 chips

- **GIVEN** blog.tagIds=['t1', 't2']
- **WHEN** 渲染 BlogDetail
- **THEN** 元数据条显「#t1 #t2」chips

#### Scenario: 来源计划跳转

- **GIVEN** blog.sourcePlanId='p_123' + PlanRepo 存在该 plan
- **WHEN** 渲染 BlogDetail
- **THEN** 元数据条显「来源：{plan.title}」+ 链接 `/plans/p_123`

#### Scenario: 无 sourcePlanId

- **GIVEN** blog.sourcePlanId=undefined
- **WHEN** 渲染 BlogDetail
- **THEN** 来源计划区块不渲染

#### Scenario: 内容只读渲染

- **GIVEN** blog.content={ type: 'doc', content: [...] }
- **WHEN** 渲染 BlogDetail
- **THEN** `<RichEditor readOnly value={JSON.stringify(content)} />` 渲染

### Requirement: 详情页操作栏

系统 MUST 在详情页顶栏提供「编辑」+「删除」按钮。

#### Scenario: 编辑按钮

- **GIVEN** 详情页加载
- **WHEN** 渲染顶栏
- **THEN** 显「编辑」按钮 + `<Link to="/blogs/{id}/edit">`

#### Scenario: 删除按钮 + 确认

- **GIVEN** 详情页加载 + blog.title='7 月复盘'
- **WHEN** 用户点「删除」按钮
- **THEN** 弹 `window.confirm('确认删除博客「7 月复盘」？')`
- **AND** 取消则无操作
- **AND** 确认则调 `useBlogStore.deleteBlog(id)` + 跳回 `/blogs`

#### Scenario: 删除失败

- **GIVEN** 详情页加载
- **WHEN** 用户点「删除」+ 确认 + `deleteBlog` 抛错
- **THEN** toast「删除失败」+ UI 不跳走

### Requirement: 详情页附件（Round 10 增量，跨 change 引用）

系统 MUST 在 `/blogs/:id` 内容下方展示博客附件（图片 + PDF），由 `add-blog-attachment` 落地。

#### Scenario: 0 附件

- **GIVEN** 博客无附件
- **WHEN** 渲染 BlogDetail
- **THEN** 附件区域不渲染

#### Scenario: N 附件

- **GIVEN** 博客有 3 个附件（2 图 + 1 PDF）
- **WHEN** 渲染 BlogDetail
- **THEN** 内容下方显「附件（3）」+ 网格（图片缩略图 + PDF icon）

#### Scenario: 图片点击放大

- **GIVEN** 1 个 jpg 附件
- **WHEN** 用户点击缩略图
- **THEN** `<ImageLightbox>` 全屏预览（Round 9 + 10 已落地）

#### Scenario: PDF 下载

- **GIVEN** 1 个 pdf 附件
- **WHEN** 用户点击 PDF
- **THEN** 浏览器下载（`<a download>`，Round 10 已落地）

### Requirement: 列表页空数据态

系统 MUST 在不同空数据场景下显合适的 EmptyState。

#### Scenario: 0 blog

- **GIVEN** `useBlogs()` 返回 `[]` + 无任何 filter
- **WHEN** 渲染 BlogList
- **THEN** 显 `EmptyState` illustration + 「还没有博客」+ 「写新博客」按钮

#### Scenario: 筛选无结果

- **GIVEN** `useFilteredBlogs` 返回 `[]` + 有 active filter
- **WHEN** 渲染 BlogList
- **THEN** 显 `EmptyState` compact + 「没找到匹配的博客」+ 「清除筛选」按钮

#### Scenario: 加载中

- **GIVEN** `useBlogs()` 返回 `undefined`（live query 首帧）
- **WHEN** 渲染 BlogList
- **THEN** 显 `<Skeleton>` 多个占位

### Requirement: 状态持久化

系统 MUST 把视图 / 排序 / 状态过滤 持久化到 localStorage（复用 add-zustand-stores 已建 store）。

#### Scenario: 视图持久化

- **GIVEN** 用户切到 'list' 视图
- **WHEN** 刷新页面
- **THEN** 仍为 'list' 视图

#### Scenario: 排序持久化

- **GIVEN** 用户选 'title-asc' 排序
- **WHEN** 刷新页面
- **THEN** 仍为 'title-asc'

#### Scenario: 状态过滤持久化

- **GIVEN** 用户选 statusFilter='draft'
- **WHEN** 刷新页面
- **THEN** 仍为 'draft'

#### Scenario: 搜索/框架/标签不持久化

- **GIVEN** 用户输入 query='复盘' / 选 frameworkId='fw_review' / 选 tagId='t1'
- **WHEN** 刷新页面
- **THEN** 这 3 个本地 state 重置为空（不持久化）

### Requirement: 路由守卫与权限

系统 MUST 在没有 blog 的情况显 EmptyState，不抛错。

#### Scenario: ID 不存在

- **GIVEN** 用户访问 `/blogs/{not_exist_id}`
- **WHEN** `useBlog(id)` 返回 null
- **THEN** 显 `EmptyState` + 「找不到该博客」+ 「返回博客列表」按钮

#### Scenario: 加载中

- **GIVEN** `useBlog(id)` 返回 undefined
- **WHEN** 渲染 BlogDetail
- **THEN** 显「加载博客中…」占位

### Requirement: 详情页删除后清理

系统 MUST 在删除博客后清理其 store 状态，避免遗留引用。

#### Scenario: 选中的 blog 被删除

- **GIVEN** 当前 `useUIStore.selectedBlogId` = {deletedId}
- **WHEN** 用户从详情页删除该 blog
- **THEN** 跳回 `/blogs` + 列表不再显示该 blog
- **AND** 后续导航到 `/blogs/{deletedId}` 显 EmptyState

---

