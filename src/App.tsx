import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import LoadingOverlay from '@/components/shell/LoadingOverlay';

/**
 * Planote 应用根组件
 *
 * 路由结构（与 architecture.md 5.3 节保持一致）：
 * - /                  → Dashboard
 * - /plans             → 计划列表
 * - /plans/new         → 计划编辑（新建）
 * - /plans/:id         → 计划详情
 * - /plans/:id/edit    → 计划编辑（编辑）
 * - /blogs             → 博客列表
 * - /blogs/new         → 博客编辑器（新建）
 * - /blogs/:id         → 博客详情
 * - /blogs/:id/edit    → 博客编辑器（编辑）
 * - /kanban            → 看板
 * - /settings          → 设置
 *
 * 懒加载：所有页面通过 React.lazy 动态导入，首屏只下载 Dashboard chunk；
 * 切到 /plans 才下载 PlanList chunk，依此类推。配合 Vite 自动分包
 * （TanStack Table / Tiptap 等大依赖进各自 chunk）实现首屏 < 200KB 目标。
 */
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PlanList = lazy(() => import('@/pages/plans/PlanList'));
const PlanDetail = lazy(() => import('@/pages/plans/PlanDetail'));
const PlanEdit = lazy(() => import('@/pages/plans/PlanEdit'));
const BlogList = lazy(() => import('@/pages/blogs/BlogList'));
const Folders = lazy(() => import('@/pages/Folders'));
const BlogDetail = lazy(() => import('@/pages/blogs/BlogDetail'));
const BlogEdit = lazy(() => import('@/pages/blogs/BlogEdit'));
const Kanban = lazy(() => import('@/pages/Kanban'));
const Settings = lazy(() => import('@/pages/Settings'));
const CollectionDetail = lazy(() => import('@/pages/CollectionDetail'));
const TemplateList = lazy(() => import('@/features/templates/components/TemplateList'));
const TemplateEditor = lazy(() => import('@/features/templates/components/TemplateEditor'));
const AIChat = lazy(() => import('@/pages/ai-chat/AIChat'));

/**
 * 路由级 Suspense 包装器
 *
 * 不在 AppLayout 顶层统一包 Suspense：那样切页时旧页会被卸载，导致「白 → 新页」闪烁。
 * 每个 Route 各自包 Suspense：Suspense 触发时旧页仍渲染，保留视觉；新页就绪后原子切换。
 */
function withSuspense(node: ReactNode, label: string): ReactNode {
  return <Suspense fallback={<LoadingOverlay visible label={label} />}>{node}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={withSuspense(<Dashboard />, '加载仪表盘…')} />
        <Route path="/plans" element={withSuspense(<PlanList />, '加载计划列表…')} />
        <Route
          path="/plans/new"
          element={withSuspense(<PlanEdit mode="create" />, '加载计划编辑器…')}
        />
        <Route
          path="/plans/:id"
          element={withSuspense(<PlanDetail />, '加载计划详情…')}
        />
        <Route
          path="/plans/:id/edit"
          element={withSuspense(<PlanEdit mode="edit" />, '加载计划编辑器…')}
        />
        <Route path="/blogs" element={withSuspense(<BlogList />, '加载博客列表…')} />
        <Route path="/folders" element={withSuspense(<Folders />, '加载文件夹…')} />
        <Route
          path="/blogs/new"
          element={withSuspense(<BlogEdit mode="create" />, '加载博客编辑器…')}
        />
        <Route
          path="/blogs/:id"
          element={withSuspense(<BlogDetail />, '加载博客详情…')}
        />
        <Route
          path="/blogs/:id/edit"
          element={withSuspense(<BlogEdit mode="edit" />, '加载博客编辑器…')}
        />
        <Route path="/kanban" element={withSuspense(<Kanban />, '加载看板…')} />
        <Route
          path="/templates"
          element={withSuspense(<TemplateList />, '加载模板列表…')}
        />
        <Route
          path="/templates/new"
          element={withSuspense(<TemplateEditor />, '加载模板编辑器…')}
        />
        <Route
          path="/templates/:id/edit"
          element={withSuspense(<TemplateEditor />, '加载模板编辑器…')}
        />
        <Route
          path="/settings"
          element={withSuspense(<Settings />, '加载设置…')}
        />
        <Route
          path="/collections/:id"
          element={withSuspense(<CollectionDetail />, '加载收藏夹…')}
        />
        <Route
          path="/ai-chat"
          element={withSuspense(<AIChat />, '加载 AI 对话…')}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
