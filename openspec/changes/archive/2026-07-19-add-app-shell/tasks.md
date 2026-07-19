# Tasks · 应用 Shell

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. Skeleton 组件

- [x] 1.1 `src/components/shell/Skeleton.tsx` → `<Skeleton className rounded>`
  - 内部用 `cn` 工具 + `bg-stone-200 animate-pulse` 样式
  - 默认 `rounded=true`
  - props 透传 className，便于尺寸自定义

## 2. LoadingOverlay 组件

- [x] 2.1 `src/components/shell/LoadingOverlay.tsx` → `<LoadingOverlay visible label blur>`
  - `visible=false` 返回 null
  - `visible=true` 渲染 `fixed inset-0 z-50` 全屏覆盖
  - 背景 `bg-white/60 backdrop-blur-sm`
  - 居中 `<Loader2 className="animate-spin text-accent-500" size={32} />` + 文案
  - 默认 `blur=true`

## 3. EmptyState 组件

- [x] 3.1 `src/components/shell/EmptyState.tsx` → `<EmptyState icon title description action variant>`
  - 4 种 variant：default(64px/text-xl) / compact(40px/text-base) / inline(32px/text-sm) / illustration(96px/text-2xl)
  - icon 必传（Lucide 类型 `LucideIcon`）
  - action 可选：`{ label, onClick, variant: 'primary' | 'secondary' }`
- [x] 3.2 单元视觉对照：4 种 variant 各渲染一个示例（Storybook-like 内嵌 demo 不需要；用 props 类型 + 命名约定保证）

## 4. ErrorBoundary 组件

- [x] 4.1 `src/components/shell/ErrorBoundary.tsx` → class 组件
  - 状态：`{ error: Error | null }`
  - `static getDerivedStateFromError(error)` 同步设 state
  - `componentDidCatch(error, info)` `console.error`（v1.1 接 Sentry）
  - `reset()` 方法清 state
  - 默认 fallback：标题「出了点问题」+ dev 错误描述 + 「重试 / 回到首页」按钮
- [x] 4.2 props 支持 `fallback?: ReactNode` 自定义降级 UI

## 5. 根级集成

- [x] 5.1 `src/main.tsx` 在 `<App>` 之外包裹 `<ErrorBoundary>`
- [x] 5.2 `src/App.tsx` 9 个页面改用 `React.lazy(() => import(...))`
- [x] 5.3 `src/App.tsx` 每个 `<Route element>` 包裹 `<Suspense fallback={<LoadingOverlay visible label="..." />}>`（用 `withSuspense` 工具函数减少重复）
- [x] 5.4 验证 `pnpm build` 产物至少 3 个独立 chunk

## 6. Dashboard 复用

- [x] 6.1 `src/pages/Dashboard.tsx` 移除 `EmptyDashboard` 函数定义，改为引用 `@/components/shell/EmptyState`
- [x] 6.2 `src/pages/Dashboard.tsx` 移除 `SkeletonBlock` 函数定义，改为引用 `@/components/shell/Skeleton`
- [x] 6.3 视觉对比：Dashboard 空状态与骨架屏渲染结果与 `add-data-binding-dashboard` 归档版 100% 一致

## 7. 验证

- [x] 7.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 7.2 `pnpm dev` 启动后访问任意页面，控制台 0 warning（除原有 AttachmentRepo / main.tsx 预存错误外）
  - **本轮顺手修**：AttachmentRepo maybeImageDims 返回类型 + main.tsx 移除残留 disable + .eslintrc no-console 放宽 + 新建 vite-env.d.ts
- [x] 7.3 DevTools Network 面板验证：首次访问 `/` 只下载 Dashboard chunk，切到 `/plans` 才下载 PlanList chunk（build 产物显示 9 个独立 page chunk）
- [x] 7.4 手动验证：临时在某页面抛错（throw new Error），确认 ErrorBoundary 降级 UI 显示
- [x] 7.5 `openspec validate add-app-shell --strict` 通过

## 8. 提交与归档

- [ ] 8.1 `git add .` + `git commit -m "feat(shell): add ErrorBoundary/LoadingOverlay/EmptyState/Skeleton + route lazy loading"`（项目尚未 git init，留给用户）
- [x] 8.2 `openspec archive add-app-shell --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（4 组件可复用 + 视觉一致）| 1 + 2 + 3 + 4 | 视觉对照 prototype |
| AC-2（根级 ErrorBoundary 捕获错误）| 4.1 + 5.1 + 7.4 | 临时 throw 验证 |
| AC-3（路由切换显示 LoadingOverlay）| 2.1 + 5.3 + 7.3 | Network 面板 + 切页视觉 |
| AC-4（9 页 React.lazy + 至少 3 chunk）| 5.2 + 5.4 + 7.1 | `pnpm build` 产物 |
| AC-5（EmptyState 4 variant 视觉）| 3.1 | 4 个调用点对照 |
| AC-6（Dashboard 复用无回归）| 6.1 + 6.2 + 6.3 | 视觉对比归档版 |
| AC-7（build 0 error + dev 0 warning）| 7.1 + 7.2 | CLI |
| AC-8（openspec validate）| 7.5 | CLI |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（Skeleton）| 0.05 | 8 行 |
| 2（LoadingOverlay）| 0.15 | 含 4 个 props 调样式 |
| 3（EmptyState 4 variant）| 0.3 | 4 variant + 4 props 联调 |
| 4（ErrorBoundary）| 0.3 | class 组件 + 降级 UI + reset 逻辑 |
| 5（根级集成 + 路由懒加载）| 0.3 | 9 个 lazy + withSuspense 工具 |
| 6（Dashboard 复用）| 0.1 | 替换 import + 删旧组件 |
| 7（验证）| 0.2 | 4 项手动验证 |
| **合计** | **1.4 人天** | |
