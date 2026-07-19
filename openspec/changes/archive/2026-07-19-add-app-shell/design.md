# Design · 应用 Shell（ErrorBoundary / LoadingOverlay / EmptyState / Skeleton + 路由懒加载）

> 本文档回答**「4 个通用组件长什么样、为什么这样设计、路由懒加载怎么集成、根级 ErrorBoundary 怎么兜底」**。
> 不重复 `architecture.md` 已写的内容，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 错误捕获 | class 组件 + `componentDidCatch` | 函数式 + try/catch | React 16+ 唯一支持 `static getDerivedStateFromError` 的方式 |
| 路由懒加载 | `React.lazy` + `Suspense` | `loadable-components` | 零依赖；React Router 6 + Vite 原生支持 |
| 加载遮罩 | 绝对定位 + `backdrop-blur-sm` | 进度条 / NProgress | 视觉与 prototype 一致；无第三方依赖 |
| 空状态 | 4 variant：default/compact/inline/illustration | 单一尺寸 | 覆盖 80% 用法：仪表盘大空状态 + 列表紧凑空 + 表格行内空 + 营销插画 |
| 骨架单元 | `<Skeleton>` + Tailwind animate-pulse | 自定义 keyframe | Tailwind 自带；与现有 `SkeletonBlock` 视觉一致 |
| 目录 | `src/components/shell/` | `src/shared/components/` | 语义更清晰：shell = 应用外壳专用，与通用 `Card` 同级 |
| Suspense fallback | LoadingOverlay（与 Skeleton 并存） | 仅 Skeleton | 路由级 vs 数据级语义不同：前者「整页切换」后者「无数据占位」 |

---

## 2. 关键架构决策

### 2.1 4 个组件都「不带业务依赖」

```ts
// ✅ 纯展示组件，props 全部为视觉/状态描述
export function EmptyState({ icon: Icon, title, description, action, variant }: EmptyStateProps) { ... }
```

**为什么**：
- 与 `Card` / `Button` 同级，不耦合 plan / blog 领域
- 单元测试无需 mock store
- 跨页面复用（Dashboard / PlanList / BlogList / Kanban / Settings 等都能用）

**反例**（避免）：

```ts
// ❌ 业务耦合：把「计划」写进组件
export function EmptyPlans() { return <EmptyState title="暂无计划" /> }
```

业务文案由调用方传入（`title="还没有计划"`），组件本身不知道是「计划」还是「博客」。

### 2.2 ErrorBoundary 选 class 组件

React 16+ 起，`componentDidCatch` + `static getDerivedStateFromError` **只**在 class 组件中可用（直到 React 19 的官方 ErrorBoundary hook 稳定前不依赖）。

```tsx
export class ErrorBoundary extends Component<Props, State> {
  state = { error: Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() { return this.state.error ? <FallbackUI /> : this.props.children; }
}
```

### 2.3 路由懒加载与 Suspense fallback 选择

```tsx
// src/App.tsx
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PlanList = lazy(() => import('@/pages/plans/PlanList'));
// ...

<Route element={<AppLayout />}>
  <Route path="/" element={
    <Suspense fallback={<LoadingOverlay visible label="加载仪表盘…" />}>
      <Dashboard />
    </Suspense>
  } />
  ...
</Route>
```

**为什么不在 AppLayout 顶层统一包一个 Suspense**：
- 切页时旧页会被卸载，导致视觉上「白 → 新页」的闪烁
- 每个 Route 各自包 Suspense：Suspense 触发时旧页仍渲染（保留视觉），新页就绪后原子切换

**fallback 选择 LoadingOverlay 而非 Skeleton**：
- 路由级切页是「整页操作」，视觉上需要「整页遮罩」
- Skeleton 更适合「数据未就绪」（Dashboard 派生 hooks 首帧）

### 2.4 Skeleton 与 LoadingOverlay 的语义边界

| 场景 | 用谁 | 原因 |
|------|------|------|
| 路由切页（懒加载 chunk） | LoadingOverlay | 整页遮罩，模糊背景，提示「正在切换」 |
| useLiveQuery 首帧 undefined | Skeleton | 局部占位，与原内容尺寸一致，避免「布局抖动」 |
| 表单提交按钮 disabled 中 | LoadingOverlay（局部） | 反馈操作进度 |

---

## 3. 4 个组件详细设计

### 3.1 ErrorBoundary

```ts
// src/components/shell/ErrorBoundary.tsx
interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 生产环境此处接 Sentry（v1.1）
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback ?? <DefaultErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}
```

降级 UI：
- 大标题「出了点问题」
- 副标题：dev 模式显示 `error.message`，生产模式显示「应用遇到意外错误」
- 按钮：「重试」→ `reset()`；「回到首页」→ `window.location.href = '/'`
- 视觉：白底卡片 + 圆角 + 阴影 + 警示色 icon

### 3.2 LoadingOverlay

```ts
// src/components/shell/LoadingOverlay.tsx
interface Props {
  visible: boolean;
  label?: string;        // 默认「加载中…」
  /** 透传覆盖：背景虚化 / 不虚化 */
  blur?: boolean;        // 默认 true
}
```

实现：
- `fixed inset-0 z-50` 覆盖全屏
- 背景：`bg-white/60 backdrop-blur-sm`
- 居中：`<Loader2 className="animate-spin text-accent-500" size={32} />`
- 文案：`<p className="text-sm text-brand-500 mt-3">{label}</p>`
- `visible=false` 时不渲染（避免无意义的 DOM 节点）

### 3.3 EmptyState

```ts
// src/components/shell/EmptyState.tsx
type EmptyVariant = 'default' | 'compact' | 'inline' | 'illustration';

interface Props {
  icon: LucideIcon;       // 必传：保证视觉一致
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' };
  variant?: EmptyVariant; // 默认 'default'
}
```

4 种 variant 尺寸对照：

| variant | icon 容器 | 标题字号 | 用途 |
|---------|----------|---------|------|
| `default` | 64px | text-xl | Dashboard 空状态 |
| `compact` | 40px | text-base | PlanList / BlogList 无数据 |
| `inline` | 32px | text-sm | 表格行内 / 搜索结果为空 |
| `illustration` | 96px | text-2xl | 营销页 / 引导创建 |

### 3.4 Skeleton

```ts
// src/components/shell/Skeleton.tsx
interface Props {
  className?: string;     // 用于设置 width / height / border-radius
  rounded?: boolean;      // 默认 true（bg-stone-200 rounded）
  /** v1.0 不暴露更多 props；复杂需求用 className 组合 */
}
```

实现：`<div className={cn('bg-stone-200 animate-pulse', rounded && 'rounded', className)} />`

---

## 4. 集成方案

### 4.1 main.tsx 根级 ErrorBoundary

```tsx
// src/main.tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

### 4.2 App.tsx 路由懒加载

```tsx
// src/App.tsx
import { lazy, Suspense } from 'react';
import LoadingOverlay from '@/components/shell/LoadingOverlay';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PlanList = lazy(() => import('@/pages/plans/PlanList'));
const PlanDetail = lazy(() => import('@/pages/plans/PlanDetail'));
const PlanEdit = lazy(() => import('@/pages/plans/PlanEdit'));
const BlogList = lazy(() => import('@/pages/blogs/BlogList'));
const BlogDetail = lazy(() => import('@/pages/blogs/BlogDetail'));
const BlogEdit = lazy(() => import('@/pages/blogs/BlogEdit'));
const Kanban = lazy(() => import('@/pages/Kanban'));
const Settings = lazy(() => import('@/pages/Settings'));

function withSuspense(node: ReactNode, label: string) {
  return <Suspense fallback={<LoadingOverlay visible label={label} />}>{node}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={withSuspense(<Dashboard />, '加载仪表盘…')} />
        <Route path="/plans" element={withSuspense(<PlanList />, '加载计划列表…')} />
        ...
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
```

### 4.3 Dashboard 复用

```tsx
// src/pages/Dashboard.tsx 改造片段
import EmptyState from '@/components/shell/EmptyState';
import Skeleton from '@/components/shell/Skeleton';

// 替换内嵌的 SkeletonBlock
<Skeleton className="h-32" />

// 替换内嵌的 EmptyDashboard
<EmptyState
  icon={Notebook}
  title="欢迎来到 Planote 👋"
  description="创建你的第一个计划，让目标开始流动"
  action={{ label: '新建计划', onClick: () => navigate('/plans/new') }}
  variant="default"
/>
```

---

## 5. 边界与测试场景

### 5.1 ErrorBoundary 兜底

```tsx
// 测试场景 1：抛错组件
function Buggy() { throw new Error('boom'); }
<ErrorBoundary><Buggy /></ErrorBoundary>
// → 显示「出了点问题」降级 UI，不白屏
```

### 5.2 LoadingOverlay 显示/隐藏

```tsx
// 测试场景 2：visible 控制
<LoadingOverlay visible={false} />  // 渲染 null
<LoadingOverlay visible={true} label="加载中…" />  // 全屏遮罩
```

### 5.3 EmptyState variant

```tsx
// 测试场景 3：4 种 variant
<EmptyState variant="default" icon={Inbox} title="默认" />        // 64px
<EmptyState variant="compact" icon={Inbox} title="紧凑" />       // 40px
<EmptyState variant="inline" icon={Inbox} title="行内" />         // 32px
<EmptyState variant="illustration" icon={Inbox} title="插画" />  // 96px
```

### 5.4 React.lazy 失败

```tsx
// 404 chunk → 外层 ErrorBoundary 捕获（v1.0 简化：整页降级）
```

---

## 6. 不在本 change 范围

- Toast / Snackbar 通知（独立 change）
- i18n / 多语言
- 暗色模式（`useUIStore.theme` 字段保留但本 change 不接 UI）
- 动画库（Framer Motion 等）
- Sentry 接入（v1.1）
- 单元测试
- 性能监控
- 路由级 prefetch（`React.lazy` 自身行为；Vite 不做 prefetch）
