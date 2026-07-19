## Why

当前 Dashboard 页面（`src/pages/Dashboard.tsx`）用 4 个静态常量数组渲染 4 个数字卡 + 今日聚焦 + 最近博客 + 即将到期 + 活动流。这些数据完全脱离真实 IndexedDB，用户行为（创建计划、勾选事项、发布博客）不会反映到 Dashboard 上，体验与最终产品脱节。

Sprint 1 Step 2 `add-data-layer-dexie` 已落地 6 个 Repository，Sprint 1 末 `add-zustand-stores` 落地 7 个 store + 8 个 useLiveQuery hook（`usePlans` / `useBlogs` / `useItemsForPlan` 等），所有基础设施就绪。

本 change 是**数据接入**的最后一公里：把 Dashboard 的 mock 数据切到 `useLiveQuery` 读 store，做到"打开应用看到真实数据；勾选事项后 Dashboard 数字自动更新"。

## What Changes

### 替换 5 个数据源

1. **4 个数字卡**（`STATS` 常量）：
   - 「本月完成率」→ 派生：`floor(checked / total * 100)`，范围本月（timeDim=monthly）的所有 plans
   - 「进行中的计划」→ `usePlans().filter(p => p.status === 'doing' || p.status === 'todo').length`
   - 「坚持打卡」→ 派生：连续 N 天有 completedAt 的 Item（v1.0 简化为「本月已完成事项数」+ 「总完成事项数」两段式）
   - 「已发布博客」→ `useBlogs().filter(b => b.status === 'published').length`

2. **今日聚焦**（`TODAYS_FOCUS` 常量）：
   - 「聚焦计划」选择策略：选当前 `urgency === 'red'` 的第一个 plan；若无，取 `urgency === 'orange'`；再无取最近编辑的 `doing` 状态 plan
   - 「剩余事项数」：该 plan 下 `status !== 'done'` 的 item 数
   - 「进度」：直接用 `plan.progress`
   - 「事项列表」：该 plan 下前 4 个 item

3. **即将到期**（`UPCOMING` 常量）：
   - 数据源：所有 `endDate` 未过期（endDate >= today）且 `status !== 'done'` 的 plan
   - 排序：按 `urgency` 升序（red → orange → yellow → none），同 urgency 按 `endDate` 升序
   - 取前 3 条

4. **最近博客**（`RECENT_BLOGS` 常量）：
   - 数据源：`useBlogs()` 中 `status === 'published'` 的，按 `publishedAt desc` 排序
   - 取前 3 条

5. **最近活动**（`ACTIVITIES` 常量）：
   - 数据源：合并 `usePlans()` + `useBlogs()` 的 `updatedAt desc` 前 4 条
   - 按更新时间倒序，渲染成统一格式「X 前」+ 描述

### 派生计算封装

- 4 个数字卡派生放 `src/stores/hooks/useDashboardStats.ts`
- 「聚焦计划」选策略放 `src/stores/hooks/useTodayFocus.ts`
- 「即将到期」放 `src/stores/hooks/useUpcomingPlans.ts`
- 4 个 hook 都用 `useMemo` 包一次（输入是 useLiveQuery 返回的数组，避免每次渲染重算）

### 不动的部分

- 4 个数字卡的视觉、颜色、动画 delay、布局完全不变
- 4 个数字卡的 icon / badge / footer 文案不变（数字本身从 mock 变真实）
- 今日聚焦卡片的渐变背景、布局、TodoRow 子组件不变
- 欢迎语、日期、按钮（新建计划 / 写博客）不变
- 「完成提醒」横幅 v1.0 暂不接数据，仍为静态（roadmap 提到完成横幅等 Sprint 2 计划模块做）

## Scope

**In Scope**：

- `src/stores/hooks/useDashboardStats.ts`：4 个数字卡派生
- `src/stores/hooks/useTodayFocus.ts`：今日聚焦计划 + 事项列表
- `src/stores/hooks/useUpcomingPlans.ts`：即将到期（按紧急度排序）
- `src/stores/hooks/useRecentActivity.ts`：最近活动（plans + blogs 合并排序）
- `src/pages/Dashboard.tsx`：删除所有 mock 常量（STATS / TODAYS_FOCUS / RECENT_BLOGS / UPCOMING / ACTIVITIES），改用 4 个 hook
- 加载状态：useLiveQuery 首帧返回 `undefined`，渲染骨架屏（不动现有 Card 组件结构，加 `if (data === undefined) return <Skeleton />`）
- 空状态：无计划时显示「创建你的第一个计划」CTA

**Out of Scope**：

- 4 个数字卡视觉 / 颜色 / badge 文案调整（保持 mock 视觉）
- 5 种数字之外的指标（如完成率趋势、热力图）—— v1.1 仪表盘增强（P1-B，roadmap §3）
- 完成提醒横幅接入数据 —— Sprint 2 `add-plan-module` 做
- 数字卡点击跳转（v1.0 数字只展示，不跳转）
- 拖拽、撤销/重做
- 数字缓存到 IndexedDB（dashboard 派生现算，1k plans 场景 < 50ms）

## Acceptance Criteria

- [ ] **AC-1**：浏览器打开 `http://localhost:5173/`，Dashboard 4 个数字卡显示真实数据
- [ ] **AC-2**：「进行中的计划」数字 = 当前 `usePlans().filter(p => p.status !== 'done' && p.status !== 'paused').length`
- [ ] **AC-3**：「已发布博客」数字 = `useBlogs().filter(b => b.status === 'published').length`
- [ ] **AC-4**：今日聚焦卡片显示真实计划（按紧急度选：red > orange > 最近 doing）
- [ ] **AC-5**：今日聚焦卡片显示 3-4 条该 plan 下的 item，状态从 `item.status` 派生（todo/doing/done）
- [ ] **AC-6**：「即将到期」列表显示 3 条 plan，按紧急度升序（红 > 橙 > 蓝），取前 3
- [ ] **AC-7**：「最近博客」显示 3 条 `status === 'published'` 的 blog，按 `publishedAt desc`
- [ ] **AC-8**：「最近活动」显示 4 条，按 plans + blogs 合并 `updatedAt desc` 取前 4
- [ ] **AC-9**：在 DevTools Console 创建 1 条 plan 或 blog 后，刷新页面数字立即更新
- [ ] **AC-10**：勾选 1 个 item 后（v1.0 还没有 item 勾选 UI，可通过 console 调 `itemRepo.toggle`），刷新后「本月完成率」数字 +1
- [ ] **AC-11**：首帧 `undefined` 时显示骨架屏（不报错）
- [ ] **AC-12**：无任何 plan 时 Dashboard 显示「创建你的第一个计划」CTA，不显示空骨架
- [ ] **AC-13**：`pnpm build` 0 error；`pnpm dev` 控制台无 warning
- [ ] **AC-14**：`openspec validate add-data-binding-dashboard --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| 首帧 undefined 闪屏 | 低 | 骨架屏占位（与 Card 同尺寸） |
| 1000 条 plans 时 4 个派生 + 排序耗时 | 低 | useMemo + planRepo 已建索引；实测 < 50ms |
| 紧急度排序算法与 List 视图不一致 | 低 | 复用 `computeUrgency` 派生缓存（Plan.urgency 字段） |
| 「最近活动」需要时间格式化（如「2 小时前」）| 中 | 抽 `formatRelativeTime(iso: ISODate): string` 工具到 `src/shared/utils/format.ts` |
| 「坚持打卡」原始需求是 streak 算法，v1.0 简化为总数 | 中 | proposal 明确 v1.0 简化为「本月完成 N 项 / 累计 M 项」两段式；streak 算法 v1.1 仪表盘增强再做 |
| 完成提醒横幅接数据超出本 change 范围 | 低 | 显式列为 Out of Scope，留给 Sprint 2 |

## Dependencies

- **上游（已完成）**：
  - Sprint 1 Step 2 `add-data-layer-dexie`：6 个 Repository
  - Sprint 1 末 `add-zustand-stores`：7 个 store + 8 个 useLiveQuery hook
- **下游（待启动）**：
  - `add-plan-module`（Sprint 2）：消费 usePlan / useItemsForPlan 后，Dashboard 完成提醒横幅接真实数据
  - Sprint 1 末 5 个空页面（PlanList / PlanDetail / BlogList / BlogDetail / Kanban / Settings）数据接入复用本 change 派生模式
