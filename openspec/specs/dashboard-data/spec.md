# dashboard-data Specification

## Purpose
TBD - created by archiving change add-data-binding-dashboard. Update Purpose after archive.
## Requirements
### Requirement: 4 个数字卡派生自真实数据

系统 MUST 在 Dashboard 4 个数字卡上显示从 IndexedDB 派生的真实数据，并通过 `useDashboardStats` hook 暴露。

4 个数字：
- **本月完成率**：所有 plan 的 `progress` 字段平均值（已由 PlanRepo 缓存）
- **进行中的计划**：`usePlans()` 中 `status !== 'done' && status !== 'paused'` 的数量
- **本月完成事项数 + 累计**：v1.0 简化为「总完成事项数」单数字（streak 算法 v1.1 仪表盘增强再做）
- **已发布博客数**：`useBlogs()` 中 `status === 'published'` 的数量

#### Scenario: 0 条数据时数字为 0

- **GIVEN** IndexedDB 中无任何 plan / blog
- **WHEN** 组件渲染 Dashboard
- **THEN** 4 个数字卡分别显示：`0%` / `0` / `0` / `0`
- **AND** 不抛错，不显示 `NaN` / `undefined`

#### Scenario: 创建 1 条 doing 状态的 plan

- **GIVEN** IndexedDB 中无数据
- **WHEN** 任意代码调 `planRepo.create({ ..., status: 'todo' })`（默认）
- **THEN** 刷新后「进行中的计划」数字 = 1
- **AND** 「本月完成率」数字 = 0（progress=0）
- **AND** 「已发布博客」数字 = 0

#### Scenario: 1000 条 plan 派生 < 50ms

- **GIVEN** IndexedDB 中有 1000 条 plan（混合 status）
- **WHEN** 渲染 Dashboard
- **THEN** `useDashboardStats` 派生耗时 < 50ms（DevTools Performance 实测）
- **AND** 不阻塞首屏渲染

---

### Requirement: 今日聚焦选 plan 策略

系统 MUST 选一个 plan 作为「今日聚焦」展示，选策略按优先级：

1. `urgency === 'red'` 的所有 plan 中，按 `endDate asc` 取第一个
2. 否则 `urgency === 'orange'` 中，按 `endDate asc` 取第一个
3. 否则最近编辑的 `status === 'doing'` plan（按 `updatedAt desc`）
4. 否则最近编辑的 `status === 'todo'` plan（按 `updatedAt desc`）

#### Scenario: 有 red 紧急度 plan

- **GIVEN** IndexedDB 中有 3 条 plan：A (urgency=red, endDate=tomorrow), B (urgency=orange, endDate=2 days), C (urgency=none, doing, updatedAt=今天)
- **WHEN** 渲染 Dashboard
- **THEN** 今日聚焦选 A（red 最高优先级）

#### Scenario: 多个 red 中选最早截止

- **GIVEN** 2 条 plan 都是 red：A (endDate=今天), B (endDate=明天)
- **WHEN** 渲染 Dashboard
- **THEN** 今日聚焦选 A（按 endDate asc）

#### Scenario: 无 red/orange 时选最近 doing

- **GIVEN** IndexedDB 中只有 1 条 plan：status=doing, urgency=none
- **WHEN** 渲染 Dashboard
- **THEN** 今日聚焦选这条 plan

#### Scenario: 无任何 plan 时聚焦卡片隐藏

- **GIVEN** IndexedDB 中无 plan
- **WHEN** 渲染 Dashboard
- **THEN** 整个 Dashboard 切到 `EmptyDashboard` 状态（不在 4 数字卡 + 聚焦 + 即将到期的子页内显示「无」占位）

---

### Requirement: 即将到期按紧急度排序

系统 MUST 展示「即将到期」section，内容是**未过期** + **未完成**的 plan，按 `urgency asc` + `endDate asc` 排序，取前 3 条。

#### Scenario: 排序优先级

- **GIVEN** 4 条未完成 plan：A(red, endDate=今天), B(orange, endDate=明天), C(yellow, endDate=后天), D(none, endDate=下周)
- **WHEN** 渲染 Dashboard
- **THEN** 「即将到期」列表显示顺序：A, B, C（取前 3）

#### Scenario: 过滤已完成 / 已过期

- **GIVEN** 5 条 plan：2 条 done, 1 条 paused, 1 条 endDate=昨天（已过期），1 条 endDate=今天
- **WHEN** 渲染 Dashboard
- **THEN** 「即将到期」只显示 endDate=今天 那条（过滤掉 done / paused / 已过期）

#### Scenario: 不足 3 条时按实际数显示

- **GIVEN** 只有 1 条未完成 plan
- **WHEN** 渲染 Dashboard
- **THEN** 「即将到期」section 显示 1 条（不补空）

---

### Requirement: 最近博客取 published 状态

系统 MUST 展示「最近博客」section，内容是 `status === 'published'` 的 blog，按 `publishedAt desc` 排序，取前 3 条。

#### Scenario: 过滤草稿与归档

- **GIVEN** 5 条 blog：2 条 draft, 1 条 archived, 2 条 published
- **WHEN** 渲染 Dashboard
- **THEN** 「最近博客」只显示 2 条 published（按 publishedAt desc）

#### Scenario: 无 published blog 时 section 显示空状态

- **GIVEN** 所有 blog 都是 draft / archived
- **WHEN** 渲染 Dashboard
- **THEN** 「最近博客」section 显示「还没有发布的博客 → 去写一篇」链接
- **AND** 不抛错

#### Scenario: publishedAt 为 undefined 时降级用 updatedAt

- **GIVEN** Blog B 的 status=published 但 publishedAt 字段意外为 undefined
- **WHEN** 渲染 Dashboard
- **THEN** 用 `updatedAt desc` 排序（B 仍可显示）
- **NOTE**：正常路径 BlogRepo.update 在 status 变 published 时自动填 publishedAt；本场景仅兜底异常数据

---

### Requirement: 最近活动合并 plans + blogs

系统 MUST 展示「最近活动」section，内容是 plans + blogs 按 `updatedAt desc` 合并排序，取前 4 条。

每条活动渲染为：彩色圆点 + 描述 + 「X 前」相对时间。

#### Scenario: 4 条混合活动

- **GIVEN** 3 条 plan（P1/P2/P3）+ 2 条 blog（B1/B2），5 条的 updatedAt 分别为：[P1: 1小时前, P2: 昨天, P3: 3天前, B1: 5小时前, B2: 2天前]
- **WHEN** 渲染 Dashboard
- **THEN** 「最近活动」按 updatedAt desc 取前 4：[P1, B1, P2, B2]

#### Scenario: 时间格式化

- **GIVEN** 1 条 blog，updatedAt = 30 分钟前
- **WHEN** 渲染 Dashboard
- **THEN** 相对时间显示「30 分钟前」
- **NOTE**：格式化函数 `formatRelativeTime`（见 shared/utils/format.ts），与 mock 视觉文案「2 小时前」「昨天 21:30」「7月16日」保持一致风格

#### Scenario: 同分钟内多条活动按 ID 稳定排序

- **GIVEN** 3 条 blog 都在同一分钟更新
- **WHEN** 渲染 Dashboard
- **THEN** 按 `updatedAt desc, id asc` 稳定排序（同分钟内 ID 字典序）

---

### Requirement: 加载状态骨架屏

系统 MUST 在 `useDashboardStats` / `useTodayFocus` / `useUpcomingPlans` / `useRecentBlogs` / `useRecentActivity` 任一返回 `undefined` 时，渲染 DashboardSkeleton 占位（与现有 4 数字卡 + 3 section 尺寸一致的灰色卡片）。

#### Scenario: 首帧 undefined

- **GIVEN** 浏览器刚打开页面，IndexedDB 还未 ready
- **WHEN** Dashboard 首次渲染
- **THEN** 5 个 hook 全部返回 `undefined`
- **AND** 渲染 `DashboardSkeleton`（4 个灰数字卡 + 3 个灰 section）
- **AND** IndexedDB ready 后（~ 50ms 内）切换到真实数据，无明显闪烁

#### Scenario: 部分 hook 就绪

- **GIVEN** usePlans 已就绪但 useBlogs 还未就绪
- **WHEN** 渲染 Dashboard
- **THEN** 整体仍渲染 `DashboardSkeleton`（5 个 hook 中任一未就绪就保持骨架）
- **AND** 数据全部就绪后一次性切换（避免骨架 → 部分数据 → 完整 的多阶段闪烁）

---

### Requirement: 空状态引导创建

系统 MUST 在 `stats.activePlans === 0` 时，渲染 `EmptyDashboard` 替代主区，包含：
- 大标题「欢迎来到 Planote 👋」
- 副标题「创建你的第一个计划，让目标开始流动」
- CTA 按钮「新建计划」→ `navigate('/plans/new')`

#### Scenario: 首次访问无数据

- **GIVEN** 用户首次打开应用（IndexedDB 空）
- **WHEN** 渲染 Dashboard
- **THEN** 渲染 `EmptyDashboard`（不显示 4 数字卡的「0」/ 不显示骨架屏）
- **AND** 用户点击「新建计划」跳转到 `/plans/new` 路由

#### Scenario: 删除所有 plan 后回到空状态

- **GIVEN** 原本有 3 条 plan
- **WHEN** 用户在 planRepo 上删完所有 plan
- **THEN** Dashboard 立即从真实数据态切到 `EmptyDashboard`
- **AND** 数字卡的「0」状态不显示

---

