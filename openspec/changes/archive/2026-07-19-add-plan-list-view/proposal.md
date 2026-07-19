## Why

Planote 的核心叙事是「计划 → 完成 → 沉淀为博客」，但当前 `/plans` 路由仅是一个占位页（`PlaceholderPage`），无法承载任何计划浏览能力：

- **核心场景缺失**：用户在仪表盘只能看到「今日聚焦 + 即将到期 + 活动流」3 个切片视角，无法浏览全部计划（短/中/长期 × 4 维度的全量矩阵）。这是 PRD 4.3「计划列表」的直接交付物。
- **视图模式不统一**：从 prototype 阶段就明确了「分组/全部/表格」3 种视图模式（ux-guidelines.md §1 原则 4「密度自适配」），每种模式应对 10/100/1000 量级数据。占位页没有这一层。
- **智能排序未落地**：原型 plans.html 顶部 amber 排序说明条「分组内按紧急度+进度排序」是用户对 Planote 的核心期待之一，紧急度派生（plan-data spec 已定义）+ 进度降序组合是 Planote 区别于通用 TODO 工具的关键。
- **全局搜索缺位**：无搜索框意味着 100+ 计划时用户找不到目标（ux-guidelines.md §6 坑 6）；本 change 把搜索框放进列表页头部。

本 change 落地后用户能：① 进入 `/plans` 看到全量计划矩阵；② 在 3 种视图间切换应对不同浏览场景；③ 通过搜索快速定位；④ 折叠/展开长分组避免信息过载。下一轮 `add-plan-detail-view` 在此基础上提供「点击进计划详情」的入口。

## What Changes

### 1. /plans 路由页面（实现 PlanList）

- 路径：`src/pages/plans/PlanList.tsx`（当前是 PlaceholderPage，本 change 替换为真实实现）
- 布局（自上而下）：标题栏 + 排序说明条 + 工具栏（搜索框 + 视图切换器）+ 内容区
- 标题栏：页面标题「计划」+ 副标题「共 N 项计划」+ 右侧主操作按钮「新建计划」（跳转 `/plans/new`，本 change 不实现创建页）
- 排序说明条：`bg-amber-50/50` 背景 + 文案「按紧急度 + 进度智能排序，紧急度高的优先」+ amber icon（`Sparkles` 或 `Wand2`），让排序规则透明
- 工具栏：搜索框（左）+ 视图切换器（右），3 段切换器（分组/全部/表格）

### 2. 视图切换器（`PlanViewSwitcher`）

- 路径：`src/components/plans/PlanViewSwitcher.tsx`
- 3 段切换按钮：`data-view-switcher` 容器，3 个 `<button data-view="group|all|table">` 互斥单选
- 视觉：白底胶囊容器 + 当前选中按钮 `bg-brand-900 text-white`，未选中 `text-brand-500 hover:bg-stone-100`
- 持久化：选中状态写入 `useUIStore.planListView`（`localStorage` persist 复用 `add-zustand-stores` 已建 store）
- 切换不重渲染数据（hooks 已在最外层订阅），仅切换渲染分支

### 3. 智能排序 hook（`useSortedPlans`）

- 路径：`src/stores/hooks/useSortedPlans.ts`
- 输入：plans 数组（来自 `useLiveQuery(() => planRepo.list())`）
- 输出：排序后的 plans 数组
- 公式（双关键字 + tie-breaker）：
  1. **主关键字**：`urgency` 升序（red=0 → orange=1 → yellow=2 → none=3）
  2. **次关键字**：`progress` 降序（高进度优先，给用户「完成感」）
  3. **三关键字**：`endDate` 升序（无 endDate 的排最后）
  4. **四关键字**：`createdAt` 降序（最新创建在前，平 tie）
- 性能：1000+ plan 时走纯函数排序，O(n log n)，无需特殊优化

### 4. 全局搜索（`usePlanSearch`）

- 路径：`src/stores/hooks/usePlanSearch.ts`
- 输入：plans 数组 + query 字符串
- 输出：过滤后的 plans
- 匹配字段：`title` / `description`（v1.0 不做语义搜索/标签/事项内容搜索，标签和事项搜索留 v1.1）
- 大小写不敏感、中文按字符直接匹配（`String.prototype.includes`）
- 空 query 返回原 plans 数组（不复制）
- 性能：useMemo 缓存，输入未变时不重算

### 5. 三种视图实现

#### 5.1 分组视图（`PlanGroupedView`，默认）

- 按 `Plan.level` 分 3 组：短期 / 中期 / 长期（数据为 0 的组隐藏）
- 每组内复用 `useSortedPlans` 的排序结果
- 每组前 5 个 + 「展开剩余 N 个」虚线按钮（点击后该组全部展示，按钮变为「收起」）
- 卡片用大卡布局：`PlanCard` 包含进度条 + 紧急度左边框 + 标签 + 起止日期
- 组件路径：`src/features/plan/components/PlanCard.tsx`

#### 5.2 全部视图（`PlanListAllView`）

- 一列紧凑横排（`flex` 横排卡片，`p-3` 紧凑 padding）
- 每行：进度环（24px）+ 标题 + 紧急度 tag + 进度百分比
- 100+ 计划时启用 `react-virtuoso` 虚拟滚动（已在 package.json 依赖中）
- 分页：v1.0 简化为「加载更多」按钮（无需独立分页器）

#### 5.3 表格视图（`PlanTableView`）

- 使用 `TanStack Table v8` 渲染 6 列：勾选 / 标题 / 层级 / 紧急度 / 进度 / 起止日期
- 勾选列支持多选（v1.0 仅 UI 状态，不实现批量操作；批量操作留给 `add-plan-batch-ops`）
- 排序：列头点击切换 asc/desc，**优先于**智能排序（用户主动排序时覆盖默认）
- 1000+ 行启用 `react-virtuoso` 虚拟滚动

### 6. 折叠展开组件（`PlanGroupCollapse`）

- 路径：`src/features/plan/components/PlanGroupCollapse.tsx`
- 单组容器：标题（h3）+ 计数 badge + 展开/收起按钮
- 默认折叠阈值：5 个 plan / 组
- 展开后阈值失效，显示全部 + 数量提示「已显示 N / 总数」+ 收起按钮

### 7. 空状态 / 加载 / 错误

- 全部数据为空（`plans.length === 0`）→ `<EmptyState variant="illustration" icon={Notebook} title="还没有计划，从一个目标开始 ✨" action={...新建计划} />`
- 搜索无结果 → `<EmptyState variant="compact" icon={SearchX} title="没找到匹配的计划" description="试试其他关键词" action={...清除筛选} />`
- 数据加载中（liveQuery 首帧 undefined）→ `<Skeleton className="h-8 w-full" />` 多个占位
- useLiveQuery 抛错 → 嵌套 `<ErrorBoundary>` + 降级 UI（本 change 不引入嵌套 ErrorBoundary，复用根级；出错时显示 EmptyState 兜底）

## Scope

**In Scope**：

- `/plans` 路由页面（替换 PlaceholderPage），含布局 + 排序说明条 + 工具栏
- 1 个新组件 `PlanViewSwitcher`
- 1 个新组件 `PlanGroupCollapse`（分组折叠容器）
- 1 个新组件 `PlanCard`（大卡布局，3 视图共用）
- 1 个新组件 `PlanRow`（全部视图紧凑行）
- 1 个新组件 `PlanTable`（表格视图，TanStack Table 封装）
- 1 个 hook `useSortedPlans`（智能排序）
- 1 个 hook `usePlanSearch`（搜索过滤）
- `useUIStore` 增量：1 个字段 `planListView: 'group' | 'all' | 'table'`（默认 `'group'`）+ persist 集成
- spec 增量：新增 `plan-list` capability 的 8-10 Requirements

**Out of Scope**（明确划清边界）：

- 计划详情页 → 下一轮 `add-plan-detail-view`
- 创建/编辑表单 → 再下一轮 `add-plan-edit-form`
- 批量操作（多选后批量删除/打标）→ `add-plan-batch-ops`
- 全文搜索（标签、事项、博客内容）→ v1.1 `add-global-search`
- 拖拽排序 → v1.1（v1.0 排序由 urgency + progress 主导）
- 标签筛选 UI → v1.1（v1.0 数据 schema 已支持，前端 UI 留 v1.1）
- 视图模式偏好同步到云端 → v1.1（v1.0 走 localStorage）

## Acceptance Criteria

- [ ] **AC-1**：`/plans` 路由可访问，页面包含标题栏 + 排序说明条 + 工具栏（搜索 + 视图切换器）+ 内容区
- [ ] **AC-2**：视图切换器 3 段按钮可点击切换，当前选中态视觉清晰（深色背景）
- [ ] **AC-3**：智能排序在数据加载后立即生效：红色紧急度（今天截止）排在最前 → 橙色 → 黄色 → 无；同紧急度下进度降序
- [ ] **AC-4**：搜索框实时过滤（300ms 内响应），匹配 title/description，空查询显示全部
- [ ] **AC-5**：分组视图按 `level` 分为 3 组（短期/中期/长期），每组前 5 个 + 「展开剩余 N 个」虚线按钮
- [ ] **AC-6**：全部视图紧凑横排，100+ 计划时滚动流畅（react-virtuoso 启用）
- [ ] **AC-7**：表格视图用 TanStack Table 渲染 6 列，列头点击切换排序，覆盖默认智能排序
- [ ] **AC-8**：3 种视图切换无白屏（复用 `add-app-shell` 的 `<Suspense>` + `<LoadingOverlay>` 体系）
- [ ] **AC-9**：全部数据为空时显示 EmptyState illustration；搜索无结果时显示 EmptyState compact
- [ ] **AC-10**：视图偏好持久化（刷新页面后选中态保留，localStorage 存储）
- [ ] **AC-11**：`pnpm build` 0 error，`pnpm lint` 0 warning（与上一轮同等基线）
- [ ] **AC-12**：`openspec validate add-plan-list-view --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| react-virtuoso 在 1000+ 行表格下性能问题 | 中 | v1.0 实测 1000 行无明显卡顿；v1.1 可加 overscan 调优 |
| TanStack Table 排序与 useSortedPlans 冲突 | 中 | 表格视图列头排序**覆盖**默认排序（用户主动 > 默认）；明确文档化 |
| 视图切换频繁触发重渲染 | 低 | 视图切换只切渲染分支，hooks 订阅在顶层完成 |
| 搜索 300ms 实时过滤导致高频重算 | 低 | useMemo 缓存；v1.1 可加 debounce（300ms 节流） |
| 折叠展开状态刷新后丢失 | 低 | 折叠状态不持久化（每次进入重置为折叠），降低复杂度 |

## Dependencies

- **上游（已完成）**：
  - Sprint 1 脚手架：9 个页面占位 + AppLayout
  - `add-data-layer-dexie`：PlanRepo / ItemRepo + 6 个 Repository
  - `add-zustand-stores`：usePlanStore + useLiveQuery 订阅 hook
  - `add-data-binding-dashboard`：Dashboard 派生数据 hook（useUpcomingPlans / useDashboardStats）
  - `add-app-shell`：EmptyState / LoadingOverlay / Skeleton 通用组件 + 路由懒加载
- **下游（待启动）**：
  - `add-plan-detail-view`：从卡片点击进入 `/plans/:id`
  - `add-plan-edit-form`：创建/编辑表单（含三步表单 + 事项拆解）
  - `add-plan-batch-ops`：多选 + 批量打标/删除/归档
  - `add-blog-list-view`：与本 change 平行，复用同样的「视图切换 + 智能排序 + 搜索」模式

## Out of Scope Reminder

- 不实现计划详情页（`add-plan-detail-view` 接手）
- 不实现创建/编辑表单（`add-plan-edit-form` 接手）
- 不实现批量操作（`add-plan-batch-ops` 接手）
- 不实现拖拽排序（v1.1）
- 不实现标签筛选 UI（v1.1）
- 不实现全文搜索（v1.1，v1.0 仅 title/description 子串匹配）
- 不写单测（Sprint 1-2 暂不强制）
- 不引入新依赖（react-virtuoso / TanStack Table 已在 package.json）
