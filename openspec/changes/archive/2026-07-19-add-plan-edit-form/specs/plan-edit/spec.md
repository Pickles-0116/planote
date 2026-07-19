# plan-edit 规范（增量 / Delta Spec）

> **Capability**：`plan-edit`
> **Change**：`add-plan-edit-form`
> **类型**：ADDED Requirements（全新能力）
> **来源**：`docs/prd.md` §4.2（计划创建/编辑）+ `docs/ux-guidelines.md` §2 Flow A Step 2（三步表单）+ `openspec/specs/plan-data/spec.md`（Plan / Item 数据模型）

本 capability 描述 Planote 计划编辑表单 `/plans/new` 与 `/plans/:id/edit` 的完整交互契约——三步骤分步校验、事项增删、草稿自动保存、提交后跳转。所有后续 change（`add-item-crud` / `add-tag-module` / `add-blog-generation-flow`）在本规范定义的三步表单骨架上扩展。

---

## ADDED Requirements

### Requirement: 路由可达

系统 MUST 将 `/plans/new` 与 `/plans/:id/edit` 路由渲染为本规范定义的编辑表单（替换现有 PlaceholderPage）。

#### Scenario: 新建模式路由

- **GIVEN** URL 为 `/plans/new`
- **WHEN** 页面加载
- **THEN** 渲染 `<PlanEdit mode="create" />` 表单
- **AND** 显示步骤指示器 + 步骤 1 表单（基础信息）
- **AND** 表单为空 + 草稿自动保存开始监听

#### Scenario: 编辑模式路由

- **GIVEN** URL 为 `/plans/:id/edit` 且 `id` 对应的 plan 存在
- **WHEN** 页面加载
- **THEN** 渲染 `<PlanEdit mode="edit" />` 表单
- **AND** 表单预填现有 plan 字段（title / description / level / timeDim / dates / parentPlanId）
- **AND** 草稿自动保存开始监听

#### Scenario: 编辑模式 ID 不存在

- **GIVEN** URL 为 `/plans/:id/edit` 但 `id` 在 IndexedDB 中查无对应 plan
- **WHEN** 页面加载
- **THEN** 显示 `<EmptyState icon={AlertCircle} title="找不到该计划" description="该计划可能已被删除" action={{ label: '返回计划列表', onClick: navigateToPlans }} />`

---

### Requirement: 步骤状态机（3 步）

系统 MUST 提供 3 步线性步骤状态机，每步独立校验通过后才能进入下一步。

#### Scenario: 初始进入步骤 1

- **GIVEN** 表单加载
- **WHEN** 首次渲染
- **THEN** `step = 1` 激活
- **AND** 步骤指示器显示 1 active + 2 pending

#### Scenario: 步骤 1 → 步骤 2

- **GIVEN** 当前 `step = 1`
- **WHEN** 用户点击「下一步」按钮
- **AND** `title.trim().length > 0`
- **THEN** `step` 变为 2
- **AND** 步骤 1 标记为 completed
- **AND** 步骤 2 标记为 active

#### Scenario: 步骤 1 标题为空禁用

- **GIVEN** 当前 `step = 1`
- **AND** `title === ''`
- **WHEN** 渲染「下一步」按钮
- **THEN** 按钮 `disabled=true`，鼠标 hover 显示 tooltip「请填写标题」

#### Scenario: 步骤 2 → 步骤 3

- **GIVEN** 当前 `step = 2`
- **WHEN** 用户点击「下一步」按钮
- **AND** `level !== null` 且 `timeDim !== null`
- **THEN** `step` 变为 3

#### Scenario: 步骤 2 未选禁用

- **GIVEN** 当前 `step = 2`
- **AND** `level === null` 或 `timeDim === null`
- **WHEN** 渲染「下一步」按钮
- **THEN** 按钮 `disabled=true`

#### Scenario: 步骤指示器跳回已完成步骤

- **GIVEN** `step = 3`
- **AND** 步骤 1 已在 `completed` 集合
- **WHEN** 用户点击步骤 1 指示器
- **THEN** `step` 跳回 1，表单内容保留

#### Scenario: 步骤指示器跳 pending 步骤

- **GIVEN** `step = 1`
- **AND** 步骤 2 / 3 不在 `completed` 集合
- **WHEN** 用户点击步骤 2 指示器
- **THEN** 无响应（pending 步骤不可跳）

---

### Requirement: 基础信息表单（步骤 1）

系统 MUST 在步骤 1 收集标题、描述、起止日期 4 个字段。

#### Scenario: 标题必填

- **GIVEN** 用户在标题输入框输入文字
- **WHEN** 输入 ≥1 个非空白字符
- **THEN** `state.title` 更新
- **AND** 步骤 1 → 步骤 2 的「下一步」按钮解除 disabled

#### Scenario: 标题超长

- **GIVEN** `title.length > 100`
- **WHEN** 用户继续输入
- **THEN** input 拒绝（maxLength=100）

#### Scenario: 描述可选

- **GIVEN** 用户在描述输入框输入文字
- **WHEN** 输入任意字符
- **THEN** `state.description` 更新（无 maxLength 强制限制，UI 限制 500）

#### Scenario: endDate 早于 startDate

- **GIVEN** `startDate = '2026-07-20'`
- **WHEN** 用户选择 `endDate = '2026-07-19'`
- **THEN** 显示内联错误「截止日期不能早于开始日期」
- **AND** 「下一步」按钮保持 disabled

---

### Requirement: 类型 + 维度选择（步骤 2）

系统 MUST 在步骤 2 提供 3 个 level 卡片 + 4 个 timeDim 卡片供用户单选。

#### Scenario: 选择 level

- **GIVEN** 当前 `level = null`
- **WHEN** 用户点击「短期」卡片
- **THEN** `state.level = 'short'`
- **AND** 卡片视觉变为选中态（brand-900 背景白字）

#### Scenario: 取消 level

- **GIVEN** `level = 'short'`
- **WHEN** 用户再次点击「短期」卡片
- **THEN** `state.level = null`

#### Scenario: 选择 timeDim

- **GIVEN** 当前 `timeDim = null`
- **WHEN** 用户点击「每日」卡片
- **THEN** `state.timeDim = 'daily'`

#### Scenario: level + timeDim 联动

- **GIVEN** `level = 'long'` + `timeDim = 'daily'`
- **WHEN** 渲染高级选项折叠区
- **THEN** 「关联到上级计划」select 候选列表为空（无 long 的 long 父级）

---

### Requirement: 事项拆解（步骤 3）

系统 MUST 在步骤 3 提供可增删可编辑的事项列表，至少 1 个非空 title 才能保存。

#### Scenario: 添加事项

- **GIVEN** 当前 `items = [{ title: '事项 1' }]`
- **WHEN** 用户点击底部「+ 添加事项」按钮
- **THEN** `items` 末尾追加 `{ title: '', dueDate: undefined }`
- **AND** 自动 focus 新行 input

#### Scenario: 删除事项

- **GIVEN** 当前 `items = [{ title: 'A' }, { title: 'B' }, { title: 'C' }]`
- **WHEN** 用户点击第 2 行的删除按钮
- **THEN** `items` 变为 `[{ title: 'A' }, { title: 'C' }]`

#### Scenario: 上下移

- **GIVEN** `items = ['A', 'B', 'C']`
- **WHEN** 用户点击第 1 行的「下移」按钮
- **THEN** `items` 变为 `['B', 'A', 'C']`

#### Scenario: 边界移动

- **GIVEN** `items = ['A', 'B']`
- **WHEN** 用户点击第 1 行的「上移」按钮
- **THEN** 无响应（边界保护）

#### Scenario: 截止日期

- **GIVEN** 某事项 `dueDate = undefined`
- **WHEN** 用户选择 `dueDate = '2026-08-01'`
- **THEN** 事项对象的 `dueDate` 更新

#### Scenario: 至少 1 个非空 title

- **GIVEN** `items = [{ title: '' }, { title: '' }]`
- **WHEN** 渲染「保存」按钮
- **THEN** 按钮 `disabled=true`
- **AND** 底部提示「至少添加 1 个有效事项」

---

### Requirement: 高级选项折叠

系统 MUST 在步骤 3 提供「高级选项」折叠入口，含 3 个字段（v1.0 部分 disabled）。

#### Scenario: 默认折叠

- **GIVEN** 表单加载
- **WHEN** 渲染步骤 3
- **THEN** 高级选项默认折叠
- **AND** 显示「展开 高级选项」按钮

#### Scenario: 展开后内容

- **GIVEN** 用户点击「展开 高级选项」
- **WHEN** 折叠区展开
- **THEN** 显示 3 个字段：
  - 「完成后自动生成博客」checkbox（disabled + tooltip「v1.1 启用」）
  - 「每日提醒」checkbox（disabled + tooltip「v1.1 启用」）
  - 「关联到上级计划」select（启用）

#### Scenario: 关联上级选择

- **GIVEN** `parentPlanId = null`
- **WHEN** 用户从 select 选择某个 plan
- **THEN** `parentPlanId` 更新为该 plan 的 ID

---

### Requirement: 草稿自动保存

系统 MUST 在表单 dirty 状态 + 500ms debounce 后，将表单状态写入 localStorage。

#### Scenario: 草稿保存

- **GIVEN** 用户在 title 输入框输入「晨跑」
- **WHEN** 500ms 内无新输入
- **THEN** localStorage `planote:plan-edit:draft:<planId|none>` 写入完整 FormState JSON

#### Scenario: 草稿恢复

- **GIVEN** create 模式 + localStorage 存在草稿
- **WHEN** 用户进入 `/plans/new`
- **THEN** 表单字段从草稿恢复
- **AND** 步骤停留在草稿保存时的 step

#### Scenario: 草稿 ID 不匹配

- **GIVEN** edit 模式 + 路由 `:id = 'A'`
- **AND** localStorage 草稿 key 含 ID `'B'`
- **WHEN** 页面加载
- **THEN** 草稿忽略（不恢复）
- **AND** 表单从 plan store 预填

#### Scenario: 草稿清除

- **GIVEN** 草稿已保存
- **WHEN** 提交成功
- **THEN** localStorage 草稿被清空

#### Scenario: 草稿 quota 超限

- **GIVEN** localStorage 已满
- **WHEN** 草稿保存尝试写入
- **THEN** catch 异常 + 静默失败
- **AND** 不影响表单继续操作

---

### Requirement: 提交与跳转

系统 MUST 在 3 步全部满足时允许提交，create 模式创建新 plan + 批量创建事项，edit 模式只更新 plan 字段。

#### Scenario: create 模式提交

- **GIVEN** `mode = 'create'`
- **AND** 步骤 1/2/3 全部校验通过
- **WHEN** 用户点击「保存」
- **THEN** `usePlanStore.createPlan(input)` 调用
- **AND** `Promise.all(useItemsStore.createItem × N)` 批量创建事项
- **AND** 草稿清除
- **AND** `navigate('/plans/:newId')` 跳到新详情页

#### Scenario: edit 模式提交

- **GIVEN** `mode = 'edit'`
- **AND** 步骤 1/2 校验通过（步骤 3 字段 v1.0 不参与 edit 提交）
- **WHEN** 用户点击「保存」
- **THEN** `usePlanStore.updatePlan(id, patch)` 调用
- **AND** 草稿清除
- **AND** `navigate('/plans/:id')` 跳到原详情页

#### Scenario: 提交失败

- **GIVEN** `planRepo.create` 抛出错误
- **WHEN** 用户点击「保存」
- **THEN** catch + console.error 输出
- **AND** 表单保留当前状态
- **AND** 不跳转
- **AND** 草稿保留（用户可重试）

---

### Requirement: 离开提示

系统 MUST 在表单 dirty + 用户尝试离开时（路由变化或关闭 tab）弹确认提示。

#### Scenario: 路由变化

- **GIVEN** 表单 dirty（任意字段改动）
- **WHEN** 用户点击顶栏返回 / 侧边栏其他链接
- **THEN** 浏览器原生 `confirm` 弹窗「离开后未保存的内容将丢失，确定离开？」
- **AND** 用户选「确定」则离开 + 草稿保留
- **AND** 用户选「取消」则留在编辑页

#### Scenario: 关闭 tab

- **GIVEN** 表单 dirty
- **WHEN** 用户关闭浏览器 tab
- **THEN** 浏览器原生 beforeunload 提示
- **AND** 草稿保留（下次进入可恢复）

#### Scenario: 提交成功无提示

- **GIVEN** 表单 dirty
- **WHEN** 用户点击「保存」且提交成功
- **THEN** 直接跳详情页（不弹 confirm）

---

### Requirement: 与计划详情页闭环

系统 MUST 在保存成功后导航回详情页，让用户继续推进。

#### Scenario: create 后跳详情

- **GIVEN** create 模式提交成功
- **WHEN** navigate 调用
- **THEN** URL 变为 `/plans/<新 plan ID>`
- **AND** 详情页 Hero 区显示新建的计划

#### Scenario: edit 后跳详情

- **GIVEN** edit 模式提交成功
- **WHEN** navigate 调用
- **THEN** URL 变为 `/plans/<原 plan ID>`
- **AND** 详情页显示更新后的 plan

---

### Requirement: 视觉与详情页一致

系统 MUST 复用 `add-plan-detail-view` 已建的视觉模式：面包屑、按钮配色、卡片圆角 2xl、阴影 soft。

#### Scenario: 顶栏视觉一致

- **GIVEN** PlanEdit 顶栏
- **WHEN** 渲染
- **THEN** 返回按钮 + 标题 + 保存按钮的视觉与 PlanDetailTopBar 风格一致

#### Scenario: 步骤指示器视觉

- **GIVEN** Stepper 组件
- **WHEN** 渲染
- **THEN** 圆点 + 横线 + 文案的视觉与 prototype plan-edit.html 顶部指示器对齐

---

### Requirement: 加载与错误态

系统 MUST 在数据加载中显示骨架屏，ID 不存在显示空态。

#### Scenario: 加载中

- **GIVEN** edit 模式 + useLiveQuery 首帧返回 undefined
- **WHEN** 渲染
- **THEN** 显示 `<PlanEditSkeleton />`（标题 + 步骤指示器 + 表单字段占位）

#### Scenario: ID 不存在

- **GIVEN** edit 模式 + plan 不存在
- **WHEN** 渲染
- **THEN** 显示 `<EmptyState icon={AlertCircle} title="找不到该计划" />` + 返回按钮

#### Scenario: create 模式加载

- **GIVEN** create 模式
- **WHEN** 页面加载
- **THEN** 不显示骨架屏（无远程数据）
- **AND** 直接渲染空白表单

---

## Cross-Reference

- Plan 数据模型：`openspec/specs/plan-data/spec.md`
- Plan create/update 入参：`src/db/repos/types.ts` PlanCreateInput / PlanUpdatePatch
- 详情页视觉对齐：`openspec/specs/plan-detail/spec.md`
- 通用 UI Shell：`openspec/specs/ui-shell/spec.md`
- 列表页视觉对齐：`openspec/specs/plan-list/spec.md`
- 计划编辑原型：`docs/prototype/plan-edit.html`
- 计划创建原型：`docs/prototype/plan-detail.html`（创建流程）
