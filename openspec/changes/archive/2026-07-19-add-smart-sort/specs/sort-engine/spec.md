# sort-engine 规范（增量 / Delta Spec）

> **Capability**：`sort-engine`
> **Change**：`add-smart-sort`
> **类型**：ADDED Requirements（全新能力）
> **来源**：`src/stores/hooks/useSortedPlans.ts` 现有硬编码公式 + `architecture.md` §6.4 智能排序算法

本 capability 定义可复用排序引擎的契约——4 种预设、泛型签名、UI 切换器、状态持久化。所有需要排序的列表（计划 / 博客 / 看板）后续均委托本引擎。

---

## ADDED Requirements

### Requirement: 排序引擎签名

系统 MUST 提供泛型排序引擎 `sortEngine<T>(items, spec, options?)`，返回新数组（不修改入参）。

#### Scenario: 基本调用

- **GIVEN** `plans: Plan[]` + `{ key: 'smart' }`
- **WHEN** 调用 `sortEngine(plans, { key: 'smart' })`
- **THEN** 返回 `Plan[]`（新数组，浅拷贝）
- **AND** 原 `plans` 数组顺序不变

#### Scenario: 空数组

- **GIVEN** `plans: Plan[] = []`
- **WHEN** 调用 `sortEngine(plans, { key: 'smart' })`
- **THEN** 返回 `[]`
- **AND** 不抛错

#### Scenario: 单元素

- **GIVEN** `plans: Plan[]` 长度为 1
- **WHEN** 调用 `sortEngine(plans, { key: 'smart' })`
- **THEN** 返回长度 1 的新数组
- **AND** 元素与原数组相同

### Requirement: 4 种预设

系统 MUST 提供 4 种 SortKey：smart / recent / upcoming / progress，行为明确且互不耦合。

#### Scenario: smart 排序

- **GIVEN** 5 条 plan，urgency 各异
- **WHEN** 调用 `sortEngine(plans, { key: 'smart' })`
- **THEN** 按 4 关键字排序：`urgency asc → progress desc → endDate asc → createdAt desc`
- **AND** 与重构前 `sortPlans(plans)` 完全一致

#### Scenario: recent 排序

- **GIVEN** 3 条 plan，updatedAt 各异
- **WHEN** 调用 `sortEngine(plans, { key: 'recent' })`
- **THEN** 按 `updatedAt desc` 排序
- **AND** 最近更新的 plan 排首位

#### Scenario: upcoming 排序

- **GIVEN** 3 条 plan，2 条有 endDate，1 条无
- **WHEN** 调用 `sortEngine(plans, { key: 'upcoming' })`
- **THEN** 有 endDate 的按升序在前
- **AND** 无 endDate 的排最后

#### Scenario: progress 排序

- **GIVEN** 3 条 plan，progress 各异
- **WHEN** 调用 `sortEngine(plans, { key: 'progress' })`
- **THEN** 按 `progress desc` 排序
- **AND** 平 tie 用 `createdAt desc` 兜底

### Requirement: 引擎泛型复用

系统 MUST 让排序引擎可复用于非 Plan 实体（如 Blog），通过 `accessors` 注入字段取值函数。

#### Scenario: 默认 Plan accessors

- **GIVEN** 调用 `sortEngine(plans, { key: 'smart' })`
- **WHEN** 未传入 options.accessors
- **THEN** 使用内置 PLAN_ACCESSORS（`urgency` / `progress` / `endDate` / `createdAt` / `updatedAt`）
- **AND** 行为与直接传 accessors 一致

#### Scenario: Blog 复用

- **GIVEN** 调用 `sortEngine(blogs, { key: 'recent' }, { accessors: { updatedAt: b => b.updatedAt } })`
- **WHEN** 渲染 BlogList
- **THEN** 引擎按 blog.updatedAt desc 排序
- **AND** 不依赖 Plan 类型

### Requirement: UI 排序切换器

系统 MUST 在 plan-list 顶部提供 4 选项下拉切换器，切换瞬时生效。

#### Scenario: 默认渲染

- **GIVEN** 计划列表页加载
- **WHEN** 渲染 `<SortDropdown value="smart" />`
- **THEN** 显示「智能排序」+ ChevronDown 图标
- **AND** 点击展开 4 个选项

#### Scenario: 切换排序

- **GIVEN** 当前 value='smart'
- **WHEN** 用户在下拉中点击「最近活跃」
- **THEN** onChange('recent') 触发
- **AND** 下拉自动关闭
- **AND** 列表立即重排

#### Scenario: 选中态

- **GIVEN** value='progress'
- **WHEN** 渲染下拉
- **THEN** 「进度优先」选项显示选中态（左侧 brand-900 边 + 浅色背景）
- **AND** 其他 3 项不显示选中态

#### Scenario: Esc 关闭

- **GIVEN** 下拉打开
- **WHEN** 用户按 Esc
- **THEN** 下拉关闭
- **AND** 选中项不变

#### Scenario: 点击外部关闭

- **GIVEN** 下拉打开
- **WHEN** 用户点击下拉外部
- **THEN** 下拉关闭

### Requirement: 排序状态持久化

系统 MUST 将当前排序方案持久化到 localStorage，跨刷新保留。

#### Scenario: 首次进入

- **GIVEN** localStorage 中无 `planote-ui.planListSort`
- **WHEN** 进入计划列表页
- **THEN** `planListSort = 'smart'`（默认）

#### Scenario: 切换后持久化

- **GIVEN** 用户从 smart 切换到 'recent'
- **WHEN** setPlanListSort('recent') 调用
- **THEN** 内存 store 更新
- **AND** localStorage `planote-ui.planListSort = 'recent'`

#### Scenario: 刷新恢复

- **GIVEN** localStorage 存在 `planListSort = 'upcoming'`
- **WHEN** 刷新页面
- **THEN** `planListSort = 'upcoming'`（自动恢复）

#### Scenario: 损坏数据兜底

- **GIVEN** localStorage.planListSort = 'invalid-key'（脏数据）
- **WHEN** zustand persist 反序列化
- **THEN** fallback 到默认 'smart'（Zod / 自定义校验可拦截 v1.1）

### Requirement: 与现有 plan-list 兼容

系统 MUST 让重构后的 `useSortedPlans` 与原硬编码 `sortPlans` 在 default 行为上 100% 等价。

#### Scenario: 默认行为

- **GIVEN** 调用 `useSortedPlans(plans)`（不传 sort）
- **WHEN** 渲染
- **THEN** 等价于 `sortEngine(plans, { key: 'smart' })`
- **AND** 与重构前 `sortPlans(plans)` 结果完全一致

#### Scenario: PlanList 视觉不变

- **GIVEN** PlanList 改造后接入 planListSort='smart'
- **WHEN** 渲染
- **THEN** 列表顺序与改造前一致
- **AND** 现有 plan-list AC 全部满足（add-plan-list-view）

### Requirement: 与 SortHint 联动

系统 MUST 让 `<SortHint>` 排序提示条只在 `planListSort === 'smart'` 时显示。

#### Scenario: smart 模式显示

- **GIVEN** `planListSort = 'smart'`
- **WHEN** 渲染 PlanList
- **THEN** `<SortHint>` 显示「按紧急度 + 进度排序」提示

#### Scenario: 其他模式不显示

- **GIVEN** `planListSort = 'recent'`
- **WHEN** 渲染 PlanList
- **THEN** `<SortHint>` 不渲染（语义不匹配）

### Requirement: 视图模式 × 排序正交

系统 MUST 让 3 种视图模式（group / all / table）与 4 种排序正交组合，12 种组合全部生效。

#### Scenario: table + progress

- **GIVEN** view='table' + sort='progress'
- **WHEN** 渲染 PlanTableView
- **THEN** 表格按 progress desc 排序
- **AND** 表头可点击反转（v1.0 暂不实现反转；保留 TanStack Table 默认能力）

#### Scenario: all + upcoming

- **GIVEN** view='all' + sort='upcoming'
- **WHEN** 渲染 PlanListAllView
- **THEN** 列表按 endDate asc 排序
- **AND** 无 endDate 排最后

---

## Cross-Reference

- 现有 useSortedPlans：`src/stores/hooks/useSortedPlans.ts`（被本 change 重构）
- 紧急度算法：`src/shared/utils/urgency.ts`
- uiStore：`src/stores/uiStore.ts`（扩字段 + persist）
- 计划列表页：`src/pages/plans/PlanList.tsx`（接入 `<SortDropdown>`）
- 智能排序算法（PRD §6.4）：`docs/architecture.md`
