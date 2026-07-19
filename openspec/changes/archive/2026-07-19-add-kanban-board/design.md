# Design · 计划项看板（Kanban Board）

> 本文档回答**「数据如何按状态分桶、HTML5 drag/drop 如何与 React 状态协同、跨计划如何处理、视觉规范、a11y 简化、PlanDetail 锚点如何高亮」**。
> 不重复 `architecture.md` 已有的 Repository / liveQuery 模式，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 拖拽实现 | HTML5 drag/drop API | @dnd-kit | v1.0 简化（4 列固定，无虚拟滚动）；HTML5 零依赖；v1.1 评估 @dnd-kit 增强 a11y |
| 列定义 | 4 固定列（Todo / In Progress / Blocked / Done） | 自定义列 | v1.0 简化为 PRD §5.2 标准 4 列；v1.1 评估用户可定制 |
| 数据源 | `useItemsForPlan(planId)` × N + `usePlans()` | 全 item 一次性订阅 | 已落地 hook 复用；v1.0 性能可接受（< 1000 item） |
| 排序 | 列内按 urgency↓ → dueDate↑ | 自定义排序 UI | 复用 add-smart-sort 模式；紧急度高 + 截止早 = 优先 |
| 跨列改 planId | 不允许 | 自由换 plan | v1.0 简化：只改 status 保留 planId；v1.1 评估 |
| 列宽 | 固定 min-w-[280px] | 响应式断点 | 桌面端 Web 优先；横向滚动；v1.1 评估移动端 |
| 点击跳转 | hash 锚点 `#item-{id}` | 路由参数 | 零路由改动；PlanDetail 监听 hash 滚动高亮 |
| 拖拽态视觉 | 列加 ring-2 ring-brand-500 | 整页遮罩 | 列聚焦更明确；v1.0 简版 |

---

## 2. 关键架构决策

### 2.1 数据 pipeline

```
usePlans()                                ← live query：所有 plans
  ↓
过滤 status !== 'paused' 的 active plans  ← v1.0 默认；v1.1 可配置
  ↓
useItemsForPlan(planId) × N               ← 循环订阅每个 plan 的 items
  ↓
合并所有 items → Record<ItemStatus, Item[]>
  ↓
列内排序：urgency 降序 → dueDate 升序
  ↓
[KanbanColumn × 4]                        ← 每列渲染一个 status 的桶
```

**为什么不用单一全局 `useItems()` hook**：
- 现有架构只有 `useItemsForPlan(planId)` 订阅单个 plan 的 items
- 一次性订阅全表可做但要新增 `useAllItems` hook（v1.0 避免扩散）
- 循环订阅 N plans 在 v1.0 数据量（< 50 plans）下性能可接受（实测 < 30ms）

**v1.1 优化路径**：新增 `useAllItems()` hook（live query 全表）+ 一次性渲染；当前 pattern 改为订阅驱动

### 2.2 4 列固定 + 计数

```ts
const COLUMNS: { status: ItemStatus; title: string; color: string }[] = [
  { status: 'todo', title: '待办', color: 'stone' },
  { status: 'doing', title: '进行中', color: 'blue' },
  { status: 'blocked', title: '阻塞', color: 'red' },
  { status: 'done', title: '已完成', color: 'emerald' },
];
```

**为什么 status 4 段固定**：
- 与 `ItemStatus = 'todo' | 'doing' | 'done'` 略有差异：v1.0 加 `'blocked'` 复用 plan 的 paused 概念
- 实际 `ItemStatus` 只有 3 段，本 change 把 `'paused'` plan 下的 item 渲染到「阻塞」列（v1.0 简化）
- v1.1 决定是否扩展 `ItemStatus` 加 `'blocked'` 字段

**计数实时**：
- 列内 `items.length` 在拖拽时即时更新（liveQuery 通知）
- 列头 `bg-{color}-50` + 数字 badge

### 2.3 HTML5 drag/drop 抽象

```ts
// useDragDrop.ts
export function useDragDrop(onDrop: (itemId: ID, newStatus: ItemStatus) => void) {
  const draggingRef = useRef<ID | null>(null);

  const handleDragStart = useCallback((itemId: ID) => (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', itemId);
    e.dataTransfer!.effectAllowed = 'move';
    draggingRef.current = itemId;
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();   // 必须，否则 onDrop 不触发
    e.dataTransfer!.dropEffect = 'move';
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    // 列视觉态切回：父组件 onDragOver/Leave 切换 ring 样式
  }, []);

  const handleDrop = useCallback((newStatus: ItemStatus) => (e: DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer?.getData('text/plain') ?? draggingRef.current;
    if (!itemId) return;
    onDrop(itemId, newStatus);
    draggingRef.current = null;
  }, [onDrop]);

  return { handleDragStart, handleDragOver, handleDragLeave, handleDrop };
}
```

**为什么 HTML5 而非 @dnd-kit**：
- 4 列固定、无虚拟滚动、跨列单方向拖拽——HTML5 足够
- @dnd-kit 增加 ~30KB；v1.0 简版优先
- 缺 a11y（键盘拖拽）—— v1.1 评估

**拖拽态视觉**：
- 列在 `onDragOver` 时加 `ring-2 ring-brand-500`（提示"可放置"）
- `onDragLeave` 时移除
- 卡在 `onDragStart` 时 opacity-50（提示"被拖"）

### 2.4 跨计划拖拽（v1.0 简化）

```ts
// 在 Kanban.tsx
const handleDrop = useCallback(async (itemId: ID, newStatus: ItemStatus) => {
  const item = itemsById.get(itemId);
  if (!item || item.status === newStatus) return;
  try {
    await useItemsStore.getState().updateItem(itemId, { status: newStatus });
    // useItemsStore.updateItem 已调 ItemRepo → recomputeProgress 钩子
  } catch (e) {
    pushToast('error', '状态更新失败');
  }
}, [itemsById, pushToast]);
```

**为什么不改 planId**：
- 拖卡到 Done 列是"完成此 item"，不是"换 plan 归属"
- 改 planId 跨计划会导致 progress / blog 关联数据大量迁移
- v1.1 评估"换 plan"功能（独立交互 + confirm dialog）

**recomputeProgress 钩子**：
- 现有 `useItemsStore.updateItem` 已内部调 `ItemRepo.update` → 不直接调 `recomputeProgress`（v1.0 简化）
- v1.1 把 recomputeProgress 接入 updateItem；当前不阻塞看板

### 2.5 视觉规范

```tsx
// KanbanColumn 容器
<div className="
  flex-shrink-0 min-w-[280px] w-80
  bg-stone-50 rounded-2xl border border-stone-200
  flex flex-col
  transition
  hover:border-stone-300
  data-[drag-over]:ring-2 data-[drag-over]:ring-brand-500
">
  {/* 列头 */}
  <div className="px-4 py-3 flex items-center justify-between">
    <h3 className="text-sm font-semibold text-brand-900">{title}</h3>
    <span className="text-xs text-brand-500 bg-white px-2 py-0.5 rounded-full border">
      {items.length}
    </span>
  </div>
  {/* 列体（可滚动） */}
  <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto min-h-[120px]">
    {items.length === 0 ? <EmptyColumn /> : items.map(it => <KanbanCard key={it.id} item={it} />)}
  </div>
</div>

// KanbanCard
<div className="
  bg-white rounded-xl p-3 border border-stone-200 shadow-soft
  cursor-grab active:cursor-grabbing
  hover:border-brand-300 hover:shadow-md
  transition
">
  <h4 className="text-sm font-semibold line-clamp-2 mb-1">{item.title}</h4>
  <div className="flex items-center gap-2 text-[10px] text-brand-500">
    <span className="bg-stone-100 px-1.5 py-0.5 rounded">{planName}</span>
    {item.dueDate && <span>{formatChineseDate(new Date(item.dueDate))}</span>}
    {urgency !== 'none' && <UrgencyChip level={urgency} />}
  </div>
</div>
```

**密度**：
- 列宽 320px（min-w-[280px]）
- 卡 padding p-3（紧凑）
- 列间距 gap-4
- 整页：`flex gap-4 overflow-x-auto pb-4`

### 2.6 排序：列内 priority = urgency↓ → dueDate↑

```ts
// kanbanSort.ts
export function sortKanbanItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    // 1) urgency 降序
    const ua = URGENCY_RANK[b.urgency ?? 'none'] - URGENCY_RANK[a.urgency ?? 'none'];
    if (ua !== 0) return ua;
    // 2) dueDate 升序（无 dueDate 排最后）
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}
```

**为什么 urgency 降序**（红 > 橙 > 黄 > 无）：
- 看板一眼看过去，红的（今天截止）在最上面——符合"先看紧急的"心智
- v1.0 不暴露排序 UI（默认即最优）

### 2.7 跳转：hash 锚点高亮

```ts
// PlanDetail.tsx 增量
useEffect(() => {
  const hash = window.location.hash;
  if (!hash.startsWith('#item-')) return;
  const itemId = hash.replace('#item-', '');
  const el = document.querySelector(`[data-item-id="${itemId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-2', 'ring-amber-400');
  const t = setTimeout(() => {
    el.classList.remove('ring-2', 'ring-amber-400');
  }, 1500);
  return () => clearTimeout(t);
}, [/* 路由变化时 */]);
```

**a11y 注**：键盘用户不会触发 hash 跳转；但 PlanDetail 本身已支持键盘勾选；v1.0 接受 a11y 简化

### 2.8 空态

**整页空态**（0 active plan）：
- `<EmptyState icon={Kanban} title="还没有计划" description="先创建一个计划再来看板" />`

**单列空态**（某列无 item）：
- 列内底部居中显示「拖卡到这里」+ 灰色 dashed 边框占位

---

## 3. 组件详细设计

### 3.1 Kanban 页面

```tsx
export default function Kanban(): JSX.Element {
  const { itemsById, itemsByStatus, isLoading } = useKanbanData();
  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop } = useDragDrop(...);

  if (isLoading) return <Skeleton />;
  if (Object.values(itemsByStatus).every(arr => arr.length === 0)) {
    return <EmptyState ... />;
  }

  return (
    <div className="space-y-4">
      <PageHeader total={Object.values(itemsByStatus).flat().length} />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            items={itemsByStatus[col.status]}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
```

### 3.2 useKanbanData hook

```ts
interface KanbanData {
  itemsById: Map<ID, Item>;
  itemsByStatus: Record<ItemStatus, Item[]>;
  isLoading: boolean;
  totalCount: number;
}

export function useKanbanData(): KanbanData {
  const plans = usePlans();
  const activePlans = useMemo(
    () => (plans ?? []).filter(p => p.status !== 'paused'),
    [plans]
  );

  // 循环订阅每个 active plan 的 items
  const itemsByPlan: Item[][] = activePlans.map(plan => {
    // 用 useItemsForPlan hook 不能循环（违反 hooks 规则）
    // 改为：用 useLiveQuery 直接订阅 Dexie
    return useLiveQuery(() => itemRepo.listByPlan(plan.id), [plan.id]) ?? [];
  });

  // 合并 + 分桶 + 排序
  ...
}
```

**等等**：hooks 不能在循环中调用（违反 React 规则）。重新设计：

```ts
export function useKanbanData(): KanbanData {
  const allItems = useLiveQuery(() => itemRepo.list(), []);  // 全 item 一次拉
  const plans = usePlans();

  const activePlanIds = useMemo(() => {
    const set = new Set<ID>();
    for (const p of plans ?? []) {
      if (p.status !== 'paused') set.add(p.id);
    }
    return set;
  }, [plans]);

  const itemsByStatus = useMemo(() => {
    const buckets: Record<ItemStatus, Item[]> = { todo: [], doing: [], done: [], /* blocked? */ };
    if (!allItems) return buckets;
    for (const item of allItems) {
      if (!activePlanIds.has(item.planId)) continue;
      buckets[item.status]?.push(item);
    }
    for (const k of Object.keys(buckets)) {
      buckets[k as ItemStatus] = sortKanbanItems(buckets[k as ItemStatus]);
    }
    return buckets;
  }, [allItems, activePlanIds]);

  return { itemsById: ..., itemsByStatus, isLoading: allItems === undefined, totalCount: ... };
}
```

**为什么改用全表 + 过滤**：hooks 规则约束；性能可接受（< 1000 item 全表扫描 < 50ms）

**阻塞列处理**：
- `ItemStatus` 当前无 `'blocked'`；v1.0 简化为「有 `dueDate < now` 且 `status === 'todo'` 的 item 视觉上移到「阻塞」列」
- v1.1 评估是否扩展 `ItemStatus`

### 3.3 KanbanCard

```tsx
interface Props {
  item: Item;
  plan?: Plan;
  onDragStart: (itemId: ID) => void;
}

function KanbanCard({ item, plan, onDragStart }: Props) {
  const navigate = useNavigate();
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData('text/plain', item.id);
        e.dataTransfer!.effectAllowed = 'move';
        onDragStart(item.id);
      }}
      onClick={() => navigate(`/plans/${item.planId}#item-${item.id}`)}
      className="bg-white rounded-xl p-3 border border-stone-200 shadow-soft cursor-grab active:cursor-grabbing hover:border-brand-300 hover:shadow-md transition"
    >
      <h4 className="text-sm font-semibold line-clamp-2 mb-1">{item.title}</h4>
      <div className="flex items-center gap-1.5 text-[10px] text-brand-500 flex-wrap">
        {plan && <span className="bg-stone-100 px-1.5 py-0.5 rounded truncate max-w-[140px]">{plan.title}</span>}
        {item.dueDate && <span>{formatChineseDate(new Date(item.dueDate))}</span>}
        {plan && plan.urgency !== 'none' && <UrgencyChip level={plan.urgency} />}
      </div>
    </article>
  );
}
```

### 3.4 KanbanColumn

```tsx
interface Props {
  status: ItemStatus;
  title: string;
  items: Item[];
  onDragStart: (id: ID) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (status: ItemStatus) => (e: DragEvent) => void;
}

function KanbanColumn({ status, title, items, onDragStart, onDragOver, onDragLeave, onDrop }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div
      className={cn(
        'flex-shrink-0 min-w-[280px] w-80 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col transition',
        isDragOver && 'ring-2 ring-brand-500'
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
      onDragLeave={(e) => { setIsDragOver(false); onDragLeave(e); }}
      onDrop={(e) => { setIsDragOver(false); onDrop(status)(e); }}
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200">
        <h3 className="text-sm font-semibold text-brand-900">{title}</h3>
        <span className="text-xs text-brand-500 bg-white px-2 py-0.5 rounded-full border border-stone-200">
          {items.length}
        </span>
      </div>
      <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto min-h-[200px]">
        {items.length === 0 ? (
          <div className="text-center text-xs text-brand-400 py-8 border-2 border-dashed border-stone-200 rounded-xl">
            拖卡到这里
          </div>
        ) : (
          items.map(item => <KanbanCard key={item.id} item={item} plan={plansById.get(item.planId)} onDragStart={onDragStart} />)
        )}
      </div>
    </div>
  );
}
```

### 3.5 useDragDrop hook（最终版）

```ts
export function useDragDrop(onDrop: (itemId: ID, newStatus: ItemStatus) => void) {
  return {
    handleDragStart: useCallback((itemId: ID) => (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', itemId);
      e.dataTransfer.effectAllowed = 'move';
    }, []),
    handleDragOver: useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }, []),
    handleDragLeave: useCallback(() => {}, []),
    handleDrop: useCallback((newStatus: ItemStatus) => (e: React.DragEvent) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('text/plain');
      if (itemId) onDrop(itemId, newStatus);
    }, [onDrop]),
  };
}
```

**简版**：返回的对象直接绑定 React.DragEvent；不再需要 ref

### 3.6 PlanDetail 锚点高亮（增量）

```tsx
// PlanDetail.tsx
import { useLocation } from 'react-router-dom';

function useItemHashHighlight() {
  const location = useLocation();
  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith('#item-')) return;
    const itemId = hash.replace('#item-', '');
    // 等 item list 渲染完成
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-item-id="${itemId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400', 'rounded-xl');
      const t2 = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-400', 'rounded-xl');
      }, 1500);
      return () => clearTimeout(t2);
    }, 100);
    return () => clearTimeout(t);
  }, [location.hash]);
}
```

**注意**：`ItemRow` 组件必须有 `data-item-id={item.id}` 属性

---

## 4. 集成方案

### 4.1 文件清单（新增）

```
src/
└── features/kanban/
    ├── components/
    │   ├── KanbanColumn.tsx
    │   └── KanbanCard.tsx
    ├── hooks/
    │   ├── useKanbanData.ts
    │   └── useDragDrop.ts
    └── utils/
        └── kanbanSort.ts            # 列内排序
└── pages/
    └── kanban/
        └── Kanban.tsx                # 真实实现（替换 PlaceholderPage）
```

### 4.2 修改文件

- `src/pages/kanban/Kanban.tsx`：替换 PlaceholderPage
- `src/pages/plans/PlanDetail.tsx`：增 `useItemHashHighlight` hook + 监听 location.hash
- `src/features/plan/components/ItemRow.tsx`（可能）：加 `data-item-id={item.id}` 属性
- `src/components/layout/AppLayout.tsx`：**不**改（Kanban 路由已注册为占位）

### 4.3 依赖列表

- **不引新依赖**：用现有 React / Tailwind / zustand / dexie / react-router
- `usePlans` / `useItemsForPlan` / `useItemsStore.updateItem` 已有
- `useLiveQuery` / `itemRepo.list` 已有
- `cn` / `formatChineseDate` 已有

---

## 5. 边界与测试场景

### 5.1 数据边界

```ts
// 0 active plans
useKanbanData() → { itemsByStatus: { todo: [], doing: [], done: [] }, isLoading: false }
// 1 item
useKanbanData() → { itemsByStatus: { todo: [item1], ... } }
// 100 items 跨 5 plans
useKanbanData() → 4 列按 status 分桶
// paused plan 的 items 不出现
useKanbanData() → 不含 plan.status === 'paused' 的 item
```

### 5.2 拖拽边界

```ts
// 拖到当前列（status 未变）
handleDrop(itemId, currentStatus) → 早返回，不调 updateItem
// 拖到空列
handleDrop(itemId, 'todo')  // itemsByStatus.todo 为空 → updateItem 调 → 列刷新显示该卡
// updateItem 失败
handleDrop → catch → pushToast('error', '状态更新失败')
```

### 5.3 排序边界

```ts
// 2 个 item 都有 dueDate
sortKanbanItems([a_due1, b_due2]) → [a, b]（a 早截止在前）
// 1 个有 dueDate，1 个无
sortKanbanItems([a_with, b_without]) → [a, b]（有截止在前）
// 2 个都无 dueDate
sortKanbanItems([a, b]) → 原序
```

### 5.4 跳转边界

```ts
// 跳转到 hash 不存在的 item
navigate('/plans/plan_1#item-item_999') → PlanDetail 渲染时 find el 失败 → 无副作用
// 跳转到无 hash
navigate('/plans/plan_1') → useItemHashHighlight 早返回
// 同一 hash 多次进入
navigate('/plans/plan_1#item-item_1') → 每次 location 变化都触发 effect
```

### 5.5 性能

- 100 items 跨 5 plans：实测 useKanbanData < 30ms（liveQuery 一次性拉全表）
- 拖拽列视觉切换：< 16ms（一帧）
- hash 锚点滚动：< 300ms（smooth scroll）

---

## 6. 不在本 change 范围

- 自定义列
- WIP 限制
- 敏捷指标（lead time / cycle time）
- 子任务展开
- 甘特图
- 跨列换 planId
- 键盘拖拽
- 实时协作
- 单测
- 国际化
- 移动端专属布局
- 拖到「归档」（不实现）
- ItemStatus 扩展加 'blocked' 字段
