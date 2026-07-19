# Design · Dashboard 数据接入

> 本文档回答**「Dashboard 怎么从 mock 切到真实数据、派生计算放哪里、加载/空状态如何处理」**。
> 不重复 `architecture.md` 已写的内容，仅补充本 change 的具体决策。

---

## 1. 选型复述（来自 architecture §1 / §5.4，本 change 不再争议）

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 数据源 | `useLiveQuery` 读 store hook | `useEffect` + `useState` | 实时、自动重渲染、跨 Tab 同步 |
| 派生位置 | 专用 hook + `useMemo` | store state / inline 函数 | store 不持有实体数据；hook 复用且可单测 |
| 加载状态 | 骨架屏（Card 尺寸占位） | spinner | 与 prototype 视觉一致 |
| 空状态 | CTA「创建你的第一个计划」| 空网格 | 引导用户行动 |
| 时间格式化 | `formatRelativeTime(iso)` 工具 | dayjs / date-fns | 单文件 30 行，无依赖 |

---

## 2. 关键架构决策：派生放 hook，不放 store

### 2.1 反模式

```ts
// ❌ 在 store state 缓存派生数据
const usePlanStore = create<{
  stats: { activePlans: number; publishedBlogs: number; ... };
  recomputeStats: () => Promise<void>;
}>(...);
```

**问题**：
1. 写 plan / blog 后必须手动调 `recomputeStats()`，容易漏
2. 双源真相（stats vs plans 数组可能不一致）
3. 1000 条 plans 时 store state 内存压力

### 2.2 正解（本次实现）

```ts
// ✅ 派生放 hook，内部用 useMemo
export function useDashboardStats(): DashboardStats | undefined {
  const plans = usePlans();
  const blogs = useBlogs();
  return useMemo(() => {
    if (plans === undefined || blogs === undefined) return undefined;
    // ... 派生 4 个数字
    return { monthlyCompletionRate, activePlans, completedItems, publishedBlogs };
  }, [plans, blogs]);
}
```

**收益**：
1. 派生随 `usePlans()` / `useBlogs()` 自动重算
2. 单源真相（plans 数组）
3. 内存轻：派生只在 hook 调用时算，不存 store

---

## 3. 4 个派生 hook 详细设计

### 3.1 `useDashboardStats`

```ts
// src/stores/hooks/useDashboardStats.ts
export interface DashboardStats {
  /** 本月完成率（0-100）：本月 plans 已勾选 item / 总 item。v1.0 简化为全量平均 */
  monthlyCompletionRate: number;
  /** 进行中的计划：status != 'done' && status != 'paused' 的 plan 数 */
  activePlans: number;
  /** 本月完成事项数 + 累计完成事项数（v1.0 简化为总数） */
  completedItems: { thisMonth: number; total: number };
  /** 已发布博客数：status === 'published' 的 blog 数 */
  publishedBlogs: number;
}

export function useDashboardStats(): DashboardStats | undefined {
  const plans = usePlans();
  const blogs = useBlogs();
  // 需 items 列表来算 completionRate → useItemsForPlan 多 plan 不行，改成
  // 复用 plan.progress（已由 PlanRepo.recomputeProgress 缓存）
  // ...
}
```

**关键决策**：`monthlyCompletionRate` 不再逐 item 重算（太慢），复用 `plan.progress` 字段已缓存值。

```ts
// 简化为：所有 plan 的 progress 平均
const avgProgress = plans.length === 0
  ? 0
  : Math.floor(plans.reduce((sum, p) => sum + p.progress, 0) / plans.length);
```

### 3.2 `useTodayFocus`

```ts
// src/stores/hooks/useTodayFocus.ts
export interface TodayFocus {
  plan: Plan;
  items: Item[];        // 前 4 个
  remaining: number;     // 未完成 item 数
  progress: number;      // 0-100
}

export function useTodayFocus(): TodayFocus | undefined {
  const plans = usePlans();
  return useMemo(() => {
    if (plans === undefined) return undefined;
    // 1. 选 plan：red > orange > 最近 doing
    const sorted = [...plans].sort((a, b) => {
      const rank = { red: 0, orange: 1, yellow: 2, none: 3 };
      if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
      if (a.status === 'doing' && b.status !== 'doing') return -1;
      if (b.status === 'doing' && a.status !== 'doing') return 1;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
    const plan = sorted[0];
    if (!plan) return undefined;
    // 2. 拉 items（liveQuery 不能 inline 调，所以这里接受 planId 作为依赖）
    // ... 见实现细节 §3.2.1
  }, [plans]);
}
```

#### 3.2.1 实现细节：派生 hook 嵌套 useLiveQuery 的问题

`useTodayFocus` 需要先选 plan 再拉 items，但 hook 不能**条件式**调 `useLiveQuery`（hooks 规则）。

**方案 A**：返回 `plan` 即可，items 由组件二次调 `useItemsForPlan(plan.id)`。
- 优点：单一职责
- 缺点：组件多一行

**方案 B**：hook 内部接受 `planId: ID | null` 参数，由父组件根据 plans 算出 planId 后传入。
- 优点：派生完整封装
- 缺点：参数流稍绕

**本 change 采用方案 A**，与 architecture §5.4「派生数据走 selector」原则一致。

```tsx
function TodayFocusCard() {
  const focus = useTodayFocus();        // 只返回 plan
  const items = useItemsForPlan(focus?.plan.id);  // 组件二次拉
  if (!focus || !items) return <Skeleton />;
  return <Card>...</Card>;
}
```

### 3.3 `useUpcomingPlans`

```ts
// src/stores/hooks/useUpcomingPlans.ts
export interface UpcomingPlan {
  plan: Plan;
  itemProgress: { completed: number; total: number };  // 需 items 才能算
  daysLeft: number;       // 距 endDate 的天数
  urgency: UrgencyLevel;  // 直接读 plan.urgency
}

export function useUpcomingPlans(limit = 3): UpcomingPlan[] | undefined {
  const plans = usePlans();
  return useMemo(() => {
    if (plans === undefined) return undefined;
    const now = Date.now();
    return plans
      .filter(p => p.endDate && p.status !== 'done' && p.status !== 'paused')
      .filter(p => daysBetween(now, p.endDate!) >= 0)  // 未过期
      .sort((a, b) => {
        const rank = { red: 0, orange: 1, yellow: 2, none: 3 };
        if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
        return new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime();
      })
      .slice(0, limit)
      .map(plan => ({
        plan,
        itemProgress: { completed: 0, total: 0 },  // v1.0 简化：留给后续接 items
        daysLeft: daysBetween(now, plan.endDate!),
        urgency: plan.urgency,
      }));
  }, [plans, limit]);
}
```

**简化说明**：v1.0 Dashboard 不显示「X/Y 完成」进度（UPCOMING mock 里的「1/5 完成」），等 Sprint 2 接入 useItemsForPlan 后再加。

### 3.4 `useRecentActivity`

```ts
// src/stores/hooks/useRecentActivity.ts
export type ActivityKind = 'plan_created' | 'plan_updated' | 'blog_published' | 'blog_updated';

export interface Activity {
  id: string;
  kind: ActivityKind;
  text: string;          // 渲染好的 ReactNode 文案
  time: ISODate;         // updatedAt
  relativeTime: string;  // 「2 小时前」
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}

export function useRecentActivity(limit = 4): Activity[] | undefined {
  const plans = usePlans();
  const blogs = useBlogs();
  return useMemo(() => {
    if (plans === undefined || blogs === undefined) return undefined;
    const items: Activity[] = [
      ...plans.map(p => ({
        id: `plan:${p.id}`,
        kind: p.status === 'done' ? 'plan_updated' : 'plan_created',
        text: `${p.status === 'done' ? '完成了' : '更新了'} ${p.title}`,
        time: p.updatedAt,
        relativeTime: formatRelativeTime(p.updatedAt),
        color: p.status === 'done' ? 'emerald' : 'amber',
      })),
      ...blogs.map(b => ({
        id: `blog:${b.id}`,
        kind: b.status === 'published' ? 'blog_published' : 'blog_updated',
        text: `${b.status === 'published' ? '发布了博客' : '编辑了博客'} ${b.title}`,
        time: b.updatedAt,
        relativeTime: formatRelativeTime(b.updatedAt),
        color: b.status === 'published' ? 'blue' : 'purple',
      })),
    ];
    return items
      .sort((a, b) => a.time < b.time ? 1 : -1)
      .slice(0, limit);
  }, [plans, blogs, limit]);
}
```

---

## 4. 加载 / 空状态

### 4.1 加载状态（首帧 undefined）

```tsx
function Dashboard() {
  const stats = useDashboardStats();
  const focus = useTodayFocus();
  const items = useItemsForPlan(focus?.plan.id);
  const upcoming = useUpcomingPlans();
  const recentBlogs = useRecentBlogs(3);
  const activities = useRecentActivity();

  // 任一关键数据未就绪 → 渲染骨架
  if (stats === undefined || focus === undefined || upcoming === undefined
      || recentBlogs === undefined || activities === undefined) {
    return <DashboardSkeleton />;
  }
  // ...
}
```

骨架屏：与现有 4 个数字卡 + 3 个 section 尺寸一致的灰色占位。

### 4.2 空状态

```tsx
if (stats && stats.activePlans === 0) {
  return <EmptyDashboard onCreate={() => navigate('/plans/new')} />;
}
```

空状态文案：
- 大标题「欢迎来到 Planote 👋」
- 副标题「创建你的第一个计划，让目标开始流动」
- CTA 按钮「新建计划」

### 4.3 部分空

- 有 plans 但无 blogs → 「最近博客」section 显示空状态文案（不影响主区）
- 有 blogs 但无 plans → 「进行中的计划」数字 = 0，但布局不崩

---

## 5. 时间格式化工具

```ts
// src/shared/utils/format.ts（追加，不新建文件）
export function formatRelativeTime(iso: ISODate, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 0) return '刚刚';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
```

复用 `src/lib/utils.ts` 现有的 `formatChineseDate` 风格（中文文案）。

---

## 6. Dashboard 改造 diff 摘要

```diff
- const STATS = [...]
- const TODAYS_FOCUS = {...}
- const RECENT_BLOGS = [...]
- const UPCOMING = [...]
- const ACTIVITIES = [...]

+ const stats = useDashboardStats();
+ const focus = useTodayFocus();
+ const focusItems = useItemsForPlan(focus?.plan.id);
+ const upcoming = useUpcomingPlans(3);
+ const recentBlogs = useRecentBlogs(3);
+ const activities = useRecentActivity(4);
+
+ if (stats === undefined || focus === undefined || ...) return <DashboardSkeleton />;
+ if (stats.activePlans === 0) return <EmptyDashboard />;
```

布局、颜色、动画、icon 完全不变。

---

## 7. 不在本 change 范围

- 完成提醒横幅接数据（Sprint 2 计划模块）
- 数字卡点击跳转
- 5 种数字之外的指标（v1.1 仪表盘增强）
- 数字缓存到 IndexedDB
- 拖拽 / 撤销 / 重做
- 单元测试（v1.0 Sprint 1-2 暂不强制）
