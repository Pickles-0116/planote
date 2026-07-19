## Why

当前 Planote 应用缺少统一的「应用 shell」基础设施：

- **错误边界（ErrorBoundary）缺失**：任何组件抛错都会导致整个应用白屏（React 默认行为）。v1.0 末 9 个页面铺开后，一个未捕获的异常会击穿所有页面，丢失用户工作区。
- **加载 / 空状态无统一约定**：`add-data-binding-dashboard` 在 Dashboard 内自建了 `DashboardSkeleton` / `EmptyDashboard`，但其他 8 个页面（计划列表、博客列表、看板等）会各自实现，视觉与交互不一致。
- **路由懒加载未启用**：所有页面在 `App.tsx` 顶层静态 `import`，首屏加载 ~300KB JS（含 Tiptap、TanStack Table 等当前并未用到的库）。Sprint 3 引入 Tiptap 后这个数字会更大，违背 project.md「首屏 < 1.5s」承诺。
- **异步数据态散落**：useLiveQuery 的 `undefined` 首帧目前由各组件自行处理（有的渲染骨架、有的渲染空、有的直接抛错），缺少一致的「LoadingOverlay / Suspense fallback」原语。

本 change 落地后所有后续 change（`add-plan-module` / `add-blog-module` / `add-kanban` 等）都能直接复用这些基础设施，组件层只关心业务数据展示，不再各自实现状态外壳。

## What Changes

### 1. ErrorBoundary 组件（根级）

- 路径：`src/components/shell/ErrorBoundary.tsx`
- 类型：class 组件（React 16+ 唯一支持 `componentDidCatch` 的方式）
- 捕获范围：整个 `App` 树
- 降级 UI：白底卡片 + 大标题「出了点问题」+ 错误描述（开发环境）+ 「重置应用」按钮（清除错误状态 + reload）

### 2. LoadingOverlay 组件

- 路径：`src/components/shell/LoadingOverlay.tsx`
- 定位：绝对定位覆盖（`fixed inset-0`），模糊背景（`backdrop-blur-sm`）+ 居中 spinner
- 用途：路由级 / 视图级加载遮罩（与 Dashboard 内骨架屏互补——前者是「无数据」语义，后者是「正在切换视图」语义）
- API：`visible: boolean` + `label?: string`（默认「加载中…」）

### 3. EmptyState 组件

- 路径：`src/components/shell/EmptyState.tsx`
- 用途：所有「无数据」场景的视觉外壳（无计划 / 无博客 / 无匹配搜索结果 / 无选中项等）
- API：4 种 `variant` —— `default` / `compact` / `inline` / `illustration`（icon 容器大小 64/40/32/96px）
- 4 个 slot：icon (Lucide) + title + description + CTA button
- 与 Dashboard 的 `EmptyDashboard` 关系：复用本组件替代，移除 Dashboard 内部实现

### 4. Skeleton 组件

- 路径：`src/components/shell/Skeleton.tsx`
- 用途：基础骨架单元（与现有 `SkeletonBlock` 等价但通用化）
- API：`<Skeleton className="h-8 w-32" />`，统一 `animate-pulse` + `bg-stone-200`

### 5. 路由级 Suspense + React.lazy

- 改造：`src/App.tsx` 将 9 个页面从静态 import 改为 `React.lazy`
- 每个 `<Route>` 包裹 `<Suspense fallback={<LoadingOverlay visible />}>` 或细粒度 fallback
- 切页体验：保留当前内容直到新页 bundle 加载完成（Suspense 旧行为），避免白屏闪烁

### 6. 根级集成

- 改造 `src/main.tsx`：在 `<App>` 之外包裹 `<ErrorBoundary>`
- 改造 `src/App.tsx`：routes 全部包 `<Suspense>` + `<LoadingOverlay>` fallback
- 改造 `src/pages/Dashboard.tsx`：复用 `EmptyState` 替代 `EmptyDashboard`，复用 `Skeleton` 替代 `SkeletonBlock`

## Scope

**In Scope**：

- 4 个新组件：`ErrorBoundary` / `LoadingOverlay` / `EmptyState` / `Skeleton`（统一在 `src/components/shell/`）
- `src/App.tsx` 改造：9 个页面 React.lazy + Suspense + LoadingOverlay fallback
- `src/main.tsx` 改造：根级 ErrorBoundary
- `src/pages/Dashboard.tsx` 改造：复用新组件替换内嵌的 `EmptyDashboard` / `SkeletonBlock`
- spec 增量：新增 `ui-shell` capability 的 8-10 个 Requirements

**Out of Scope**：

- UI 主题切换 / 暗色模式（v1.1 主题系统，本 change 不动 `useUIStore.theme`）
- 动画库（Framer Motion / React Spring）—— 用 Tailwind 自带 `animate-fadeUp` / `animate-pulse`
- 国际化 i18n（保留中文文案）
- Toast / Snackbar 通知（独立 change；本 change 仅在 ErrorBoundary 内做最简错误提示）
- 单元测试（Sprint 1-2 暂不强制）
- 具体页面的 Loading 状态重写（仅 Dashboard 复用本 change 组件；其他页面留给后续 change）
- 性能监控 / Sentry 接入（v1.1 线上监控）

## Acceptance Criteria

- [ ] **AC-1**：4 个组件（ErrorBoundary / LoadingOverlay / EmptyState / Skeleton）按 props 类型独立可复用，UI 视觉与 prototype 一致（白底 / 圆角 / 柔和阴影 / accent 强调色）
- [ ] **AC-2**：根级 ErrorBoundary 能捕获子组件抛出的运行时错误，降级 UI 显示「出了点问题」+ 错误描述（dev）+ 「重置」按钮，点击后状态清除
- [ ] **AC-3**：路由切换时显示 LoadingOverlay（首屏加载 Tiptap / TanStack Table 等 chunk 期间可见），加载完成后消失
- [ ] **AC-4**：所有 9 个页面均通过 `React.lazy` 导入，`vite build` 产物生成至少 3 个独立 chunk（plans / blogs / 其他）
- [ ] **AC-5**：`EmptyState` 4 种 variant（default / compact / inline / illustration）渲染结果与原型对照一致
- [ ] **AC-6**：Dashboard 复用 `EmptyState` + `Skeleton` 后视觉 100% 等价（无回归）
- [ ] **AC-7**：`pnpm build` 0 error，`pnpm dev` 控制台 0 warning（不含原有 AttachmentRepo / main.tsx 预存错误）
- [ ] **AC-8**：`openspec validate add-app-shell --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| ErrorBoundary 包裹后某些错误捕获不到（事件处理 / 异步 / SSR） | 低 | v1.0 主要在渲染期，class 组件即可；v1.1 引入 Sentry 时再扩 |
| React.lazy 首屏略慢（要等 Suspense 触发） | 低 | Vite 自动分包；首屏只懒加载当前路由对应的 chunk |
| LoadingOverlay 闪屏（route 切换瞬间） | 中 | Suspense 行为：保留旧页直到新页就绪；视觉上「轻微迟滞」优于「白屏」 |
| 4 个组件跨页面复用导致耦合 | 低 | 组件不带业务依赖（纯展示 + 通用 props），与现有 `Card` 同级 |
| Dashboard 复用 EmptyState 后视觉差异 | 低 | 同一组件相同 props 渲染结果应一致；用 `variant="illustration"` 保留 96px icon |
| React.lazy 失败（chunk 404） | 低 | 嵌套 ErrorBoundary 兜底，渲染「该页面加载失败」+ 重试 |

## Dependencies

- **上游（已完成）**：
  - Sprint 1 Step 1 脚手架：9 个占位页面 + AppLayout / Sidebar / Header
  - `add-data-layer-dexie`：6 个 Repository
  - `add-zustand-stores`：7 个 store + 8 个 useLiveQuery hook
  - `add-data-binding-dashboard`：Dashboard 5 个派生 hook + 内嵌 skeleton / empty 组件（本 change 抽取为通用组件）
- **下游（待启动）**：
  - `add-plan-module`：复用 LoadingOverlay 处理 useLiveQuery 未就绪态；EmptyState 处理空计划列表
  - `add-blog-module`：同上
  - `add-kanban`：Sprint 3 看板模块，懒加载 dnd-kit / virtuoso
  - `add-editor-tiptap`：Sprint 3 编辑器，独立大 chunk 懒加载

## Out of Scope Reminder

- 不重写 `useUIStore`（保留现有 `viewMode` / `theme` / `sidebarCollapsed` / `drawerStack`）
- 不引入 CSS-in-JS（继续用 Tailwind）
- 不改路由配置（路由表本身不变，只改导入方式）
- 不写组件测试（v1.0 Sprint 1-2 暂不强制）
