# plan-list Specification

## Purpose
TBD - created by archiving change add-plan-list-view. Update Purpose after archive.
## Requirements
### Requirement: 3 种视图模式切换

系统 MUST 在 `/plans` 路由提供 3 种视图模式（group / all / table），用户可在工具栏通过视图切换器切换，当前选中态视觉清晰（深色背景 + 白色文字）。

#### Scenario: 默认进入分组视图

- **GIVEN** 用户首次访问 `/plans`
- **WHEN** 页面加载
- **THEN** 默认显示分组视图（`planListView === 'group'`）
- **AND** 视图切换器「分组」按钮为选中态

#### Scenario: 切换至全部视图

- **GIVEN** 当前为分组视图
- **WHEN** 用户点击视图切换器「全部」按钮
- **THEN** 内容区切换为紧凑横排列表（`<PlanListAllView>`）
- **AND** 切换无白屏（复用 add-app-shell 的 Suspense 机制）

#### Scenario: 视图切换不重算数据

- **GIVEN** 数据已加载完成
- **WHEN** 用户在 3 视图间快速切换
- **THEN** useLiveQuery 不重复订阅（hooks pipeline 在顶层完成）
- **AND** 切换耗时 < 100ms（无 LoadingOverlay 闪烁）

#### Scenario: 视图切换 a11y

- **GIVEN** 视图切换器容器
- **WHEN** 检查 DOM 属性
- **THEN** 容器 `role="tablist"`，每个按钮 `role="tab"` + `aria-selected={isActive}`
- **AND** 键盘 Tab 顺序为「分组 → 全部 → 表格」

---

### Requirement: 智能排序（4 关键字）

系统 MUST 在数据进入列表前按 4 关键字排序：urgency 升序 → progress 降序 → endDate 升序 → createdAt 降序。

#### Scenario: 主关键字按紧急度

- **GIVEN** plans 数组包含 red/orange/yellow/none 各 1 个
- **WHEN** 调用 `sortPlans(plans)`
- **THEN** 排序结果顺序：red → orange → yellow → none

#### Scenario: 次关键字按进度降序

- **GIVEN** 2 个 plan 同为 red 紧急度，progress 分别为 30 / 80
- **WHEN** 调用 `sortPlans(plans)`
- **THEN** progress=80 的 plan 排在 progress=30 之前

#### Scenario: 三关键字按 endDate 升序

- **GIVEN** 2 个 plan 同紧急度同进度，endDate 分别为 2026-07-25 / 2026-07-20
- **WHEN** 调用 `sortPlans(plans)`
- **THEN** endDate=2026-07-20 的 plan 排在前

#### Scenario: 无 endDate 排最后

- **GIVEN** 2 个 plan 同紧急度同进度，plan A 有 endDate=2026-07-20，plan B 无 endDate
- **WHEN** 调用 `sortPlans(plans)`
- **THEN** plan A 排在前，plan B 排最后

#### Scenario: 四关键字按 createdAt 降序

- **GIVEN** 2 个 plan 前 3 关键字全部相同，createdAt 分别为 T1 / T2（T2 > T1）
- **WHEN** 调用 `sortPlans(plans)`
- **THEN** T2 的 plan 排在前（最新创建优先）

---

### Requirement: 全文搜索（title + description）

系统 MUST 在搜索框实时过滤 plans 数组，匹配 title 或 description 字段（大小写不敏感、空 query 透传）。

#### Scenario: title 匹配

- **GIVEN** plans 数组含 1 个 plan title='Plan Alpha'
- **WHEN** 搜索 query='plan'
- **THEN** 该 plan 包含在结果中（大小写不敏感）

#### Scenario: description 匹配

- **GIVEN** plans 数组含 1 个 plan description='完成 PRD 文档'
- **WHEN** 搜索 query='PRD'
- **THEN** 该 plan 包含在结果中

#### Scenario: 空 query 透传

- **GIVEN** plans 数组有 10 个 plan
- **WHEN** 搜索 query=''
- **THEN** 返回原 10 个 plan 数组（不复制）

#### Scenario: 搜索无结果

- **GIVEN** plans 数组有 5 个 plan
- **WHEN** 搜索 query='不存在的关键词xyz'
- **THEN** 返回空数组
- **AND** UI 显示 `<EmptyState variant="compact" title="没找到匹配的计划" action={...清除筛选} />`

---

### Requirement: 分组视图按 level 分组

系统 MUST 在分组视图中按 `Plan.level` 分为 3 组：短期 / 中期 / 长期，每组内复用智能排序结果，0 元素的组隐藏。

#### Scenario: 三组均显示

- **GIVEN** plans 数组中 short / mid / long 层级各 ≥ 1 个
- **WHEN** 渲染分组视图
- **THEN** 3 组均显示，每组标题 + 计数 badge

#### Scenario: 隐藏空分组

- **GIVEN** plans 数组中没有 long 层级 plan
- **WHEN** 渲染分组视图
- **THEN** 「长期」组不渲染（DOM 中不存在）

---

### Requirement: 分组视图折叠展开

系统 MUST 在每组前 5 个 plan 默认展示，超过 5 个时显示「展开剩余 N 个」虚线按钮；展开后显示全部 + 「收起」按钮。

#### Scenario: 默认折叠阈值

- **GIVEN** 「短期」组有 8 个 plan
- **WHEN** 渲染分组视图（首次进入）
- **THEN** 显示前 5 个 + 「展开剩余 3 个」虚线按钮

#### Scenario: 展开全部

- **GIVEN** 当前折叠态，「短期」组有 8 个 plan
- **WHEN** 用户点击「展开剩余 3 个」按钮
- **THEN** 显示全部 8 个 + 「收起」按钮
- **AND** 再次点击「收起」回到折叠态

#### Scenario: 折叠状态不持久化

- **GIVEN** 用户展开「短期」组
- **WHEN** 离开 `/plans` 后再次进入
- **THEN** 「短期」组重新折叠（折叠状态不写入 localStorage）

---

### Requirement: 全部视图紧凑横排

系统 MUST 在全部视图以紧凑横排展示 plans，每行包含进度环 + 标题 + 紧急度 tag + 进度百分比。

#### Scenario: 紧凑行渲染

- **GIVEN** plans 数组有 N 个
- **WHEN** 渲染全部视图
- **THEN** 每行单行布局（flex 横排），padding p-3
- **AND** 行内包含：进度环（24px）+ 标题（line-clamp-1）+ 紧急度 tag + 进度百分比

#### Scenario: 100+ plan 虚拟滚动

- **GIVEN** plans 数组有 500 个
- **WHEN** 渲染全部视图
- **THEN** 启用 react-virtuoso 虚拟滚动
- **AND** 滚动 FPS > 50

---

### Requirement: 表格视图 6 列 + 排序覆盖

系统 MUST 在表格视图用 TanStack Table 渲染 6 列：勾选 / 标题 / 层级 / 紧急度 / 进度 / 起止日期，列头点击切换排序时覆盖默认智能排序。

#### Scenario: 6 列渲染

- **GIVEN** plans 数组有 N 个
- **WHEN** 渲染表格视图
- **THEN** 表头包含 6 列：☐ / 标题 / 层级 / 紧急度 / 进度 / 起止日期
- **AND** 每行对应 1 个 plan

#### Scenario: 列头点击切换排序覆盖智能排序

- **GIVEN** 智能排序结果：red(0%) > orange(100%) > red(100%)
- **WHEN** 用户在表格视图点击「进度」列头（降序）
- **THEN** 表格按 progress 降序：orange(100%) / red(100%) / red(0%)
- **AND** 智能排序被覆盖，列头排序生效

#### Scenario: 多选勾选

- **GIVEN** 表格视图有 N 个 plan
- **WHEN** 用户勾选第 1 行 checkbox
- **THEN** 该行视觉变为 `bg-accent-50/30`
- **AND** 工具栏显示「已选 1 项」徽章

#### Scenario: 切回分组视图恢复智能排序

- **GIVEN** 表格视图已应用列头排序
- **WHEN** 用户切换到「分组」视图
- **THEN** 分组视图按智能排序（urgency → progress → endDate → createdAt）展示

---

### Requirement: 视图偏好持久化

系统 MUST 将视图模式（group / all / table）写入 `useUIStore.planListView` 字段，刷新页面后保留上次选择。

#### Scenario: 持久化写入 localStorage

- **GIVEN** 当前视图模式 = 'all'
- **WHEN** 用户切换至 'table' 视图
- **THEN** `useUIStore.planListView` 更新为 'table'
- **AND** localStorage `planote-ui` 键值同步更新

#### Scenario: 刷新后恢复

- **GIVEN** localStorage `planote-ui` 中 `planListView = 'table'`
- **WHEN** 用户刷新 `/plans` 页面
- **THEN** 视图模式 = 'table'，表格视图直接展示

---

### Requirement: 空状态与加载态

系统 MUST 在以下 3 种场景展示对应状态壳：
- 数据加载中 → 骨架屏
- 全部数据为空（无 query）→ illustration variant EmptyState
- 搜索无结果（query 非空）→ compact variant EmptyState

#### Scenario: 数据加载中

- **GIVEN** useLiveQuery 首帧返回 `undefined`
- **WHEN** 渲染 `/plans`
- **THEN** 显示 `<PlanListSkeleton />`（多个 `<Skeleton>` 组合占位）

#### Scenario: 全部数据为空

- **GIVEN** plans 数组为空数组（用户从未创建计划）
- **WHEN** 渲染 `/plans`，query 为空
- **THEN** 显示 `<EmptyState variant="illustration" icon={Notebook} title="还没有计划，从一个目标开始 ✨" action={...新建计划} />`

#### Scenario: 搜索无结果

- **GIVEN** plans 数组有 5 个，query='xyz'，过滤后 0 个
- **WHEN** 渲染 `/plans`
- **THEN** 显示 `<EmptyState variant="compact" icon={SearchX} title="没找到匹配的计划" description="试试其他关键词" action={{ label: '清除筛选', onClick: clearQuery }} />`

---

### Requirement: 路由可达

系统 MUST 将 `/plans` 路由渲染为本规范定义的列表页（替换现有 PlaceholderPage），保持与 add-app-shell 一致的懒加载。

#### Scenario: /plans 路由可达

- **GIVEN** 应用启动
- **WHEN** 用户访问 `/plans`（URL 直达或 Sidebar 跳转）
- **THEN** 渲染 `<PlanList />` 页面
- **AND** 路由切页时显示 LoadingOverlay（add-app-shell 体系）

---

