# kanban-board Specification

## Purpose
TBD - created by archiving change add-kanban-board. Update Purpose after archive.
## Requirements
### Requirement: 看板 4 列固定布局

系统 MUST 在 `/kanban` 路由提供 4 列固定看板（Todo / In Progress / Blocked / Done），列宽固定 min-w-[280px]，整页可横向滚动。

#### Scenario: 默认进入看板

- **GIVEN** 用户首次访问 `/kanban`
- **WHEN** 页面加载
- **THEN** 显 4 列（Todo / In Progress / Blocked / Done）+ 列头含计数

#### Scenario: 列宽固定 + 横向滚动

- **GIVEN** 4 列已渲染
- **WHEN** 浏览器视口 < 1280px
- **THEN** 列保持 min-w-[280px] + 整页 `overflow-x-auto` 显横向滚动条

#### Scenario: 列头计数

- **GIVEN** Todo 列有 5 个 item
- **WHEN** 渲染列头
- **THEN** 计数 badge 显「5」（实时反映列内 item 数）

#### Scenario: 数据为空

- **GIVEN** `useKanbanData` 返回全空（0 active plan 或 0 item）
- **WHEN** 渲染 Kanban
- **THEN** 显 `EmptyState` illustration + 「还没有计划项」+ 引导

### Requirement: KanbanCard 计划项卡

系统 MUST 在每列内渲染 item 卡，含标题、所属计划名、紧急度 chip、截止日期。

#### Scenario: 卡片基础渲染

- **GIVEN** 1 个 item：title='完成首页 hero' / planId='plan_1' / dueDate='2026-07-25' / plan.urgency='red'
- **WHEN** 渲染 KanbanCard
- **THEN** 显示：标题（line-clamp-2）+ 计划名 chip + 截止日期 + 🔥 紧急度 chip（red）

#### Scenario: 无 dueDate

- **GIVEN** 1 个 item 无 dueDate
- **WHEN** 渲染 KanbanCard
- **THEN** 截止日期不渲染（不显「undefined」）

#### Scenario: 紧急度 none

- **GIVEN** 1 个 item 所属 plan.urgency='none'
- **WHEN** 渲染 KanbanCard
- **THEN** 紧急度 chip 不渲染（避免视觉噪音）

### Requirement: HTML5 拖拽改状态

系统 MUST 允许用户用 HTML5 drag/drop API 把 KanbanCard 从一列拖到另一列，触发 item.status 更新。

#### Scenario: 拖卡到 Todo 列

- **GIVEN** 1 个 item 当前 status='doing'，显在「进行中」列
- **WHEN** 用户拖到「待办」列
- **THEN** `useItemsStore.updateItem(itemId, { status: 'todo' })` 调
- **AND** 「待办」列 +1，「进行中」列 -1，列计数实时变化

#### Scenario: 拖到当前列（早返回）

- **GIVEN** item 已在 Todo 列
- **WHEN** 用户拖到 Todo 列（同列）
- **THEN** 不调 updateItem（避免无意义 IO）

#### Scenario: 拖拽态视觉

- **GIVEN** 用户正在拖卡
- **WHEN** 卡经过某列
- **THEN** 该列加 `ring-2 ring-brand-500` 提示可放置
- **AND** 拖出的卡 `opacity-50` 提示被拖

#### Scenario: dropEffect 提示

- **GIVEN** onDragOver 触发
- **WHEN** 浏览器检测 dropEffect
- **THEN** 显「移动」光标（`e.dataTransfer.dropEffect = 'move'`）

#### Scenario: 拖拽失败

- **GIVEN** updateItem 抛错（如 Dexie 写失败）
- **WHEN** 拖拽完成
- **THEN** toast「状态更新失败」+ UI 回滚到拖拽前状态

### Requirement: 跨计划拖拽（保留 planId）

系统 MUST 允许用户把任意 plan 的 item 拖到任何列，只改 item.status，保留原 planId。

#### Scenario: 跨计划拖到 Done

- **GIVEN** 1 个 item 属 plan_1，当前 status='todo'
- **WHEN** 用户拖到 Done 列
- **THEN** item.status='done'，item.planId 仍为 'plan_1'
- **AND** 跳转到 `/plans/plan_1` 时仍能看到该 item（在 done 子集）

#### Scenario: 不支持跨列换 planId

- **GIVEN** 用户期望"把 item 从 plan_1 转到 plan_2"
- **WHEN** 看板操作
- **THEN** v1.0 不支持该操作（拖拽只改 status）
- **AND** 后续 v1.1 评估独立功能

### Requirement: 点击卡跳转详情

系统 MUST 允许用户点击 KanbanCard 跳到该 item 所属 plan 详情页，并通过 URL hash 锚点定位 + 1.5s 高亮。

#### Scenario: 点击卡

- **GIVEN** KanbanCard itemId='item_123' planId='plan_1'
- **WHEN** 用户点击该卡
- **THEN** 导航到 `/plans/plan_1#item-item_123`
- **AND** PlanDetail 滚动到该 item + 加 ring-amber-400 高亮
- **AND** 1.5s 后高亮自动消失

#### Scenario: hash 不存在（item 已删）

- **GIVEN** URL hash 指向已删除的 item
- **WHEN** PlanDetail 渲染
- **THEN** `useItemHashHighlight` 找不到元素 → 静默无副作用

#### Scenario: 无 hash 进入

- **GIVEN** URL 无 hash（如 `/plans/plan_1`）
- **WHEN** PlanDetail 渲染
- **THEN** 不触发高亮逻辑

### Requirement: 列内排序（urgency↓ → dueDate↑）

系统 MUST 在每列内按紧急度降序 → 截止日期升序排序。

#### Scenario: 紧急度优先

- **GIVEN** Todo 列有 2 个 item：a（urgency='red'）/ b（urgency='yellow'）
- **WHEN** 渲染列
- **THEN** 顺序：a → b（红在前）

#### Scenario: 截止日期次之

- **GIVEN** Todo 列有 2 个 item：a（urgency='red', dueDate='2026-07-30'）/ b（urgency='red', dueDate='2026-07-20'）
- **WHEN** 渲染列
- **THEN** 顺序：b → a（b 截止早在前）

#### Scenario: 无 dueDate 排最后

- **GIVEN** Todo 列有 2 个 item：a（urgency='red', 无 dueDate）/ b（urgency='red', dueDate='2026-07-20'）
- **WHEN** 渲染列
- **THEN** 顺序：b → a（无 dueDate 排最后）

### Requirement: 数据过滤（active plans）

系统 MUST 在 `useKanbanData` 中过滤掉 `status === 'paused'` 的 plan 下的所有 item。

#### Scenario: paused plan 的 item 不出现

- **GIVEN** plan_1.status='doing' 含 3 item / plan_2.status='paused' 含 5 item
- **WHEN** 调用 useKanbanData
- **THEN** 返回的 itemsByStatus 只含 plan_1 的 3 item

#### Scenario: 全部 paused

- **GIVEN** 所有 plan.status='paused'
- **WHEN** 渲染 Kanban
- **THEN** 显 EmptyState + 「所有计划都已搁置，先去激活一个」

### Requirement: 列空态

系统 MUST 在某列内无 item 时显示「拖卡到这里」提示。

#### Scenario: 某列为空

- **GIVEN** Todo 列 items=[]
- **WHEN** 渲染 KanbanColumn
- **THEN** 列体底部显「拖卡到这里」+ 灰色 dashed 边框占位

#### Scenario: 全部 4 列为空

- **GIVEN** 所有列 items=[]
- **WHEN** 渲染 Kanban
- **THEN** 每列都显空态（4 个「拖卡到这里」）

### Requirement: 加载态

系统 MUST 在 live query 首帧（useKanbanData 返回 undefined）时显示 Skeleton 占位。

#### Scenario: 数据加载中

- **GIVEN** `useKanbanData().isLoading === true`
- **WHEN** 渲染 Kanban
- **THEN** 显 4 列 Skeleton（每列 3-4 个卡占位）

### Requirement: 跨页状态同步

系统 MUST 在用户从看板拖卡改状态后，`/plans/:id` 详情页（liveQuery 自动订阅）实时反映新状态。

#### Scenario: 详情页实时同步

- **GIVEN** 用户在 `/kanban` 把 item 拖到 Done
- **WHEN** 切到 `/plans/plan_1`（item 所属 plan）
- **THEN** 该 item 已显在 done 子集（liveQuery 通知）
- **AND** plan.progress 缓存自动更新（recomputeProgress 钩子）

---

