# item-crud Specification

## Purpose
TBD - created by archiving change 2026-07-23-fix-item-crud-and-batch-import. Update Purpose after archive.
## Requirements
### Requirement: 计划详情页 MUST 支持内联添加 / 编辑 / 删除事项

`ItemChecklist` 组件 MUST 提供完整的事项 CRUD 交互,不允许按钮永远 disabled。

#### Scenario: 添加新事项
- GIVEN 用户在 `/plans/:id` 详情页,plan 已有 ≥0 个事项
- WHEN 点击「+ 添加事项」按钮
- THEN MUST 展开一个 inline input
- AND 用户输入标题按回车后 MUST 调用 `useItemCRUD.add(planId, { title })`
- AND 新事项 MUST 立即出现在列表中
- AND Plan.progress 计数 / 进度环 MUST 实时更新
- AND input MUST 保留焦点,允许用户连续添加多条

#### Scenario: 编辑事项标题
- GIVEN 列表中有一个 todo 状态的事项
- WHEN 用户双击事项标题
- THEN MUST 切换为可编辑 input
- AND 失焦或回车后 MUST 调用 `useItemCRUD.update(itemId, { title })` 并退出编辑态
- AND 标题为空 + 失焦 MUST 调用 `remove(itemId)` 删除该事项

#### Scenario: 删除事项
- GIVEN 列表中有一个事项
- WHEN 用户点击删除按钮
- THEN MUST 调 `useItemCRUD.remove(itemId)`
- AND Plan.progress MUST 自动重算

### Requirement: 计划编辑页 MUST 正确预填现有事项

`PlanEdit` 在 edit 模式下 MUST 从 plan store 读取现有 items 并预填到 `state.items`。

#### Scenario: 打开已有计划的编辑页
- GIVEN 用户打开 `/plans/:id/edit`,plan 已有 3 个事项
- WHEN 进入 Step 3「拆解事项」
- THEN MUST 显示 3 条预填事项
- AND 现有事项 MUST 用 `existingId` 标记

#### Scenario: 编辑页保存后所有变更持久化
- GIVEN 编辑页 Step 3 有 items 变更
- WHEN 用户点保存
- THEN MUST 触发 `usePlanEditSubmit` 内部 items diff
- AND MUST 正确执行 create / update / delete 三类操作
- AND Plan 重新加载后 MUST 显示完整最新状态

### Requirement: usePlanEditSubmit MUST 支持 items 增删改

`usePlanEditSubmit` 在 edit 模式下 MUST 不仅更新 plan 字段,还要对 items 做 diff 并执行 create / update / delete。

#### Scenario: edit 模式 items diff 算法
- GIVEN draft.items 与 planStore.items 存在差异
- WHEN submit 触发
- THEN MUST 计算三类操作:
  - `toCreate`: draft 中无 existingId 且 title.trim() !== ''
  - `toUpdate`: draft 中 existingId 存在 + 字段变化
  - `toDelete`: planStore 中有, draft 中无
- AND MUST 串行执行 create → update → delete
- AND 类内 MUST 并行
- AND MUST 全部包在一个 Dexie transaction 中

### Requirement: useItemCRUD hook MUST 提供统一 API

`useItemCRUD(planId)` hook MUST 提供 6 个方法 `{ add, update, remove, setStatus, toggle, reorder }`。

#### Scenario: API 完整性
- GIVEN `useItemCRUD(planId)` 调用
- THEN MUST 返回完整 6 个方法
- AND 所有方法 MUST 包 Dexie transaction
- AND 写操作 MUST 触发 plan.progress 自动重算

