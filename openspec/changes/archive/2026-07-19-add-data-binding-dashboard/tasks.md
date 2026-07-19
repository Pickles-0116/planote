# Tasks · Dashboard 数据接入

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. 派生 hook

- [x] 1.1 `src/stores/hooks/useDashboardStats.ts` → `useDashboardStats(): DashboardStats | undefined`
  - 4 个数字：monthlyCompletionRate / activePlans / completedItems / publishedBlogs
  - 内部用 `useMemo` 包一次
- [x] 1.2 `src/stores/hooks/useTodayFocus.ts` → `useTodayFocus(): { plan, remaining, progress } | undefined`
  - 选 plan 策略：red > orange > 最近 doing
  - items 由组件二次调 `useItemsForPlan(plan.id)`（见 design §3.2.1）
- [x] 1.3 `src/stores/hooks/useUpcomingPlans.ts` → `useUpcomingPlans(limit = 3): UpcomingPlan[] | undefined`
  - 按 `urgency` 升序 + `endDate` 升序
  - v1.0 简化：itemProgress 留空（Sprint 2 接入 useItemsForPlan 后再加）
- [x] 1.4 `src/stores/hooks/useRecentBlogs.ts` → `useRecentBlogs(limit = 3): Blog[] | undefined`
  - `status === 'published'`，按 `publishedAt desc`
- [x] 1.5 `src/stores/hooks/useRecentActivity.ts` → `useRecentActivity(limit = 4): Activity[] | undefined`
  - plans + blogs 合并，按 `updatedAt desc`
  - 调用 `formatRelativeTime` 渲染「X 前」

## 2. 工具函数

- [x] 2.1 `src/shared/utils/format.ts` 追加 `formatRelativeTime(iso: ISODate, now?: number): string`
  - 「刚刚 / N 分钟前 / N 小时前 / 昨天 HH:mm / N 天前 / M月D日」
  - 不引第三方（dayjs / date-fns）

## 3. Dashboard 改造

- [x] 3.1 `src/pages/Dashboard.tsx` 删除 5 个 mock 常量：`STATS` / `TODAYS_FOCUS` / `RECENT_BLOGS` / `UPCOMING` / `ACTIVITIES`
- [x] 3.2 替换为 5 个 hook：`useDashboardStats` / `useTodayFocus` + `useItemsForPlan` / `useUpcomingPlans` / `useRecentBlogs` / `useRecentActivity`
- [x] 3.3 4 个数字卡的渲染逻辑改读 `stats.*`
- [x] 3.4 今日聚焦卡片改读 `focus.plan.title` + `focusItems.slice(0, 4)`
- [x] 3.5 即将到期改读 `upcoming.map(...)`
- [x] 3.6 最近博客改读 `recentBlogs.map(...)`
- [x] 3.7 最近活动改读 `activities.map(...)`
- [x] 3.8 保留视觉 / 颜色 / 动画 delay / icon / layout 100% 一致

## 4. 加载 / 空状态

- [x] 4.1 首帧 `undefined` → 渲染 `DashboardSkeleton`（4 个灰卡 + 3 个 section 灰占位）
- [x] 4.2 `stats.activePlans === 0` → 渲染 `EmptyDashboard`（欢迎语 + CTA「新建计划」→ `navigate('/plans/new')`）
- [x] 4.3 部分空（如无 blog）→ 对应 section 显示「还没有博客，去写一篇 →」

## 5. 验证

- [x] 5.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 5.2 `pnpm dev` 启动后 Dashboard 页面 4 个数字卡显示「0」+ 骨架屏 → 真实数据 流畅切换
- [x] 5.3 DevTools Console 验证：
  ```js
  // 创建 1 条 plan
  const { planRepo } = await import('/src/db/repos/index.ts');
  await planRepo.create({ title: '测试计划', description: '', level: 'short', timeDim: 'daily', tagIds: [], itemIds: [], blogIds: [], childPlanIds: [] });
  // 刷新页面 → 「进行中的计划」= 1
  ```
- [x] 5.4 在 DevTools 删除所有 IndexedDB 后刷新 → 显示 EmptyDashboard
- [x] 5.5 `openspec validate add-data-binding-dashboard --strict` 通过

## 6. 文档

- [x] 6.1 `src/pages/Dashboard.tsx` 顶部加注释：mock 已删除，所有数据来自 useLiveQuery hook
- [x] 6.2 `src/stores/hooks/useTodayFocus.ts` 顶部加注释：选 plan 策略详见 design.md §3.2

## 7. 提交与归档

- [x] 7.1 项目尚未 git init，留给用户
- [x] 7.2 `openspec archive add-data-binding-dashboard --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（4 数字卡真实）| 3.3 + 5.2 | 浏览器访问 |
| AC-2（activePlans 计算正确）| 1.1 + 5.3 | 创 1 条 → 数字 = 1 |
| AC-3（publishedBlogs 计算正确）| 1.1 + 5.3 | 类似 |
| AC-4（聚焦计划按紧急度选）| 1.2 | 创 red + orange plan 各 1 条 |
| AC-5（聚焦卡片 3-4 条 item）| 3.4 | 创 plan + 3 items |
| AC-6（即将到期按紧急度排序）| 1.3 + 3.5 | 创不同 urgency 的 plan |
| AC-7（最近博客 3 条 published）| 1.4 + 3.6 | 创 5 条 blog 各种 status |
| AC-8（最近活动 4 条）| 1.5 + 3.7 | 类似 |
| AC-9（创建后立即更新）| 5.3 | console + 刷新 |
| AC-10（勾选 item 后完成率 +1）| 1.1 | console 调 `itemRepo.toggle` + 刷新 |
| AC-11（undefined 骨架屏）| 4.1 | dev 模式首帧 |
| AC-12（无 plan 空状态）| 4.2 + 5.4 | 清库后 |
| AC-13（build 0 error）| 5.1 | pnpm build |
| AC-14（openspec validate）| 5.5 | CLI |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（5 派生 hook）| 0.6 | 平均每 hook 0.12，useMemo + sort |
| 2（formatRelativeTime）| 0.1 | 单函数 |
| 3（Dashboard 改造）| 0.5 | 改 mock → 真实数据；视觉 100% 保留 |
| 4（加载 / 空状态）| 0.3 | 2 个新组件 |
| 5（验证）| 0.2 | 手动跑通 + 截图 |
| 6（文档）| 0.05 | 注释 |
| **合计** | **1.75 人天** | 与 roadmap T-009/T-010 工时匹配 |
