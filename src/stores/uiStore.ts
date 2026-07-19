/**
 * UI store
 *
 * 持有**瞬时** UI 状态：
 * - 视图模式（Plans 列表页用 grouped / flat / table）
 * - 主题（v1.0 仅占位，v1.1 真接 CSS 变量）
 * - 主色（v1.0 仅占位）
 * - 侧边栏折叠
 * - 抽屉栈（z-index 栈式管理，多 drawer 可嵌套）
 *
 * **持久化**（localStorage key = `planote-ui`）：
 * - 白名单：`viewMode` / `theme` / `primaryColor` / `sidebarCollapsed`
 * - **不**持久化 `drawerStack`（避免反序列化出现"幽灵抽屉"——刷新后用户看到一个莫名其妙的浮层）
 *
 * v1.0 `version: 1`，未来加 `version: 2` 时补 `migrate` 函数。
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_SORT_KEY } from '@/shared/sort';
import type { SortKey } from '@/shared/sort';
import type { ID, BlogStatus } from '@/types/domain';
import type { BlogSortKey } from '@/features/blog/utils/sortBlogs';

/** 列表视图模式（全局，未来可由 BlogList 复用）。 */
export type ViewMode = 'grouped' | 'flat' | 'table';

/**
 * 计划列表页专用视图模式。
 *
 * 与 `ViewMode` 命名约定不同（group vs grouped、all vs flat）以保持
 * 本 change 设计的语义清晰（add-plan-list-view/design.md §1 选型表）。
 * 两字段并行存在，职责分离。
 */
export type PlanListView = 'group' | 'all' | 'table';

/** 计划列表页专用排序键（add-smart-sort 增量；默认 'smart'）。 */
export type PlanListSort = SortKey;

/** 博客列表页专用视图模式（add-blog-list-and-detail 增量；默认 'grid'）。 */
export type BlogListView = 'grid' | 'list';

/** 博客列表页专用排序键（add-blog-list-and-detail 增量；默认 'created-desc'）。 */
export type BlogListSort = BlogSortKey;

/** 博客列表页专用状态过滤（add-blog-list-and-detail 增量；默认 'all'）。 */
export type BlogListStatusFilter = BlogStatus | 'all';

/**
 * 主题（v1.0 升级：期望主题含 system）
 *
 * v1.0 占位阶段是 `'light' | 'dark' | 'eye-care'`，语义为「实际生效主题」。
 * add-settings-and-shell 升级为期望主题（含 system 跟随系统）：
 * - 实际生效（resolved）由 useTheme hook 解析 system + prefers-color-scheme 得到
 * - eye-care 旧值迁移为 light（v1.0 暂不实现）
 */
export type Theme = 'system' | 'light' | 'dark';

/** 已知的抽屉 ID。 */
export type DrawerId =
  | 'framework'
  | 'planEdit'
  | 'blogEdit'
  | 'settings'
  | 'search';

/** 抽屉栈的一项。 */
export interface DrawerEntry {
  id: DrawerId;
  props?: unknown;
}

export interface UIStoreState {
  // —— 持久化字段 ——
  viewMode: ViewMode;
  theme: Theme;
  primaryColor: string;
  sidebarCollapsed: boolean;
  /** 计划列表页视图模式（add-plan-list-view 增量；默认 'group'）。 */
  planListView: PlanListView;
  /** 计划列表页排序键（add-smart-sort 增量；默认 'smart'）。 */
  planListSort: PlanListSort;
  /** 博客列表页视图模式（add-blog-list-and-detail 增量；默认 'grid'）。 */
  blogListView: BlogListView;
  /** 博客列表页排序键（add-blog-list-and-detail 增量；默认 'created-desc'）。 */
  blogListSort: BlogListSort;
  /** 博客列表页状态过滤（add-blog-list-and-detail 增量；默认 'all'）。 */
  blogListStatusFilter: BlogListStatusFilter;

  // —— 瞬时字段（不持久化）——
  drawerStack: DrawerEntry[];

  // —— add-framework-drawer 增量：博客框架库抽屉开关（不持久化）——
  frameworkDrawerOpen: boolean;
  frameworkDrawerInitialFrameworkId: ID | null;

  // —— actions ——
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;
  setPrimaryColor: (color: string) => void;
  toggleSidebar: () => void;
  setPlanListView: (view: PlanListView) => void;
  setPlanListSort: (sort: PlanListSort) => void;
  /** add-blog-list-and-detail 增量 actions */
  setBlogListView: (view: BlogListView) => void;
  setBlogListSort: (sort: BlogListSort) => void;
  setBlogListStatusFilter: (filter: BlogListStatusFilter) => void;

  openDrawer: (id: DrawerId, props?: unknown) => void;
  closeDrawer: (id: DrawerId) => void;
  closeTopDrawer: () => void;
  closeAllDrawers: () => void;

  // —— add-framework-drawer 增量 action ——
  openFrameworkDrawer: (initialFrameworkId?: ID) => void;
  closeFrameworkDrawer: () => void;
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set) => ({
      // 默认值
      viewMode: 'grouped',
      // add-settings-and-shell：默认 'system'（跟随系统）
      theme: 'system',
      primaryColor: '#3B82F6',
      sidebarCollapsed: false,
      planListView: 'group',
      planListSort: DEFAULT_SORT_KEY,
      // add-blog-list-and-detail 增量默认值
      blogListView: 'grid',
      blogListSort: 'created-desc',
      blogListStatusFilter: 'all',
      drawerStack: [],

      // add-framework-drawer 增量
      frameworkDrawerOpen: false,
      frameworkDrawerInitialFrameworkId: null,

      setViewMode: (mode) => set({ viewMode: mode }),
      setTheme: (theme) => set({ theme }),
      setPrimaryColor: (color) => set({ primaryColor: color }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setPlanListView: (view) => set({ planListView: view }),
      setPlanListSort: (sort) => set({ planListSort: sort }),
      // add-blog-list-and-detail 增量 actions
      setBlogListView: (view) => set({ blogListView: view }),
      setBlogListSort: (sort) => set({ blogListSort: sort }),
      setBlogListStatusFilter: (filter) => set({ blogListStatusFilter: filter }),

      openDrawer: (id, props) =>
        set((s) => ({ drawerStack: [...s.drawerStack, { id, props }] })),
      closeDrawer: (id) =>
        set((s) => ({ drawerStack: s.drawerStack.filter((d) => d.id !== id) })),
      closeTopDrawer: () =>
        set((s) => ({ drawerStack: s.drawerStack.slice(0, -1) })),
      closeAllDrawers: () => set({ drawerStack: [] }),

      // add-framework-drawer 增量 action
      openFrameworkDrawer: (initialFrameworkId) =>
        set({
          frameworkDrawerOpen: true,
          frameworkDrawerInitialFrameworkId: initialFrameworkId ?? null,
        }),
      closeFrameworkDrawer: () => set({ frameworkDrawerOpen: false }),
    }),
    {
      name: 'planote-ui',
      storage: createJSONStorage(() => localStorage),
      // 白名单：只持久化用户偏好；drawerStack 排除
      partialize: (state) => ({
        viewMode: state.viewMode,
        theme: state.theme,
        primaryColor: state.primaryColor,
        sidebarCollapsed: state.sidebarCollapsed,
        planListView: state.planListView,
        planListSort: state.planListSort,
        // add-blog-list-and-detail 增量白名单
        blogListView: state.blogListView,
        blogListSort: state.blogListSort,
        blogListStatusFilter: state.blogListStatusFilter,
      }),
      // add-settings-and-shell：version 1 → 2，迁移旧 theme 字段
      version: 2,
      migrate: (persistedState, _version) => {
        // 旧值 'eye-care' 迁移为 'light'（v1.0 暂不实现 eye-care 主题）
        const state = persistedState as Partial<UIStoreState> | undefined;
        if (state && typeof state.theme === 'string') {
          // 旧字段值运行时类型是 'light' | 'dark' | 'eye-care'，运行时检查需 cast
          const legacyTheme = state.theme as string;
          if (legacyTheme === 'eye-care') {
            state.theme = 'light';
          } else if (
            legacyTheme !== 'system' &&
            legacyTheme !== 'light' &&
            legacyTheme !== 'dark'
          ) {
            // 未知值兜底
            state.theme = 'system';
          }
        }
        return state as UIStoreState;
      },
    },
  ),
);
