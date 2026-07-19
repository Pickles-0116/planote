/**
 * Planote · 状态层统一入口
 *
 * ## 架构约定（重要）
 *
 * 业务 store **不**持有实体数据（Plan / Item / Blog / Tag / Attachment 数组）。
 * 实体数据走 `useLiveQuery` 实现的 hook（见 `./hooks/*`），自动响应 IndexedDB 变化。
 *
 * store 只持有 transient 状态：
 * - `loading` / `error` —— 当前是否有写操作进行中 / 失败
 * - `selectedId` / `draft` —— UI 选中 / 编辑草稿
 *
 * 写操作统一走 store action，store 内部包装 Repository。
 *
 * UI store（`useUIStore`）是唯一持有"跨页面状态"的地方（视图模式 / 主题 / 主色 / 抽屉），
 * 用 `zustand/middleware` 的 `persist` 持久化到 localStorage。
 *
 * ## 使用示例
 *
 * ```tsx
 * // 读实体数据
 * import { usePlans, usePlan } from '@/stores';
 * const plans = usePlans();            // Plan[] | undefined
 * const plan  = usePlan('p_abc');      // Plan | undefined
 *
 * // 触发写操作
 * import { usePlanStore } from '@/stores';
 * await usePlanStore.getState().createPlan({ title: '...', ... });
 *
 * // 视图模式（持久化）
 * import { useUIStore } from '@/stores';
 * const viewMode = useUIStore(s => s.viewMode);
 * useUIStore.getState().setViewMode('table');
 * ```
 */

// —— 8 个 store hook（add-blog-attachment 增量 toastStore）——
export { usePlanStore } from './plansStore';
export { useItemsStore } from './itemsStore';
export { useBlogStore } from './blogsStore';
export { useFrameworkStore } from './frameworksStore';
export { useTagStore } from './tagsStore';
export { useAttachmentStore } from './attachmentsStore';
export { useUIStore } from './uiStore';
export { useToastStore, TOAST_MAX_VISIBLE } from './toastStore';

// —— 8 个 useLiveQuery hook ——
export { usePlan } from './hooks/usePlan';
export { usePlans } from './hooks/usePlans';
export { useItemsForPlan } from './hooks/useItemsForPlan';
export { useBlog } from './hooks/useBlog';
export { useBlogs } from './hooks/useBlogs';
export { useFrameworks } from './hooks/useFrameworks';
export { useTags } from './hooks/useTags';
export { useAttachmentsForBlog } from './hooks/useAttachmentsForBlog';

// —— UI store 类型 ——
export type { ViewMode, Theme, DrawerId, DrawerEntry } from './uiStore';
export type {
  PlanListView,
  PlanListSort,
  BlogListView,
  BlogListSort,
  BlogListStatusFilter,
} from './uiStore';

// —— 业务 store 类型（按需导出，便于组件 props 约束）——
export type { PlanStoreState } from './plansStore';
export type { ItemStoreState } from './itemsStore';
export type { BlogStoreState } from './blogsStore';
export type { FrameworkStoreState } from './frameworksStore';
export type { TagStoreState } from './tagsStore';
export type { AttachmentStoreState } from './attachmentsStore';
export type { UIStoreState } from './uiStore';
export type { Toast, ToastKind } from './toastStore';
