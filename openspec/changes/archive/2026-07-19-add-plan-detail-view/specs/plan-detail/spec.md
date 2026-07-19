# plan-detail 规范（增量 / Delta Spec）

> **Capability**：`plan-detail`
> **Change**：`add-plan-detail-view`
> **类型**：ADDED Requirements（全新能力）
> **来源**：`docs/prd.md` §4.4（计划详情）+ `docs/ux-guidelines.md` §2（详情页布局）+ `openspec/specs/plan-data/spec.md`（Plan / Item 数据模型）

本 capability 描述 Planote 计划详情页 `/plans/:id` 的完整交互契约——事项勾选联动进度、100% 完成金色横幅、关联博客区、框架抽屉入口。所有后续 change（`add-plan-edit-form` / `add-item-crud` / `add-blog-generation-flow`）在本规范定义的详情页骨架上扩展。

---

## ADDED Requirements

### Requirement: 详情页路由可达

系统 MUST 将 `/plans/:id` 路由渲染为本规范定义的详情页（替换现有 PlaceholderPage），与 `add-plan-list-view` 的列表页保持视觉一致与懒加载策略。

#### Scenario: 合法 ID 渲染详情页

- **GIVEN** URL 为 `/plans/:id` 且 `id` 对应的 plan 存在
- **WHEN** 页面加载
- **THEN** 渲染 `<PlanDetail />` 页面，含顶栏 + Hero（进度环 + 关键数据）+ 事项列表 + 关联博客区
- **AND** 路由切页时显示 LoadingOverlay（add-app-shell 体系）

#### Scenario: 不存在的 ID 显示空态

- **GIVEN** URL 为 `/plans/:id` 但 `id` 在 IndexedDB 中查无对应 plan
- **WHEN** 页面加载
- **THEN** 显示 `<EmptyState variant="default" icon={AlertCircle} title="找不到该计划" description="该计划可能已被删除" action={{ label: '返回计划列表', onClick: navigateToPlans }} />`

#### Scenario: ID 参数缺失

- **GIVEN** URL 为 `/plans/`（无 ID）
- **WHEN** 页面加载
- **THEN** 路由匹配失败，App.tsx 兜底 `<Navigate to="/" replace />`

---

### Requirement: 进度环（SVG）

系统 MUST 在详情页 Hero 区中央渲染 SVG 圆形进度环，0-100 整数百分比 + 中心文字标签。

#### Scenario: 渲染进度环

- **GIVEN** plan.progress = 67
- **WHEN** 渲染详情页
- **THEN** 进度环 SVG 渲染，顶层 `<circle>` 的 stroke-dashoffset 计算正确（67% 弧度）
- **AND** 中心显示文字「67%」+ 副标题「完成度」

#### Scenario: 0% 进度

- **GIVEN** plan.progress = 0
- **WHEN** 渲染详情页
- **THEN** 进度环为空圆（无填充弧），中心显示「0%」

#### Scenario: 100% 进度

- **GIVEN** plan.progress = 100
- **WHEN** 渲染详情页
- **THEN** 进度环满圆，颜色变为 emerald-500
- **AND** stroke 出现 0 → 360° 动画（300ms ease-out）

#### Scenario: 进度值越界兜底

- **GIVEN** plan.progress = 150（异常值）
- **WHEN** 渲染详情页
- **THEN** 进度环内部 clamp 到 100，中心显示「100%」

#### Scenario: 进度值负数兜底

- **GIVEN** plan.progress = -10（异常值）
- **WHEN** 渲染详情页
- **THEN** 进度环内部 clamp 到 0，中心显示「0%」

---

### Requirement: 事项勾选与进度联动

系统 MUST 在用户勾选/取消事项时，实时反映 UI 状态 + 触发 Plan.progress 字段重算，确保进度环与 Plan 数据同步。

#### Scenario: 单击勾选触发

- **GIVEN** 事项 status = 'pending', checked = false
- **WHEN** 用户点击 checkbox
- **THEN** UI 立即反映（item.status = 'done', checked = true，行变 line-through）
- **AND** `useItemStore.toggle(id)` 异步执行（fire-and-forget）
- **AND** 200ms 后触发 `planRepo.recomputeProgress(planId)` 重算

#### Scenario: 取消勾选触发

- **GIVEN** 事项 status = 'done', checked = true
- **WHEN** 用户点击 checkbox
- **THEN** UI 立即反映（item.status = 'pending', checked = false）
- **AND** 200ms 后 progress 字段更新

#### Scenario: 连续勾选防抖

- **GIVEN** 用户在 200ms 内连续勾选 5 个事项
- **WHEN** 第 5 次勾选完成
- **THEN** `recomputeProgress` 仅在第 5 次勾选后触发 1 次（debounce 200ms 生效）
- **AND** 进度环在 200ms 后一次性更新到正确值

#### Scenario: 勾选联动 Plan.progress

- **GIVEN** plan 有 4 个事项，其中 3 个已勾选，progress = 75
- **WHEN** 用户勾选第 4 个事项
- **THEN** 200ms 后 Plan.progress 更新为 100
- **AND** 进度环颜色变为 emerald-500 + 触发 100% 动画
- **AND** 100% 完成横幅出现

#### Scenario: 勾选失败回滚

- **GIVEN** itemRepo.toggle 抛出错误（模拟 Dexie 写入失败）
- **WHEN** 用户点击 checkbox
- **THEN** UI 状态回滚到点击前
- **AND** console.error 输出错误
- **AND** 错误 toast 提示（v1.0 简化为 console.error + 不更新 progress）

---

### Requirement: 事项状态切换（待办/进行中/已完成）

系统 MUST 在 hover 事项行时显示「标记进行中」/「标记待办」按钮，允许用户在 3 种状态间切换。

#### Scenario: 标记进行中

- **GIVEN** 事项 status = 'pending'
- **WHEN** 用户 hover 行 + 点击「标记进行中」按钮
- **THEN** item.status 更新为 'doing'
- **AND** 行左侧出现 2px 蓝色左边框
- **AND** 行内显示「进行中」badge

#### Scenario: 进行中标记已完成

- **GIVEN** 事项 status = 'doing'
- **WHEN** 用户勾选 checkbox
- **THEN** item.status 更新为 'done'（doing 状态可直接勾选）
- **AND** 进度联动生效

#### Scenario: 从已完成回退

- **GIVEN** 事项 status = 'done', completedAt 已设置
- **WHEN** 用户取消勾选
- **THEN** item.status 更新为 'pending'，checked = false
- **AND** completedAt 字段保留（不清空，v1.1 决定是否清空）

---

### Requirement: 100% 完成金色横幅

系统 MUST 在 plan.progress 达到 100% 时显示金色横幅 + 「生成总结博客」CTA 入口；用户关闭后本会话内不再显示。

#### Scenario: 进度达到 100% 触发横幅

- **GIVEN** plan.progress < 100
- **WHEN** 用户勾选最后一个未勾选事项
- **THEN** 200ms 后 progress 字段更新为 100
- **AND** 页面顶部出现 `<CompletionBanner>` 金色横幅

#### Scenario: 直接进入 100% 的 plan

- **GIVEN** 用户导航到 `/plans/:id` 且 plan.progress = 100
- **WHEN** 页面加载
- **THEN** 横幅立即出现（无动画延迟）

#### Scenario: 用户关闭横幅

- **GIVEN** 横幅显示中
- **WHEN** 用户点击关闭 X 按钮
- **THEN** 横幅从 DOM 移除
- **AND** sessionStorage `planote:plan-detail:banner-dismissed` 数组追加当前 planId

#### Scenario: 跨 plan 互不干扰

- **GIVEN** plan A 已 100% 且横幅已关闭
- **WHEN** 用户切换到 plan B（progress = 100）
- **THEN** plan B 的横幅正常显示（dismissed 集合按 planId 区分）

#### Scenario: 刷新页面重新显示

- **GIVEN** plan.progress = 100 且 sessionStorage 中已 dismissed
- **WHEN** 用户刷新页面
- **THEN** sessionStorage 清空（sessionStorage 生命周期结束）
- **AND** 横幅重新出现

#### Scenario: 横幅 CTA 唤起抽屉

- **GIVEN** 横幅显示中
- **WHEN** 用户点击「✨ 生成总结博客」CTA
- **THEN** `useUIStore.openDrawer('framework', { sourcePlanId: plan.id })` 调用
- **AND** `<FrameworkDrawer>` 滑入

---

### Requirement: 关键数据展示

系统 MUST 在 Hero 区右侧展示 5 个只读数据点：已完成事项、总事项、进度、坚持天数、剩余/截止日期、关联博客数。

#### Scenario: 5 个数据点渲染

- **GIVEN** plan 包含 8 个事项（5 已完成）, endDate = '2026-07-25', blogIds.length = 2
- **WHEN** 渲染详情页
- **THEN** 5 个数据卡均显示：
  - 已完成事项：5
  - 总事项：8
  - 进度：62%（实际按 plan.progress 字段）
  - 坚持天数：N（基于 createdAt 推算）
  - 截止/剩余：3 天后
  - 关联博客：2 篇

#### Scenario: 无 endDate 计划

- **GIVEN** plan.endDate = undefined
- **WHEN** 渲染详情页
- **THEN** 「截止/剩余」数据点显示「持续」+ 灰色文本

---

### Requirement: 关联博客区

系统 MUST 在详情页底部展示当前 plan 的 blogIds 对应博客卡片；空时显示空态 + CTA。

#### Scenario: 有关联博客

- **GIVEN** plan.blogIds = ['01H...', '01H...']
- **WHEN** 渲染详情页
- **THEN** `<PlanBlogsSection>` 显示对应博客的 3 列卡片网格
- **AND** 点击博客卡片进入 `/blogs/:id`

#### Scenario: 有关联博客但被删除

- **GIVEN** plan.blogIds = ['01H...'] 但该博客已从 IndexedDB 删除
- **WHEN** 渲染详情页
- **THEN** blogRepo.listByIds 过滤掉不存在的 ID
- **AND** 显示空态（或简化：不显示被删除的博客）

#### Scenario: 无关联博客

- **GIVEN** plan.blogIds.length = 0
- **WHEN** 渲染详情页
- **THEN** 显示空态：EmptyState compact + 「生成总结博客」CTA

---

### Requirement: 框架抽屉入口

系统 MUST 提供右侧抽屉（480px 宽）展示 4 套内置博客框架卡片；选中后控制台 log 占位 + 关闭抽屉。

#### Scenario: 唤起抽屉

- **GIVEN** 用户点横幅 CTA 或「生成总结博客」按钮
- **WHEN** 点击触发
- **THEN** `<FrameworkDrawer>` 从右侧滑入（300ms 过渡）
- **AND** 背景黑色/30 半透明遮罩覆盖

#### Scenario: 4 套框架卡片渲染

- **GIVEN** 抽屉已打开
- **WHEN** 渲染抽屉内容
- **THEN** 显示 4 张框架卡片：项目复盘 / 21天习惯 / 读书笔记 / 月度总结
- **AND** 每卡片含框架名 + 描述 + icon

#### Scenario: 选中框架

- **GIVEN** 抽屉打开中
- **WHEN** 用户点击「项目复盘」卡片
- **THEN** console.log 输出 `[v1.1] generate blog from plan ${id} with framework project-review`
- **AND** `useUIStore.closeDrawer('framework')` 调用
- **AND** 抽屉滑出消失

#### Scenario: ESC 关闭抽屉

- **GIVEN** 抽屉打开中
- **WHEN** 用户按 ESC 键
- **THEN** `useUIStore.closeTopDrawer()` 调用
- **AND** 抽屉关闭

#### Scenario: 背景点击关闭

- **GIVEN** 抽屉打开中
- **WHEN** 用户点击背景遮罩
- **THEN** 抽屉关闭（同 ESC 行为）

#### Scenario: 路由切换清空抽屉栈

- **GIVEN** 抽屉打开中（任意）
- **WHEN** 用户切换路由（如 /plans → /blogs）
- **THEN** `useUIStore.closeAllDrawers()` 调用（AppLayout 中 effect）
- **AND** 抽屉栈清空，避免「幽灵抽屉」

---

### Requirement: 加载与错误态

系统 MUST 在数据加载中显示骨架屏，加载失败显示错误态，ID 不存在显示空态。

#### Scenario: 数据加载中

- **GIVEN** useLiveQuery 首帧返回 undefined
- **WHEN** 渲染详情页
- **THEN** 显示 `<PlanDetailSkeleton />`（多个 Skeleton 组合占位）

#### Scenario: Dexie 错误

- **GIVEN** usePlan(id) 抛出错误（模拟 Dexie 不可用）
- **WHEN** 渲染详情页
- **THEN** 显示错误态（EmptyState variant=default, title="加载失败"）+ 重试按钮

#### Scenario: 路由参数无效

- **GIVEN** URL 为 `/plans/null` 或 `/plans/undefined`
- **WHEN** 页面加载
- **THEN** useLiveQuery 返回 undefined → 骨架屏持续显示
- **AND** 超时（5s）后显示「找不到该计划」空态

---

### Requirement: 视觉与列表页一致

系统 MUST 复用 `add-plan-list-view` 已建的视觉模式：紧急度色边、layer+dim badges、状态徽章、卡片圆角 2xl、阴影 soft。

#### Scenario: 紧急度左边框

- **GIVEN** plan.urgency = 'red'
- **WHEN** 渲染详情页 Hero 区
- **THEN** 进度环外层容器有 4px 红色左边框（border-l-red-500）

#### Scenario: 状态徽章

- **GIVEN** plan.status = 'done'
- **WHEN** 渲染详情页顶栏
- **THEN** 顶栏右侧显示「已完成」badge（emerald 配色）

#### Scenario: 100% 完成特殊样式

- **GIVEN** plan.progress = 100
- **WHEN** 渲染详情页
- **THEN** Hero 区背景变为 emerald-50/30 + 边框 emerald-200（与列表页「可总结」卡片一致）

---

## Cross-Reference

- Plan 数据模型（field / enum / 派生字段）：`openspec/specs/plan-data/spec.md`
- Item 数据模型 + checked 冗余字段：`openspec/specs/plan-data/spec.md` Requirement: Item 数据模型
- 进度派生计算：`openspec/specs/plan-data/spec.md` Requirement: 进度派生计算
- 紧急度派生计算：`openspec/specs/plan-data/spec.md` Requirement: 紧急度派生计算
- 通用 UI Shell：`openspec/specs/ui-shell/spec.md`
- 抽屉栈管理：`openspec/specs/ui-state/spec.md` Requirement: 抽屉栈式管理
- useLiveQuery 订阅约定：`openspec/specs/ui-state/spec.md`
- 列表页视觉对齐：`openspec/specs/plan-list/spec.md`
- 计划列表原型：`docs/prototype/plan-detail.html`
- PRD：「计划 → 完成 → 沉淀为博客」闭环：`docs/prd.md` §4.4
