# ui-shell Specification

## Purpose
TBD - created by archiving change add-app-shell. Update Purpose after archive.
## Requirements
### Requirement: ErrorBoundary 捕获子组件渲染错误

系统 MUST 在应用根节点包裹 ErrorBoundary，捕获子组件树抛出的渲染期错误，并降级到错误 UI 而非白屏。

#### Scenario: 子组件抛错时不白屏

- **GIVEN** 应用根节点 `<ErrorBoundary>` 包裹 `<App />`
- **WHEN** 任意子组件渲染时抛错（throw new Error）
- **THEN** 渲染降级 UI：标题「出了点问题」+ 错误描述（dev 显示 message，生产隐藏）+ 按钮「重试 / 回到首页」
- **AND** 错误信息通过 `console.error` 输出（含 componentStack）

#### Scenario: 重试按钮清除错误状态

- **GIVEN** ErrorBoundary 当前处于降级态
- **WHEN** 用户点击「重试」按钮
- **THEN** 调用 `setState({ error: null })` 重新渲染子组件

#### Scenario: 自定义 fallback 插槽

- **GIVEN** 业务模块对错误降级 UI 有特殊需求
- **WHEN** 使用 `<ErrorBoundary fallback={<CustomUI />}>` 
- **THEN** 错误时渲染 CustomUI 而非默认降级

#### Scenario: 错误不跨边界传播

- **GIVEN** ErrorBoundary A 包裹 ErrorBoundary B；B 内的组件抛错
- **WHEN** B 触发降级
- **THEN** A 仍然正常渲染子组件（B 已降级，A 不会再次捕获）

---

### Requirement: LoadingOverlay 全屏加载遮罩

系统 MUST 提供 LoadingOverlay 组件作为路由级 / 视图级加载遮罩原语。

#### Scenario: visible=false 不渲染

- **GIVEN** `<LoadingOverlay visible={false} />`
- **WHEN** 组件渲染
- **THEN** 不输出任何 DOM 节点（返回 null）

#### Scenario: visible=true 全屏覆盖

- **GIVEN** `<LoadingOverlay visible={true} label="加载中…" />`
- **WHEN** 组件渲染
- **THEN** 渲染 `fixed inset-0 z-50` 全屏覆盖层，含 backdrop-blur 背景 + 居中 spinner + label 文案

#### Scenario: label 可自定义

- **GIVEN** `<LoadingOverlay visible={true} label="加载仪表盘…" />`
- **WHEN** 组件渲染
- **THEN** 显示 label 文案（默认「加载中…」）

#### Scenario: 路由切换时显示

- **GIVEN** React.lazy 加载 chunk 中
- **WHEN** Suspense 触发 fallback
- **THEN** 显示 LoadingOverlay；chunk 加载完成时消失

---

### Requirement: EmptyState 4 种 variant 通用空状态

系统 MUST 提供 EmptyState 组件作为无数据场景的视觉外壳，支持 4 种 variant。

#### Scenario: default variant 视觉

- **GIVEN** `<EmptyState variant="default" icon={Inbox} title="暂无数据" />`
- **WHEN** 组件渲染
- **THEN** icon 容器 64px + 标题 text-xl + 描述可选 + CTA 按钮可选

#### Scenario: compact variant 视觉

- **GIVEN** `<EmptyState variant="compact" icon={Inbox} title="暂无数据" />`
- **WHEN** 组件渲染
- **THEN** icon 容器 40px + 标题 text-base

#### Scenario: inline variant 视觉

- **GIVEN** `<EmptyState variant="inline" icon={Inbox} title="暂无数据" />`
- **WHEN** 组件渲染
- **THEN** icon 容器 32px + 标题 text-sm + 紧凑 padding（适合表格内行）

#### Scenario: illustration variant 视觉

- **GIVEN** `<EmptyState variant="illustration" icon={Inbox} title="暂无数据" />`
- **WHEN** 组件渲染
- **THEN** icon 容器 96px + 标题 text-2xl（适合 Dashboard 空状态 / 营销页）

#### Scenario: 包含 action CTA

- **GIVEN** `<EmptyState icon={Plus} title="还没有计划" action={{ label: '新建计划', onClick: fn }} />`
- **WHEN** 用户点击 CTA 按钮
- **THEN** 触发 `action.onClick()` 回调

#### Scenario: 不带 description / action

- **GIVEN** `<EmptyState icon={Inbox} title="暂无数据" />`（不传 description / action）
- **WHEN** 组件渲染
- **THEN** 不渲染描述段、不渲染 CTA 按钮（不显示空白占位）

---

### Requirement: Skeleton 基础骨架单元

系统 MUST 提供 Skeleton 组件作为数据未就绪时的占位元素。

#### Scenario: 自定义尺寸

- **GIVEN** `<Skeleton className="h-8 w-32" />`
- **WHEN** 组件渲染
- **THEN** 渲染 `bg-stone-200 animate-pulse rounded` 元素，尺寸由 className 控制

#### Scenario: rounded 关闭

- **GIVEN** `<Skeleton className="h-1 w-full" rounded={false} />`
- **WHEN** 组件渲染
- **THEN** 元素无 `rounded` 类（圆角矩形场景可关闭）

---

### Requirement: 路由级 React.lazy + Suspense

系统 MUST 对所有路由页面使用 React.lazy 导入并包裹 Suspense，避免首屏加载未访问页面的代码。

#### Scenario: 9 个页面均懒加载

- **GIVEN** `src/App.tsx` 路由表
- **WHEN** 静态分析
- **THEN** 所有 9 个页面（Dashboard / PlanList / PlanDetail / PlanEdit / BlogList / BlogDetail / BlogEdit / Kanban / Settings）通过 `React.lazy(() => import(...))` 引入

#### Scenario: vite build 产物分包

- **GIVEN** `pnpm build` 产物
- **WHEN** 检查 `dist/assets/`
- **THEN** 至少 3 个独立 chunk（plans / blogs / 其他），Dashboard 主 chunk 体积 < 200KB（gzip）

#### Scenario: 切页不白屏

- **GIVEN** 当前在 Dashboard 页
- **WHEN** 点击侧边栏「计划列表」
- **THEN** Suspense 触发前旧页保留渲染，新 chunk 加载完成后原子切换（不出现白屏）

#### Scenario: 切页显示 LoadingOverlay

- **GIVEN** 新页 chunk 加载中
- **WHEN** Suspense fallback 渲染
- **THEN** 显示 LoadingOverlay（带 route label 如「加载计划列表…」）

---

### Requirement: 根级 ErrorBoundary 集成

系统 MUST 在 main.tsx 顶层包裹 ErrorBoundary，捕获整个应用树（包括 React Router 与 AppLayout）的渲染错误。

#### Scenario: 根节点包裹

- **GIVEN** `src/main.tsx`
- **WHEN** 检查 React 树根
- **THEN** `<ErrorBoundary>` 包裹 `<BrowserRouter>` 与 `<App />`（最外层）

#### Scenario: 根级错误降级

- **GIVEN** AppLayout 渲染时抛错
- **WHEN** 错误冒泡到根 ErrorBoundary
- **THEN** 整个应用切换到降级 UI（含「重置应用」按钮 → 清除状态 + reload）

---

### Requirement: 4 组件不带业务依赖

系统 MUST 确保 ErrorBoundary / LoadingOverlay / EmptyState / Skeleton 4 个组件不依赖任何 plan / blog / item / store 类型，保持纯展示级。

#### Scenario: EmptyState 不引用 domain 类型

- **GIVEN** `src/components/shell/EmptyState.tsx`
- **WHEN** 检查 import
- **THEN** 不引入 `@/types/domain` / `@/stores/*` / `@/db/*`

#### Scenario: Skeleton 不引用 store

- **GIVEN** `src/components/shell/Skeleton.tsx`
- **WHEN** 检查 import
- **THEN** 不引入任何 store / hook（仅 `cn` 工具与 React）

---

### Requirement: Dashboard 复用本规范组件

系统 MUST 改造 Dashboard 复用本规范定义的 EmptyState 与 Skeleton，移除内嵌的 EmptyDashboard 与 SkeletonBlock。

#### Scenario: 移除内嵌实现

- **GIVEN** `src/pages/Dashboard.tsx` 经本 change 改造后
- **WHEN** 检查文件
- **THEN** 无 `EmptyDashboard` 函数定义、无 `SkeletonBlock` 函数定义

#### Scenario: 复用 EmptyState

- **GIVEN** Dashboard 空状态分支
- **WHEN** 渲染 `stats.activePlans === 0` 路径
- **THEN** 使用 `<EmptyState variant="default" icon={Notebook} ... />` 而非内部组件

#### Scenario: 复用 Skeleton

- **GIVEN** Dashboard 骨架屏分支
- **WHEN** 渲染 DashboardSkeleton
- **THEN** 所有占位使用 `<Skeleton className="..." />` 组件

---

