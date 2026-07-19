# Design · 智能排序系统化

> 本文档回答**「排序引擎怎么抽象、4 预设如何互不耦合、UI 切换器与持久化怎么搭」**。
> 不重复 `architecture.md` 已写的紧急度 / 进度派生逻辑，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 引擎形态 | 纯函数 + 泛型 | 类 / Builder / 链式 DSL | Plan / Blog 字段差异大，泛型最直白 |
| 预设实现 | 4 个 `SortSpec` 常量 + 单一 comparator builder | 4 个独立 comparator 函数 | DRY；新增预设只增加常量 |
| 切换器 UI | `<Select>` 自研下拉 | Radix / HeadlessUI | 仅 4 选项，自研 50 行可控 |
| 状态持久化 | `useUIStore` 扩字段 | 新 store | UI 状态本就归 uiStore，persist 已配 |
| 字段命名 | `planListSort`（带前缀） | `currentSort` | 预留 blogListSort / kanbanSort |

---

## 2. 关键架构决策

### 2.1 排序引擎签名

```ts
// src/shared/utils/sortEngine.ts
import type { Plan, ISODate, UrgencyLevel } from '@/types/domain';

export type SortDirection = 'asc' | 'desc';

export type SortKey = 'smart' | 'recent' | 'upcoming' | 'progress';

/** 4 种预设的规约（v1.0 硬编码字段，方向可选反转）。 */
export interface SortSpec<T> {
  key: SortKey;
  direction?: SortDirection;  // v1.0 全部省略（用预设内置方向）
}

/** 引擎主入口。 */
export function sortEngine<T>(items: T[], spec: SortSpec<T>, options?: SortEngineOptions<T>): T[];

export interface SortEngineOptions<T> {
  /** 取字段的访问器（替代 plan.urgency 这类硬编码，让泛型生效）。 */
  accessors?: Partial<Record<SortKey, (item: T) => Sortable>>;
  /** 自定义 comparator（覆盖预设，v1.0 不暴露） */
  comparator?: (a: T, b: T) => number;
}

export type Sortable = string | number | Date | null | undefined;
```

**为什么是泛型不是 `Plan[]`**：
- 后续 BlogList 也能直接 `sortEngine(blogs, { key: 'recent' })`
- 字段取值走 `accessors` 注入，避免在引擎内 switch 写死 `plan.urgency`
- v1.0 PlanList 提供默认 accessors，BlogList 复用时再传入

### 2.2 4 预设实现（comparator builder）

```ts
const URGENCY_RANK: Record<UrgencyLevel, number> = { red: 0, orange: 1, yellow: 2, none: 3 };

const PRESETS: Record<SortKey, <T>(a: T, b: T, acc: Required<SortEngineOptions<T>>['accessors']) => number> = {
  smart: (a, b, acc) => {
    const ua = URGENCY_RANK[acc.urgency(a)] - URGENCY_RANK[acc.urgency(b)];
    if (ua !== 0) return ua;
    const pa = acc.progress(b) - acc.progress(a);
    if (pa !== 0) return pa;
    const ea = compareDate(acc.endDate(a), acc.endDate(b));   // 无值排最后
    if (ea !== 0) return ea;
    return acc.createdAt(b).localeCompare(acc.createdAt(a));    // 平 tie 用 createdAt desc
  },
  recent: (a, b, acc) => acc.updatedAt(b).localeCompare(acc.updatedAt(a)),
  upcoming: (a, b, acc) => compareDate(acc.endDate(a), acc.endDate(b)),
  progress: (a, b, acc) => {
    const pa = acc.progress(b) - acc.progress(a);
    return pa !== 0 ? pa : acc.createdAt(b).localeCompare(acc.createdAt(a));
  },
};

function compareDate(a?: ISODate, b?: ISODate): number {
  if (a && b) return a < b ? -1 : a > b ? 1 : 0;
  if (a) return -1;
  if (b) return 1;
  return 0;
}
```

**为什么把 `accessors` 设为 required comparator 参数**：
- 泛型不约束具体类型，comparator 内部必须拿到字段值
- 工厂模式：`sortEngine(items, spec)` 内部根据 `spec.key` 选择 preset + 注入默认 accessors
- 调用方零负担：`sortEngine(plans, { key: 'smart' })` 一行搞定

### 2.3 引擎内置 accessors（Plan 默认值）

```ts
const PLAN_ACCESSORS = {
  urgency: (p: Plan) => p.urgency,
  progress: (p: Plan) => p.progress,
  endDate: (p: Plan) => p.endDate,
  createdAt: (p: Plan) => p.createdAt,
  updatedAt: (p: Plan) => p.updatedAt,
} as const;
```

- v1.0 引擎只识别 `Plan`（accessors 默认值硬编码）
- BlogList 调用时显式传入 blog 的 accessors
- 类型安全靠 TypeScript：`sortEngine<Plan>(plans, { key: 'smart' })` 推断正确

### 2.4 UI 切换器

```tsx
// src/components/plans/SortDropdown.tsx
interface Props {
  value: SortKey;
  onChange: (key: SortKey) => void;
}

const OPTIONS: Array<{ key: SortKey; label: string; description: string }> = [
  { key: 'smart',     label: '智能排序',   description: '按紧急度 + 进度排序' },
  { key: 'recent',    label: '最近活跃',   description: '按最近更新时间排序' },
  { key: 'upcoming',  label: '即将到期',   description: '按截止日期升序' },
  { key: 'progress',  label: '进度优先',   description: '高进度在前' },
];
```

- 自研下拉：`<button>` 触发 + 绝对定位的 `<div>` 列表
- 视觉：与 `<PlanViewSwitcher>` 同一色系（brand-900 active / stone hover）
- 关闭：点击外部 / Esc 键
- a11y：`role="listbox"` + `aria-selected`

### 2.5 持久化

```ts
// src/stores/uiStore.ts 新增
export type PlanListSort = SortKey;

interface UIStoreState {
  // ... existing
  planListSort: PlanListSort;  // 默认 'smart'
  setPlanListSort: (sort: PlanListSort) => void;
}

// persist 白名单追加
partialize: (state) => ({
  // ... existing
  planListSort: state.planListSort,
})
```

- 与 `planListView` 平行，未来 `planListView` + `planListSort` 共同描述 plan-list 的视图态
- 不破坏现有 `version: 1`（追加字段自动通过 partialize 写入）

### 2.6 useSortedPlans 重构（兼容改造）

```ts
// src/stores/hooks/useSortedPlans.ts
export function useSortedPlans(
  plans: Plan[] | undefined,
  sort: SortKey = 'smart',  // 兼容：默认 smart
): Plan[] | undefined {
  return useMemo(() => {
    if (plans === undefined) return undefined;
    return sortEngine(plans, { key: sort });
  }, [plans, sort]);
}
```

**为什么保留 `sort` 参数（即便 PlanList 现在还没传）**：
- 一步到位，PlanList 直接用 `useSortedPlans(plans, planListSort)`
- 不破坏现有调用（默认 `sort='smart'` 与原 `sortPlans` 行为一致）
- AC-1 验证：基准 100 条 plan 全等

### 2.7 PlanList 集成

```tsx
// src/pages/plans/PlanList.tsx 改造
const planListSort = useUIStore((s) => s.planListSort);
const setPlanListSort = useUIStore((s) => s.setPlanListSort);

const sortedPlans = useSortedPlans(rawPlans, planListSort);
// ...

<Toolbar
  query={query}
  onQueryChange={setQuery}
  view={view}
  onViewChange={setView}
  sort={planListSort}
  onSortChange={setPlanListSort}
/>
```

- `<SortDropdown>` 放在搜索框与视图切换器之间
- 移动端不折叠（4 选项不影响空间）
- 与 `<SortHint>` 联动：`smart` 模式显示提示条，其他模式不显示（语义不匹配）

---

## 3. 组件详细设计

### 3.1 SortDropdown

- 默认渲染：`<button>` 显示当前选中项 + ChevronDown icon
- 展开：绝对定位 `<div role="listbox">` 4 个选项
- 选项 UI：左 12px icon + 中 label + 右 description 灰色小字
- 选中态：左侧 2px brand-900 边 + 浅色背景
- 关闭：点击外部（useRef + mousedown 监听）/ Esc 键
- v1.0 简化为「点击切换 + 立即关闭」单选模式（不暴露 hover preview）

### 3.2 排序状态指示（可选增强）

- `<SortHint>` 当前只对 `smart` 模式有意义
- v1.0 简化：保留现有 `<SortHint>` 仅在 `planListSort === 'smart'` 时显示
- 排序条文案改为可配置：传入 `sort` prop 显示「按 X 排序」

---

## 4. 集成方案

### 4.1 引擎调用入口

```ts
// PlanList
import { useSortedPlans } from '@/stores/hooks/useSortedPlans';
const sorted = useSortedPlans(plans, planListSort);

// 未来 BlogList
import { sortEngine } from '@/shared/utils/sortEngine';
const sortedBlogs = sortEngine(blogs, { key: 'recent' });
```

### 4.2 uiStore 字段命名一致性

- `planListSort: SortKey` —— plan-list 专用
- 未来 `blogListSort: SortKey` —— blog-list 专用
- 同前缀避免多页面状态混淆

### 4.3 排序 + 视图模式

| viewMode | sort = smart | sort = recent | sort = upcoming | sort = progress |
|----------|--------------|----------------|------------------|------------------|
| group    | 智能分组     | 最近活跃分组   | 即将到期分组     | 进度优先分组     |
| all      | 智能单列     | 最近活跃单列   | 即将到期单列     | 进度优先单列     |
| table    | 智能表格     | 最近活跃表格   | 即将到期表格     | 进度优先表格     |

- 4 × 3 = 12 组合全部支持（pipeline 共享 `sortEngine`）
- v1.0 不为每种组合做特殊 UI（避免过度设计）

---

## 5. 边界与测试场景

### 5.1 引擎边界

```ts
// 空数组
sortEngine([], { key: 'smart' }) === []

// undefined 入参（不暴露 v1.0，由 useSortedPlans 守卫）
// useSortedPlans 仍负责 undefined 守卫

// 平 tie 行为
// smart: progress 平 → endDate 平 → createdAt desc
// progress: progress 平 → createdAt desc
// recent: updatedAt 平 → 原顺序（Array.prototype.sort 稳定）
```

### 5.2 持久化场景

```ts
// 场景 A：首次进入 → planListSort = 'smart'
// 场景 B：切换到 'recent' → localStorage.planote-ui.planListSort = 'recent'
// 场景 C：刷新页面 → useUIStore 初始化 planListSort = 'recent'（持久化生效）
// 场景 D：localStorage 损坏 → useUIStore fallback 到默认 'smart'
```

### 5.3 切换交互

```ts
// 打开下拉 → 点击 'progress'
// 1) setPlanListSort('progress') 写 store
// 2) localStorage 自动 persist
// 3) useSortedPlans(plans, 'progress') 重算
// 4) PlanList 重渲染，列表立即重排
// 5) 下拉自动关闭
```

### 5.4 跨页面干扰

- `planListSort` 仅影响 PlanList
- 未来 blogListSort 独立字段，互不干扰

---

## 6. 不在本 change 范围

- 标签筛选（v1.1）
- 全文搜索（v1.1）
- 排序方向反转 UI（v1.0 字段预留，UI 不暴露）
- BlogList / Kanban UI 改造（v1.1 add-blog-list / add-kanban 接手）
- 自定义排序规则（用户拖字段排序，v1.2 之后）
- 单元测试（v1.0 暂不写单测）
