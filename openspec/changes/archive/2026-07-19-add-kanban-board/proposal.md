# Proposal · 计划项看板（Kanban Board）

## Why

PRD v1.0 §5.2「计划与博客一体化」明确：计划项（Item）应在「列表（PlanList / 表格视图）」「详情勾选（PlanDetail）」「看板（Kanban）」三种模式下都可操作，**但当前现状是**：

- `/kanban` 路由仍为 `PlaceholderPage`（"功能开发中"），用户没有任何"按状态全局浏览 + 拖拽改状态"的入口
- `add-plan-list-view` 落地了列表/表格视图（按 plan 分组），但 plan 内的 item 状态切换体验分散
- 用户的核心工作流"今日聚焦 → 全局盘点所有 item → 拖动到对应状态列"在 100+ item 时极不友好
- `add-plan-detail-view` 落地了 plan 内 item 勾选（增改单一 item），但**跨 plan**的状态盘点缺失

用户在管理 10+ 个 plan × 10+ item 时，最自然的视图是"按状态分列看板"——一眼看到所有 Todo / In Progress / Blocked / Done；拖卡即改状态。这是 Notion / Trello / Linear / Jira 等工具的核心模式，Planote 不可缺。

## What Changes

### 1. `/kanban` 路由实现 Kanban（替换 PlaceholderPage）

- 路径：`src/pages/kanban/Kanban.tsx`（当前 PlaceholderPage → 真实实现）
- 4 列固定布局（Todo / In Progress / Blocked / Done）
- 整页横向滚动（4 列宽度固定，min-w-[280px]）
- 列头含计数（实时反映列内卡片数）

### 2. KanbanColumn 组件（v1.0 固定 4 列）

- 路径：`src/features/kanban/components/KanbanColumn.tsx`
- props：`{ status: ItemStatus, items: Item[], plans: Plan[] }`
- 列头：状态名 + 计数 badge
- 容器：可拖入区（`onDragOver` + `onDrop`）
- 视觉：`bg-stone-50` 圆角 + 拖拽时 `ring-2 ring-brand-500` 高亮
- 空态：显示「拖卡到这里」提示

### 3. KanbanCard 组件（计划项卡）

- 路径：`src/features/kanban/components/KanbanCard.tsx`
- 内容：标题（line-clamp-2）+ 所属计划名 + 紧急度 chip + 截止日期
- 交互：`draggable` + `onDragStart`（dataTransfer.setData）
- 点击 → 跳 `/plans/:planId#item-:itemId`（hash 锚点跳转）

### 4. useKanbanData hook

- 路径：`src/features/kanban/hooks/useKanbanData.ts`
- 数据：所有 active plans 的 items
- 过滤：v1.0 默认排除 `status === 'paused'` 的 plans（配置化预留）
- 输出：按 `ItemStatus` 分桶的 `Record<ItemStatus, Item[]>`
- 排序：列内按 `urgency desc` → `dueDate asc`

### 5. useDragDrop hook

- 路径：`src/features/kanban/hooks/useDragDrop.ts`
- 抽象 HTML5 drag/drop API
- 入参：`onDrop(itemId, newStatus)`
- 返回：`{ onDragStart, onDragOver, onDragLeave, onDrop }` 4 个事件 handler
- 无外部依赖（不用 @dnd-kit，简化 v1.0）

### 6. PlanDetail 锚点高亮（增量）

- 路径：`src/pages/plans/PlanDetail.tsx`
- 监听 URL hash `#item-{id}`，进入页面时滚动到该 item + 加 1.5s 高亮（ring-amber-400）

### 7. 跨计划拖拽（v1.0 简化）

- 拖卡到新列只改 `item.status`，**保留**原 `planId`
- v1.0 不支持"换 plan 归属"（拖到 plan A 的 Done 不改变 plan A 关联）

## Scope

**In Scope**：

- 新建 `src/pages/kanban/Kanban.tsx`（页面 + 4 列布局）
- 新建 `src/features/kanban/components/KanbanColumn.tsx`
- 新建 `src/features/kanban/components/KanbanCard.tsx`
- 新建 `src/features/kanban/hooks/useKanbanData.ts`
- 新建 `src/features/kanban/hooks/useDragDrop.ts`
- 改造 `src/pages/plans/PlanDetail.tsx`（hash 锚点滚动 + 高亮）
- 改造 `src/components/layout/AppLayout.tsx`（让 kanban 路由可用，已有占位）
- spec 增量：新增 `kanban-board` capability，9-10 个 ADDED Requirements

**Out of Scope**（明确划清边界）：

- 新建计划项（item）—— 在 PlanDetail 已有（add-plan-detail-view）
- 跨列批量操作
- WIP 限制（每列最多 N 张卡）
- 子任务展开（item 不嵌套）
- 自定义列（v1.0 固定 4 列；v1.1 可让用户拖列重排）
- 敏捷指标（lead time / cycle time / throughput）
- 甘特图（Gantt）—— 独立 change
- 拖到「归档」/「回收站」—— 列只改 status 不删 item
- 拖拽改 planId（v1.0 简化：只改 status）
- 键盘拖拽（v1.0 a11y 简化为鼠标操作；键盘用户用 PlanDetail）
- 实时协作（v1.0 单机；v1.1 接 Yjs）
- 单测（Sprint 1-2 不强制）

## Acceptance Criteria

- [ ] **AC-1**：看板 4 列固定（Todo / In Progress / Blocked / Done），列头含计数
- [ ] **AC-2**：每张卡显示标题、所属计划名、紧急度 chip、截止日期
- [ ] **AC-3**：拖卡到另一列 → 即时更新 Dexie + 列计数实时变化
- [ ] **AC-4**：跨计划拖拽允许（v1.0 简化：只改 status，保留 planId）
- [ ] **AC-5**：点击卡 → 跳到 `/plans/:planId#item-:itemId`（高亮定位）
- [ ] **AC-6**：列宽固定（min-w-[280px]），整页可横向滚动
- [ ] **AC-7**：空列显示「拖卡到这里」提示
- [ ] **AC-8**：build + lint + validate 三关过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| HTML5 drag/drop API 浏览器兼容性 | 低 | Chromium / Firefox / Safari 均原生支持；Edge / 移动端 WebKit 同样支持 |
| 拖拽中触发多次 `onDrop` 导致重复 update | 中 | `dragging` ref 单例 + `e.preventDefault()` 守门；失败时 Dexie 失败回滚 + toast |
| 大数据量（500+ item）看板卡顿 | 中 | 列内不引入虚拟滚动（v1.0 简化）；超过 50 张卡的列加「显示更多」分页；v1.1 评估 react-virtuoso |
| 跨计划拖拽引起 plan.progress 缓存不一致 | 中 | `useItemStore.toggleItem` 已有 recomputeProgress 钩子；本 change 复用 `updateItem` action；不直接改 Dexie |
| 拖拽 API 不能用键盘触发，a11y 受限 | 中 | 键盘用户用 PlanDetail 列表操作 item；v1.1 可加 @dnd-kit 增强 a11y |
| PlanDetail hash 高亮逻辑回归（item 列表已有滚动） | 低 | 增量添加；用 ref + setTimeout 1.5s 自动清理高亮 |
| 列宽固定 + 横向滚动在窄屏体验差 | 低 | 桌面端 Web 优先（PRD §1.3）；移动端 v1.1 考虑横竖屏切换 |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：`Item` 模型 + `ItemRepo.toggle/update` + Dexie `liveQuery`
  - `add-zustand-stores`：`useItemsStore.updateItem` action + `useItemsForPlan` / `usePlans` hook
  - `add-plan-list-view`：智能排序 / 视图切换模式参考
  - `add-plan-detail-view`：PlanDetail 页面 + item 勾选 UI（hash 高亮落地于此）
  - `add-app-shell`：EmptyState / Skeleton / 共用布局

- **下游（待启动）**：
  - `add-kanban-wip-limit`（v1.1）：每列 WIP 限制 + 警示
  - `add-kanban-metrics`（v1.1）：lead time / cycle time / throughput 图表
  - `add-kanban-customize`（v1.1）：用户自定义列 + 列拖拽重排
  - `add-kanban-keyboard`（v1.1）：@dnd-kit 键盘拖拽 + a11y 增强
  - `add-global-search`（v1.1）：看板内按标题搜索 item

## Out of Scope Reminder

- 不实现新建 item（在 PlanDetail）
- 不实现批量操作
- 不实现 WIP 限制
- 不实现子任务展开
- 不实现自定义列
- 不实现敏捷指标
- 不实现甘特图
- 不实现跨列换 planId
- 不实现键盘拖拽（鼠标优先）
- 不写单测
- 不引入新依赖（HTML5 API + Tailwind + zustand + dexie 已够用）
- 不破坏 Round 7 智能排序、Round 8 状态机、Round 9-10 plan/blog 模块
- 不改 PRD / 原型
