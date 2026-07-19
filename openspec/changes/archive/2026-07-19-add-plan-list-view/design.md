# Design · 计划列表页（3 视图 + 智能排序 + 搜索）

> 本文档回答**「3 种视图如何共存、智能排序如何实现、搜索如何与排序协作、路由懒加载如何衔接」**。
> 不重复 `architecture.md` 已写的内容，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 排序实现 | Zustand selector + 纯函数 | 写入字段缓存 | 派生数据走 selector（project.md §3.2 约束 #3），避免污染 plan-data schema |
| 搜索实现 | `useMemo` + `String.includes` | MiniSearch / Lunr | v1.0 子串匹配够用；v1.1 引入 MiniSearch 倒排索引 |
| 表格库 | TanStack Table v8 | AG Grid / 自研 | 已在 package.json；headless 与 Tailwind 集成好 |
| 虚拟滚动 | react-virtuoso | react-window | 已在 package.json；动态高度支持好 |
| 视图切换器 | 3 按钮胶囊容器 | 下拉菜单 | 3 个选项用按钮更直接，符合「密度自适配」原则 4 |
| 视图状态持久化 | `useUIStore` + persist | URL query | URL 方案需要 router 改造，localStorage 复用现有 store |
| 折叠阈值 | 每组前 5 个 | 用户配置 | prototype 默认值，符合「克制而确定」原则 5 |

---

## 2. 关键架构决策

### 2.1 三视图共享一个数据 pipeline

```
useLiveQuery(() => planRepo.list())
  ↓
useSortedPlans(plans)         ← 智能排序
  ↓
usePlanSearch(sorted, query)  ← 搜索过滤
  ↓
[GroupedView | AllView | TableView]  ← 仅切渲染分支
```

**为什么不在每个视图里独立做排序**：
- 切换视图时数据已就绪，0 重算
- 3 视图对「已排序」数据的展示约定一致（避免切换时视觉跳动）
- 搜索与排序正交（搜索后保留排序）

**为什么用 `useSortedPlans` / `usePlanSearch` 而非 store action**：
- 派生数据走 selector（project.md §3.2 #3）
- 搜索/排序参数（query、viewMode）变化时只重渲染依赖的视图组件
- 避免在 store 里维护「中间结果」副本（增加心智负担）

### 2.2 智能排序公式（4 关键字）

```ts
function sortPlans(plans: Plan[]): Plan[] {
  const urgencyRank: Record<UrgencyLevel, number> = {
    red: 0, orange: 1, yellow: 2, none: 3,
  };
  return [...plans].sort((a, b) => {
    // 主：紧急度升序（红在前）
    const ua = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (ua !== 0) return ua;
    // 次：进度降序（高进度优先）
    const pa = b.progress - a.progress;
    if (pa !== 0) return pa;
    // 三：endDate 升序（无 endDate 排最后）
    const ea = a.endDate ? (b.endDate ? a.endDate.localeCompare(b.endDate) : -1) : 1;
    if (ea !== 0) return ea;
    // 四：createdAt 降序
    return b.createdAt.localeCompare(a.createdAt);
  });
}
```

**为什么用 4 关键字而非 2**：
- 仅 urgency + progress 不足以解决 tie（多个相同紧急度+进度的 plan 排序不稳定）
- endDate 升序给用户「更早到期的优先」的预期（即便 progress 高但 30 天后到期的也不该挤掉今天到期的）
- createdAt 降序保证「新建 plan 总在前」是大多数用户的隐含预期

### 2.3 表格视图覆盖智能排序

```ts
// 表格视图的 useReactTable 配置
const table = useReactTable({
  data: sortedPlans,  // 输入仍是智能排序后的数据
  columns,
  state: { sorting },  // 列头点击更新 sorting 状态
  onSortingChange: setSorting,
  getSortedRowModel: getSortedRowModel(),
});
```

**为什么「覆盖」而非「叠加」**：
- 用户点击列头 = 明确表达「我要按这个排」
- 智能排序仅在用户未主动排序时生效（`sorting.length === 0` 时回退到智能排序）
- 避免「我点列头了但还是按紧急度排」的认知冲突

**视觉反馈**：
- 表格列头右侧 `▲` / `▼` icon 指示当前排序
- 切换视图到「表格」时，列头排序优先级最高（即使之前有智能排序）
- 切换回「分组」/「全部」时恢复智能排序

### 2.4 视图切换状态持久化

```ts
// useUIStore 增量
interface UIState {
  // ... 已有字段
  planListView: 'group' | 'all' | 'table';
  setPlanListView: (v: 'group' | 'all' | 'table') => void;
}

// persist 中间件自动写入 localStorage
```

**为什么不用 URL query（`?view=table`）**：
- React Router 6 query string 改造需要 router 二次封装
- 视图偏好是「用户操作习惯」，不像「筛选条件」那样需要分享
- localStorage 持久化是 `add-zustand-stores` 已建的能力，零成本复用

**回退方案**：URL query 留给 v1.1（彼时引入深链分享功能时一起做）

### 2.5 视图切换 vs Suspense 的关系

复用 `add-app-shell` 已建好的 `<Suspense>` + `<LoadingOverlay>` 体系：

- 路由级（`/plans` 切换进来）：LoadingOverlay 走 chunk 加载
- 视图级（group/all/table 切换）：**不**走 Suspense，3 视图组件都在同一个 chunk 内（同一个 `PlanList.tsx`），切换仅改 state

**为什么 3 视图不拆 chunk**：
- 视图组件共享大量子组件（PlanCard / ProgressRing / Tag 等）
- 拆 chunk 反而导致切视图时 LoadingOverlay 闪一下（违背设计意图）
- 3 视图打包约 8-10KB，整体加载可在 100ms 内完成

---

## 3. 组件详细设计

### 3.1 PlanViewSwitcher

```tsx
type PlanViewMode = 'group' | 'all' | 'table';

interface Props {
  value: PlanViewMode;
  onChange: (v: PlanViewMode) => void;
}

// 视觉：3 按钮胶囊容器（白底圆角 + 内嵌按钮切换）
// 选中态：bg-brand-900 text-white
// 未选中：text-brand-500 hover:bg-stone-100
```

### 3.2 PlanCard（3 视图共用）

```tsx
interface Props {
  plan: Plan;
  /** 'full' = 大卡（分组视图） / 'compact' = 紧凑行（全部视图） / 'table-row' = 表格单元格（表格视图） */
  density?: 'full' | 'compact' | 'table-row';
  /** 紧急度左边框颜色（red/orange/yellow/none） */
  urgencyBorder?: boolean;
}
```

- `full`：标题 + 描述（line-clamp-2）+ 进度条 + 标签 + 起止日期 + 右侧状态 badge
- `compact`：单行 + 进度环（24px）+ 标题 + 紧急度 tag
- `table-row`：6 列单元格，由 TanStack Table 渲染

### 3.3 PlanGroupCollapse

```tsx
interface Props {
  title: string;       // "短期"
  count: number;       // 组内总数
  children: ReactNode; // 实际卡片
  threshold?: number;  // 默认 5
}
```

- 折叠时：显示前 5 个 + 「展开剩余 N 个」虚线按钮
- 展开时：显示全部 + 「收起」按钮
- 折叠状态**不持久化**（每次进入页面重置为折叠）

### 3.4 useSortedPlans hook

```ts
function useSortedPlans(plans: Plan[] | undefined): Plan[] | undefined {
  return useMemo(() => {
    if (!plans) return undefined;
    return sortPlans(plans);
  }, [plans]);
}
```

- 入参 `undefined`（liveQuery 首帧）→ 返回 `undefined`（让上层走骨架屏）
- 纯函数排序，无副作用

### 3.5 usePlanSearch hook

```ts
function usePlanSearch(
  plans: Plan[] | undefined,
  query: string,
): Plan[] | undefined {
  return useMemo(() => {
    if (!plans) return undefined;
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [plans, query]);
}
```

- 空 query 透传原数组（避免不必要复制）
- 缓存键含 `query`：query 变化时重算

### 3.6 路由 /plans 实现

`src/pages/plans/PlanList.tsx`：

```tsx
export default function PlanList() {
  const rawPlans = useLiveQuery(() => planRepo.list(), []);
  const sorted = useSortedPlans(rawPlans);
  const [query, setQuery] = useState('');
  const filtered = usePlanSearch(sorted, query);
  const view = useUIStore((s) => s.planListView);

  // 加载态
  if (filtered === undefined) return <PlanListSkeleton />;
  // 空态
  if (filtered.length === 0 && !query) return <EmptyIllustration />;
  // 搜索无结果
  if (filtered.length === 0 && query) return <EmptySearch query={query} onClear={() => setQuery('')} />;

  return (
    <div className="space-y-6">
      <PageHeader count={rawPlans?.length ?? 0} />
      <SortHint />
      <Toolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={useUIStore.getState().setPlanListView}
      />
      {view === 'group' && <PlanGroupedView plans={filtered} />}
      {view === 'all' && <PlanListAllView plans={filtered} />}
      {view === 'table' && <PlanTableView plans={filtered} />}
    </div>
  );
}
```

---

## 4. 集成方案

### 4.1 useUIStore 增量

```ts
// src/stores/uiStore.ts（已存在，本 change 增量）
interface UIState {
  // ... 已有字段（viewMode / theme / sidebarCollapsed / drawerStack）
  planListView: 'group' | 'all' | 'table';
  setPlanListView: (v: 'group' | 'all' | 'table') => void;
}
```

**命名冲突风险**：已有 `viewMode` 字段用于全局视图模式？查 store 后确认（如有冲突则改名为 `planListView`）。

### 4.2 搜索框交互细节

- `<input type="search">` 实时 onChange
- 右侧 `X` 清除按钮（query 非空时显示）
- 左侧 `Search` Lucide icon
- 占位符「搜索计划标题或描述…」
- 300ms 内响应（无 debounce，useMemo 缓存足够）
- 快捷键 ⌘K 唤起全局搜索（v1.1 实现，本 change 不引入）

### 4.3 表格视图多选（仅 UI 状态）

- 首列 checkbox：TanStack Table `enableRowSelection`
- 表头 checkbox：全选/反选（全选当前过滤结果）
- 选中行视觉：`bg-accent-50/30`
- 批量操作工具栏（删除/打标/归档）：**v1.0 不实现**，仅显示「已选 N 项」徽章

### 4.4 折叠展开持久化策略

- 折叠状态仅在内存中（useState）
- 不写入 store，避免污染 UI 偏好
- 进入 `/plans` 时默认折叠（与 prototype 一致）
- 长期不操作时自动展开（v1.1 再做，v1.0 简化）

---

## 5. 边界与测试场景

### 5.1 排序边界

```ts
// 空 plans
useSortedPlans([]) === []
// 单 plan
useSortedPlans([p]) === [p]
// 同紧急度同进度：按 endDate 升序
sortPlans([p_end30, p_end7]) === [p_end7, p_end30]
// 无 endDate：排最后
sortPlans([p_noEnd, p_end7]) === [p_end7, p_noEnd]
```

### 5.2 搜索边界

```ts
// 大小写不敏感
usePlanSearch(plans, 'PLAN') 包含 title='plan 1'
// 描述匹配
usePlanSearch(plans, '复盘') 包含 description='...复盘...'
// 空 query 透传
usePlanSearch(plans, '') === plans
// query 全空白
usePlanSearch(plans, '   ') === plans
```

### 5.3 视图切换边界

```ts
// 0 plan + 搜索 query：EmptySearch（不是 EmptyIllustration）
<PlanList plans={[]} query="测试" />
// 搜索结果为 0 + 无 query：EmptyIllustration
<PlanList plans={[]} query="" />
// 加载中：Skeleton
<PlanList plans={undefined} />
```

### 5.4 表格排序覆盖

```ts
// 表格视图点击「进度」列头：表格按 progress 降序，忽略智能排序
table.getRowModel().rows[0].original.progress === 100
// 切回分组视图：恢复智能排序
<PlanGroupedView plans={filtered} />  // 智能排序生效
```

---

## 6. 不在本 change 范围

- 计划详情页（`add-plan-detail-view`）
- 创建/编辑表单（`add-plan-edit-form`）
- 批量操作（`add-plan-batch-ops`）
- 拖拽排序（v1.1）
- 标签筛选 UI（v1.1）
- 全文搜索 / 标签搜索（v1.1，v1.0 仅 title/description）
- ⌘K 全局搜索快捷键（v1.1）
- 深链分享（URL query 持久化，v1.1）
- 单元测试（Sprint 1-2 不强制）
- 表格批量操作工具栏（v1.0 仅多选 UI，批量 action 留 `add-plan-batch-ops`）
