# Design · 计划详情页

> 本文档回答**「详情页布局如何分层、勾选如何联动进度、100% 横幅如何触发、抽屉如何与 store 协作」**。
> 不重复 `architecture.md` 已写的内容，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 进度环 | 原生 SVG circle + stroke-dasharray | 库（react-circular-progressbar） | 零依赖、视觉与 prototype 完全一致、100 行代码可控 |
| 抽屉 | 自研 Drawer（div + transform） | Headless UI / Radix | 已有 `useUIStore.drawerStack` 栈式管理，自研 60 行即可 |
| 事项勾选 | 原生 checkbox + 自定义样式 | Radix Checkbox | Tailwind 完全可控视觉对齐 |
| 100% 横幅状态 | sessionStorage（per-session dismiss） | 全局状态 | 「已关闭」是用户当前操作的临时意图，刷新后希望重新看到 |
| 关联博客拉取 | `useBlog(id)` 逐个订阅 | 一次性 listByIds | 当前 plan 的 blogIds 通常 0-3 个，逐个订阅更精准 |
| 路由直达 | `useParams<{ id: string }>()` | 解析 query | 严格匹配 `add-app-shell` 已建路由模式 |

---

## 2. 关键架构决策

### 2.1 详情页布局层级

```
<PlanDetail>
  ├ CompletionBanner (100% 触发)
  ├ TopBar (返回 + 标题 + badges + 编辑)
  ├ Hero (左：ProgressRing | 右：PlanKeyMetrics)
  ├ ItemChecklist (事项勾选)
  ├ PlanBlogsSection (关联博客)
  └ FrameworkDrawer (全局挂载，由 useUIStore.drawerStack 触发)
```

**为什么用「Hero 左右分栏」**：
- 进度环是视觉焦点（160px 大环）
- 关键数据放右侧补足信息密度（5 个数据点）
- prototype plan-detail.html 已验证此布局

**为什么抽屉全局挂载而不是详情页内**：
- 抽屉是 z-index 栈式管理（`useUIStore.drawerStack`）
- 全局挂载确保路由切换时抽屉仍能正确关闭
- 与「Dashboard → 设置」等其他抽屉入口复用同一 Drawer 壳

### 2.2 勾选 → 进度联动的时序

```ts
function useToggleItem(planId: ID) {
  const toggle = useItemStore((s) => s.toggle);
  const recompute = usePlanStore((s) => s.recomputeProgress);
  const debounceRef = useRef<number | null>(null);

  return useCallback(
    async (itemId: ID) => {
      // 1) 立即乐观更新（useItemStore.toggle 内部已 fire-and-forget）
      await toggle(itemId);
      // 2) 防抖重算 progress（用户连点 5 次只算 1 次）
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        void recompute(planId);
      }, 200);
    },
    [toggle, recompute, planId],
  );
}
```

**为什么用 200ms debounce**：
- 用户连续勾选 5 个事项，只触发 1 次 progress 重算
- 200ms 是「用户连续操作」的典型感知阈值（< 200ms 用户感觉不到延迟）
- Plan.progress 字段写回后，useLiveQuery 自动推送 → 进度环 200ms 内更新

**为什么不用乐观 UI 但同步等 recompute**：
- 事项勾选本身已 fire-and-forget（user 看到 UI 立即变）
- progress 字段延迟 200ms 是可接受的（用户不会盯着数字看）
- 避免每个勾选都同步重算导致 Dexie 写放大

### 2.3 进度环 SVG 算法

```ts
const R = 70; // 半径（size=160 → R=70）
const C = 2 * Math.PI * R; // 周长 ≈ 439.82
const pct = clamp(value, 0, 100);
const offset = C * (1 - pct / 100);
// strokeDasharray={C}
// strokeDashoffset={offset}
```

**视觉细节**：
- 底层圆：`stroke="#e7e5e4"` (stone-200) 静态
- 顶层圆：`stroke={colorByPct(pct)}` 动态
  - 0-49% → stone-700
  - 50-99% → brand-900
  - 100% → emerald-500 + 0.3s 动画（stroke 出现 0 → 360°）
- 中心数字：`<text>` 居中 + 大字号
- 旋转：`transform="rotate(-90)"` 让 0% 在 12 点钟方向

### 2.4 100% 完成横幅触发与降噪

```ts
const BANNER_DISMISSED_KEY = 'planote:plan-detail:banner-dismissed';

function useShouldShowBanner(plan: Plan): boolean {
  const [dismissed, setDismissed] = useState(() => {
    return new Set(JSON.parse(sessionStorage.getItem(BANNER_DISMISSED_KEY) ?? '[]'));
  });
  // 当 plan 改变（导航到另一个 plan）时清空 dismissed
  useEffect(() => {
    if (plan.progress >= 100 && !dismissed.has(plan.id)) {
      return true;
    }
    return false;
  }, [plan, dismissed]);

  const dismiss = useCallback((planId: ID) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(planId);
      sessionStorage.setItem(BANNER_DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return [shouldShow, dismiss] as const;
}
```

**为什么用 sessionStorage 而非 useUIStore 持久化**：
- 横幅是「本次会话的临时意图」
- 关闭后用户去干别的，刷新页面后希望再次看到（鼓励用户「总结博客」）
- localStorage 持久化会让横幅永远消失（v1.0 留升级空间）
- 不同 plan 互不干扰：Set 存 planId 列表

**为什么用 planId 区分而不是全局开关**：
- 用户可能同时操作多个 plan（开了多个 tab 或快速切换）
- 按 planId 关闭是更精细的颗粒度

### 2.5 抽屉与 useUIStore.drawerStack 协作

```ts
// 详情页 CTA 点击
function handleGenerateBlog() {
  useUIStore.getState().openDrawer('framework', { sourcePlanId: plan.id });
}

// 抽屉组件全局挂载（在 AppLayout 顶部）
function FrameworkDrawerHost() {
  const stack = useUIStore((s) => s.drawerStack);
  const frameworkEntry = stack.find((d) => d.id === 'framework');
  if (!frameworkEntry) return null;
  return <FrameworkDrawer {...(frameworkEntry.props as { sourcePlanId: ID })} />;
}
```

**为什么 entry.props 强转 sourcePlanId**：
- `drawerStack: DrawerEntry[]` 是 generic（props: unknown）
- 详情页和未来其他入口可传入不同 props
- 在使用处 `as` 强转是单点污染（feature-level type assertion），比泛型化 store 简单

**为什么不实现完整博客生成流程**：
- v1.0 简化：选框架 → console.log → 关闭抽屉
- v1.1 `add-blog-generation-flow` 接入 Tiptap 编辑器
- 不在本 change 范围

### 2.6 关联博客拉取策略

```ts
// 简单方案：useLiveQuery 一次性拉
function usePlanBlogs(plan: Plan): Blog[] | undefined {
  return useLiveQuery(async () => {
    if (plan.blogIds.length === 0) return [];
    return await blogRepo.listByIds(plan.blogIds);
  }, [plan.blogIds]);
}
```

**为什么用 listByIds 而非逐个 useBlog(id)**：
- blogRepo.listByIds 已存在（add-data-layer-dexie 实现）
- 一次性订阅更高效（一次 Dexie 查询 vs N 次）
- blogIds 数量小（0-3），即使为空数组也安全

**为什么不缓存到 PlanStore**：
- 详情页 hook 是页面级订阅，离开页面自动取消订阅
- 缓存到 store 会增加心智负担（store 维护中间副本）
- 派生数据走 hook 是 v1.0 一贯原则

### 2.7 ID 不存在时的处理

```ts
function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const plan = usePlan(id);
  
  if (plan === undefined) return <PlanDetailSkeleton />; // 加载中
  if (plan === null) return <NotFoundView />; // ID 不存在
  return <PlanDetailContent plan={plan} />;
}
```

**为什么用 `null` 而非 throw**：
- `usePlan(id)` 在 plan 不存在时返回 null（已存在的语义）
- 详情页用条件渲染而非 ErrorBoundary（更轻量）
- 与列表页「空态」一致用 EmptyState

---

## 3. 组件详细设计

### 3.1 ProgressRing

```tsx
interface Props {
  value: number;          // 0-100
  size?: number;          // 默认 160
  strokeWidth?: number;   // 默认 8
  showLabel?: boolean;    // 默认 true（中心数字 + "完成度"）
  /** 100% 触发动画（默认 true） */
  animate?: boolean;
}
```

- 单 SVG 内 2 个 `<circle>`（底层 + 顶层）
- 顶层用 `transform="rotate(-90)"` + `transform-origin="center"` 让起点在 12 点
- 100% 时 `animate` class 触发 stroke 0→C 动画（CSS @keyframes）

### 3.2 CompletionBanner

```tsx
interface Props {
  planId: ID;
  /** 100% 触发条件：plan.progress >= 100 */
  visible: boolean;
  onDismiss: () => void;
  onGenerateBlog: () => void;
}
```

- 视觉：amber-50 背景 + 左侧 4px 琥珀色边 + Sparkles icon + 主标题 + 副标题 + 主 CTA + X 关闭
- 关闭按钮：调 `onDismiss`（由 useShouldShowBanner 提供）

### 3.3 PlanKeyMetrics

```tsx
interface Metric {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  color?: 'brand' | 'emerald' | 'amber' | 'blue';
}

interface Props {
  plan: Plan;
  completedItems: number;
  totalItems: number;
}
```

- 5 个数据点的 MetricCard 网格（grid-cols-5 gap-3）
- 「坚持天数」：v1.0 简化为 `Math.floor((Date.now() - new Date(plan.createdAt)) / 86400e3)`
- 「剩余天数」：复用 `formatEnd(plan.endDate)` 工具
- 「关联博客数」：`plan.blogIds.length` + 点击进入 PlanBlogsSection

### 3.4 ItemChecklist + ItemRow

```tsx
interface ItemRowProps {
  item: Item;
  onToggle: (id: ID) => void;
  onSetStatus: (id: ID, status: ItemStatus) => void;
}
```

- 单行布局：左 checkbox（自定义样式 18px 圆角）+ 中标题 + 右 hover 状态切换按钮
- 状态视觉：
  - `pending`：checkbox 空 + 标题白底
  - `doing`：checkbox 半填充 + 标题左侧 2px 蓝边
  - `done`：checkbox 填 emerald + 标题 line-through + 灰色
- hover 时显示「标记进行中」/「标记待办」按钮（与 prototype 一致）
- 排序：按 `order asc`（Dexie 复合索引已支持）

### 3.5 PlanBlogsSection

```tsx
interface Props {
  blogIds: ID[];
}
```

- 卡片网格：3 列（与 Dashboard 一致）
- 单卡：封面占位（gradient）+ 标题（line-clamp-2）+ 日期
- 整体为 `<Card>` 容器 + 标题栏 + 「+ 生成博客」按钮（hover 时显示）
- 空态：EmptyState compact + 「生成总结博客」CTA

### 3.6 Drawer（通用）

```tsx
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 抽屉宽度；默认 480 */
  width?: number;
}
```

- 视觉：右侧滑入 + 背景黑色/30 遮罩 + ESC 监听 + 背景点击关闭
- 动画：`transform translateX(100%)` → `translateX(0)` + `transition-transform 300ms`
- a11y：`role="dialog"` + `aria-modal="true"` + 焦点陷阱（v1.0 简化：仅首次打开聚焦标题）

### 3.7 FrameworkDrawer

```tsx
interface Props {
  sourcePlanId: ID;
  onClose: () => void;
}
```

- 复用 Drawer 壳
- 内部：标题「选择博客框架」+ 4 卡片（项目复盘 / 21天习惯 / 读书笔记 / 月度总结）
- 选框架 → console.log(`[v1.1] generate blog from plan ${sourcePlanId} with framework ${fwId}`) + onClose()

---

## 4. 集成方案

### 4.1 useItemStore 已有 toggle 行为

本 change 不修改 `useItemStore.toggle`（add-zustand-stores 已实现）。只在 `useToggleItem` 包装 debounce + recompute。

### 4.2 usePlanStore.recomputeProgress 行为

本 change 不修改该 action。调用即可，已存在。

### 4.3 useUIStore 增量

本 change **不修改** useUIStore（add-plan-list-view 已加 `planListView` 字段）。复用现有 `openDrawer('framework', props)` / `closeDrawer('framework')` / `closeAllDrawers`。

### 4.4 AppLayout 增量挂载

在 `src/components/layout/AppLayout.tsx` 中挂载 `FrameworkDrawerHost`（一次，全局）：

```tsx
return (
  <div className="flex h-screen overflow-hidden">
    <Sidebar />
    <div className="flex-1 flex flex-col">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
    <FrameworkDrawerHost />
  </div>
);
```

### 4.5 sessionStorage key 命名约定

`planote:plan-detail:banner-dismissed` 形如 `planote:<feature>:<key>`，与现有 `planote-ui` 区分。

---

## 5. 边界与测试场景

### 5.1 进度环边界

```ts
<ProgressRing value={0} />     // 0%  圆空
<ProgressRing value={50} />    // 50% 半圆
<ProgressRing value={100} />   // 100% 满圆 + 动画
<ProgressRing value={-10} />   // 兜底为 0
<ProgressRing value={150} />   // 兜底为 100
```

### 5.2 勾选联动时序

```
t=0ms    用户点 checkbox
t=0ms    UI 立即反映（item.status = 'done'）
t=0ms    itemRepo.toggle 异步启动
t=50ms   itemRepo.toggle 完成（Dexie 写入）
t=200ms  recomputeProgress 完成（debounce 后）
t=200ms  useLiveQuery 推送新 plan（含新 progress）
t=200ms  进度环 SVG 重新计算 offset
```

### 5.3 100% 横幅边界

```ts
// 进度从 99% 跳到 100%（最后一个事项勾上）
plan.progress === 100 → 横幅出现

// 用户关闭横幅
sessionStorage['planote:plan-detail:banner-dismissed'] 包含当前 planId
// 横幅消失，但 progress 仍为 100%

// 用户切换到另一个 plan（不同 ID）
横幅 dismissed 集合不含新 planId → 新 plan 如果 100% 也会显示

// 用户刷新页面
sessionStorage 清空 → 所有 plan 的 100% 都会重新显示（设计意图）
```

### 5.4 抽屉状态边界

```ts
// 打开：openDrawer('framework', { sourcePlanId: '01H...' })
// → drawerStack.push({ id: 'framework', props: { sourcePlanId: '01H...' } })
// → FrameworkDrawerHost 渲染

// 关闭：closeDrawer('framework') 或 ESC
// → drawerStack.filter(d => d.id !== 'framework')
// → FrameworkDrawerHost 不渲染

// 路由切换：closeAllDrawers() 在 useEffect cleanup 中调用
// → drawerStack = []
```

### 5.5 关联博客空态

```ts
plan.blogIds.length === 0 → PlanBlogsSection 显示空态
plan.blogIds.length > 0 → 显示卡片网格
plan.blogIds[i] 不存在（被删除）→ listByIds 内部过滤（dexie.bulkGet 跳过 undefined）
```

---

## 6. 不在本 change 范围

- 编辑/创建表单（`add-plan-edit-form`）
- 生成博客的 Tiptap 流程（v1.1 `add-blog-generation-flow`）
- 事项的增删改（`add-item-crud`，v1.0 只做勾选状态切换）
- 事项拖拽排序（v1.1）
- 自定义框架（v1.2）
- 评论 / 协作（v2.0+）
- 焦点陷阱完整实现（v1.0 简化）
- 单元测试（Sprint 1-2 不强制）
- 100% 横幅的 localStorage 持久化（v1.0 简化）
