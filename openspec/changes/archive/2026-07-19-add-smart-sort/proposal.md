## Why

Planote 的列表页（计划 / 博客 / 看板）目前都靠一个写死在 `useSortedPlans` 里的 4 关键字公式做排序：`urgency asc → progress desc → endDate asc → createdAt desc`。这只能满足「智能排序」一种语义，无法响应「最近活跃」「即将到期」「进度优先」等更具体的用户场景。

- 当前 `useSortedPlans` 与 `sortPlans` 紧耦合在 `src/stores/hooks/useSortedPlans.ts` 里的硬编码公式
- 没有任何 UI 让用户切换排序方案——只能接受唯一的「智能」视图
- 同样需求在 BlogList、未来的 Kanban 都会出现——目前的代码无法跨页面复用

> 这一轮把排序从「写死的硬编码」抽成「可复用排序引擎 + 4 种预设 + UI 切换器 + 持久化」，覆盖前几轮已经隐隐冒出的「我想要按 X 排序」诉求。

## What Changes

### 1. 排序引擎

- 抽离出 `@/shared/utils/sortEngine.ts`，签名 `<T>(items: T[], sort: SortSpec<T>, options?) => T[]`
- `SortSpec<T>` 形如 `{ key: SortKey; direction?: 'asc' | 'desc' }`
- 内部用 `comparator` 工厂：`buildComparator(sort: SortSpec<T>): (a: T, b: T) => number`
- 复用 plan-list / blog-list / kanban 三个视图

### 2. 4 种预设

| SortKey | 含义 | 主键 + 方向 |
|---------|------|------------|
| `smart` | 智能（默认） | `urgency asc → progress desc → endDate asc → createdAt desc` |
| `recent` | 最近活跃 | `updatedAt desc`（v1.0 用 `updatedAt` 代理活跃度） |
| `upcoming` | 即将到期 | `endDate asc`（无 endDate 排最后） |
| `progress` | 进度优先 | `progress desc → createdAt desc` |

### 3. UI 切换器

- 计划列表页顶部增加一个 `<SortDropdown>`（下拉）
- 4 个选项 + 选中态标识
- 切换瞬时生效（不需要二次确认）
- 与现有 `<PlanViewSwitcher>` 视觉一致（同色系同圆角）

### 4. 排序状态持久化

- `useUIStore` 新增 `planListSort: SortKey` 字段，默认 `'smart'`
- 走现有 `persist` 中间件，localStorage key 保持 `planote-ui`
- 后续 blog-list 复用同一字段时只需加一个 `blogListSort`

### 5. 复用与改造

- `useSortedPlans(plans)` 重构：内部委托 `sortEngine(plans, sortSpec)`，行为兼容
- 现有 PlanList / PlanGroupedView / PlanListAllView / PlanTableView 视觉不动，仅数据 pipeline 换实现
- `add-blog-list` / `add-kanban` 后续 change 可直接调用引擎，无需新写排序逻辑

## Scope

**In Scope**：
- 排序引擎 `src/shared/utils/sortEngine.ts`（pure function + 类型）
- 4 种预设（smart / recent / upcoming / progress）
- `<SortDropdown>` 组件（4 选项 + 选中态）
- `useUIStore` 新增 `planListSort` 字段（持久化）
- `useSortedPlans` 重构委托引擎
- 计划列表页接 `<SortDropdown>`，默认 smart
- spec 增量：新增 `sort-engine` capability，6-8 个 ADDED Requirements，~20 个 Scenarios

**Out of Scope**：
- 标签筛选（v1.1）
- 全文搜索（v1.1）
- 自定义排序规则（用户拖字段排序）—— v1.2 之后
- BlogList 排序（v1.1 add-blog-list 接手）
- Kanban 排序（v1.1 add-kanban 接手；本 change 只预留接口）

## Acceptance Criteria

- [ ] **AC-1**：`sortEngine(plans, { key: 'smart' })` 返回值与重构前 `sortPlans(plans)` 完全一致（基准 100 条 plan 全等）
- [ ] **AC-2**：4 种预设全部生效，单元等价于各自手工实现的 comparator
- [ ] **AC-3**：`<SortDropdown>` 渲染 4 选项 + 选中态
- [ ] **AC-4**：切换排序 → 列表立即重排（无 loading 闪屏）
- [ ] **AC-5**：排序状态持久化（刷新页面后恢复）
- [ ] **AC-6**：`useSortedPlans(plans, 'smart')` 接口签名变化但 plan-list 行为 100% 兼容
- [ ] **AC-7**：`pnpm build` 0 error，`pnpm lint` 0 warning
- [ ] **AC-8**：`openspec validate add-smart-sort --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| 引擎设计过度抽象，未来 YAGNI | 中 | 保持纯函数 + 最小 API（`sortEngine(items, spec)`），不为未出现的字段写类型 |
| 4 预设歧义（用户预期不一致）| 中 | 每个预设名字清晰、UX 上加 hover 提示「按紧急度 + 进度排序」等说明 |
| 排序方向硬编码，用户无法反转 | 低 | `SortSpec.direction?: 'asc' \| 'desc'` 字段预留，v1.0 不暴露 UI |
| `recent` 用 `updatedAt` 不准 | 低 | v1.0 简化为 `updatedAt desc`，v1.1 接「最近勾选事项」事件流 |
| 排序状态污染其他页面 | 极低 | 字段名带前缀 `planListSort`，明确归 plan-list 使用 |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：Plan 模型 + `updatedAt` 字段
  - `add-zustand-stores`：`useUIStore` + `persist` 中间件
  - `add-plan-list-view`：现有 `useSortedPlans` 行为为基线

- **下游（待启动）**：
  - `add-blog-list`：可复用引擎 + 复用 `blogListSort` 字段
  - `add-kanban`：可复用引擎（按 `endDate asc` 渲染四列）

## Out of Scope Reminder

- 不实现标签筛选
- 不实现全文搜索
- 不暴露排序方向 UI（v1.0 默认 asc/desc 硬编码）
- 不为 BlogList / Kanban 接 UI（本 change 仅预留接口，不动其他页面）
- 不写单测
- 不引新依赖
