# Tasks · 计划项看板（Kanban Board）

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **时间预算**：~1.0 人天；每段工时按「单 task ≤ 20min」拆分。
> **依赖**：add-data-layer-dexie + add-zustand-stores + add-plan-list-view + add-plan-detail-view + add-app-shell 已落地
> **状态**：提案阶段（Round 11 提案，Round 12 实施）

---

## 1. 数据层（useKanbanData hook）

- [ ] 1.1 `src/features/kanban/hooks/useKanbanData.ts` → 数据 pipeline
  - 调用 `useLiveQuery(itemRepo.list, [])` 一次性拉全 item
  - 调用 `usePlans()` 拿所有 plan
  - 过滤 `plan.status !== 'paused'`（active plans）
  - 输出 `{ itemsById, itemsByStatus, isLoading, totalCount }`
- [ ] 1.2 `src/features/kanban/utils/kanbanSort.ts` → 列内排序
  - `sortKanbanItems(items)` 纯函数
  - 公式：urgency 降序 → dueDate 升序（无 dueDate 排最后）
  - `URGENCY_RANK: Record<UrgencyLevel, number>` 红/橙/黄/无 → 0/1/2/3
- [ ] 1.3 边界
  - `allItems === undefined` → `isLoading: true`
  - 0 active plan → `itemsByStatus` 全空桶
  - paused plan 下的 item 不出现在 `itemsByStatus`

## 2. 拖拽层（useDragDrop hook）

- [ ] 2.1 `src/features/kanban/hooks/useDragDrop.ts` → HTML5 drag/drop 抽象
  - 入参：`onDrop: (itemId: ID, newStatus: ItemStatus) => void`
  - 返回：`{ handleDragStart, handleDragOver, handleDragLeave, handleDrop }`
  - 每个 handler 是 `useCallback` 包的高阶函数，绑 React.DragEvent
- [ ] 2.2 handleDragStart
  - `e.dataTransfer.setData('text/plain', itemId)`
  - `e.dataTransfer.effectAllowed = 'move'`
- [ ] 2.3 handleDragOver
  - `e.preventDefault()`（必须，否则 onDrop 不触发）
  - `e.dataTransfer.dropEffect = 'move'`
- [ ] 2.4 handleDrop
  - `e.preventDefault()`
  - 读 `e.dataTransfer.getData('text/plain')` 拿 itemId
  - 调 `onDrop(itemId, status)`
  - 空 itemId 早返回

## 3. KanbanCard 组件

- [ ] 3.1 `src/features/kanban/components/KanbanCard.tsx` → 计划项卡
  - props：`{ item: Item, plan?: Plan, onDragStart: (id: ID) => void }`
  - 视觉：rounded-xl + shadow-soft + cursor-grab
  - 标题（line-clamp-2）+ 计划名 chip + 截止日期 + 紧急度 chip
  - `draggable` + onDragStart
  - onClick → `navigate(/plans/{planId}#item-{itemId})`
- [ ] 3.2 0 dueDate 不渲染日期
- [ ] 3.3 plan.urgency === 'none' 不渲染紧急度 chip
- [ ] 3.4 a11y：`role="article"` + `tabIndex={0}`（键盘可达但不能键盘拖）

## 4. KanbanColumn 组件

- [ ] 4.1 `src/features/kanban/components/KanbanColumn.tsx` → 单列容器
  - props：`{ status: ItemStatus, title: string, items: Item[], plansById: Map<ID, Plan>, dragHandlers }`
  - 视觉：min-w-[280px] w-80 + bg-stone-50 + rounded-2xl + border
  - 列头：标题 + 计数 badge
  - 列体：flex-1 + overflow-y-auto + min-h-[200px]
- [ ] 4.2 拖拽态视觉
  - `isDragOver` 本地 state（onDragOver 置 true / onDragLeave 置 false）
  - isDragOver 时加 `ring-2 ring-brand-500`
  - 拖出卡 `opacity-50`（KanbanCard 内部处理）
- [ ] 4.3 空态
  - `items.length === 0` → 「拖卡到这里」+ 灰色 dashed 边框
- [ ] 4.4 列固定映射
  - Todo / In Progress / Blocked / Done
  - 颜色：stone / blue / red / emerald
  - 顶部 4 列数组常量 `COLUMNS`（design.md §2.2）

## 5. Kanban 页面

- [ ] 5.1 `src/pages/kanban/Kanban.tsx` → 替换 PlaceholderPage
  - 调 `useKanbanData()` + `useDragDrop(handleItemDrop)`
  - 4 列固定布局（flex gap-4 overflow-x-auto）
  - 加载态：Skeleton
  - 全空态：EmptyState illustration
- [ ] 5.2 handleItemDrop
  - 检查 item.status !== newStatus（早返回）
  - 调 `useItemsStore.getState().updateItem(itemId, { status: newStatus })`
  - catch → `useToastStore.push('error', '状态更新失败')`
- [ ] 5.3 标题栏
  - 「看板」+ 「共 N 个计划项」+ 「新建计划」链接到 `/plans/new`
- [ ] 5.4 路由：占位 → 真实实现
  - 删 PlaceholderPage import
  - 不改 AppLayout / App.tsx（路由已注册）

## 6. PlanDetail 锚点高亮

- [ ] 6.1 `src/pages/plans/PlanDetail.tsx` → 加 `useItemHashHighlight` hook
  - `useLocation()` 拿 hash
  - `useEffect` 监听 hash 变化
  - `hash.replace('#item-', '')` 拿 itemId
  - `document.querySelector(\`[data-item-id="${itemId}"]\`)` 拿元素
  - `el.scrollIntoView({ behavior: 'smooth', block: 'center' })`
  - 加 `ring-2 ring-amber-400 rounded-xl` 高亮
  - 1.5s 后移除（setTimeout + cleanup）
- [ ] 6.2 `src/features/plan/components/ItemRow.tsx`（或 ItemChecklist）→ 加 `data-item-id={item.id}`
  - 检查现有 ItemRow 是否已加；没有则补

## 7. 视觉 + 边界

- [ ] 7.1 列宽固定 280-320px
  - `min-w-[280px] w-80`（Tailwind）
  - 整页 `overflow-x-auto`
- [ ] 7.2 拖拽视觉
  - 列 ring-brand-500（2px）
  - 卡 opacity-50
  - 拖拽过程无白屏
- [ ] 7.3 列态平滑
  - 列间 gap-4
  - 列内卡间 space-y-2
  - 列头 + 列体 flex 布局
- [ ] 7.4 整页空态
  - 0 active plan → EmptyState illustration + 「还没有计划项」+ 「新建计划」CTA
  - 全部 paused → EmptyState + 「所有计划都已搁置，先去激活一个」

## 8. 验证

- [ ] 8.1 `pnpm build` 0 error
- [ ] 8.2 `pnpm lint` 0 warning
- [ ] 8.3 手动验证：4 列渲染 + 列头计数 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.4 手动验证：拖卡到另一列 → 状态实时更新 + 列计数变化 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.5 手动验证：跨计划拖拽（保留 planId）— 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.6 手动验证：点击卡跳详情 + 锚点高亮 1.5s — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.7 手动验证：列内排序（urgency↓ + dueDate↑）— 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.8 手动验证：空列「拖卡到这里」+ 整页空 EmptyState — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.9 手动验证：paused plan 的 item 不出现 — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.10 手动验证：拖拽失败 toast — 浏览器
  - _注_：agent 环境受限，留待人工验证
- [ ] 8.11 `openspec validate add-kanban-board --strict` 通过

## 9. 提交与归档

- [ ] 9.1 `git add .` + `git commit -m "feat(kanban): add plan item kanban board with drag-drop status changes"`
- [ ] 9.2 `openspec archive add-kanban-board --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（4 列 + 计数）| 4.1 + 4.2 + 5.1 | 浏览器 |
| AC-2（卡内容）| 3.1 + 3.2 + 3.3 | 浏览器 |
| AC-3（拖拽改状态）| 2.1-2.4 + 5.2 | 浏览器 |
| AC-4（跨计划保留 planId）| 5.2 | 浏览器 |
| AC-5（点击跳详情 + 锚点）| 3.1 + 6.1 | 浏览器 |
| AC-6（列宽 + 横滚）| 4.1 + 7.1 | 浏览器 |
| AC-7（空列提示）| 4.3 | 浏览器 |
| AC-8（build + lint + validate）| 8.1 + 8.2 + 8.11 | CLI ✓ |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（数据层）| 0.1 | hook + sort util |
| 2（拖拽层）| 0.1 | 4 个 handler |
| 3（KanbanCard）| 0.1 | 卡片 |
| 4（KanbanColumn）| 0.15 | 列 + 视觉态 |
| 5（Kanban 页）| 0.15 | 装配 + 标题栏 |
| 6（PlanDetail 锚点）| 0.1 | 高亮 hook |
| 7（视觉 + 边界）| 0.1 | 微调 |
| 8（验证）| 0.15 | build + lint + 浏览器 8 项 |
| 9（提交归档）| 0.05 | git + archive |
| **合计** | **1.0 人天** | Round 12 实施预算 |
