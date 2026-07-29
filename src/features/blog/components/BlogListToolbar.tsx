/**
 * BlogListToolbar - 博客列表页工具栏（add-blog-list-and-detail 增量）
 *
 * 组成：
 * - 视图切换器（2 段 grid / list）
 * - 排序下拉（3 个 preset）
 * - 「写新博客」按钮（右端，导航 /blogs/new）
 *
 * 视图切换器 a11y：
 * - 容器 role="tablist"
 * - 按钮 role="tab" + aria-selected
 *
 * 排序下拉：复用 <select> 简版（与 BlogListFilters 的框架下拉一致）。
 * v1.1 可换下拉菜单（PlanSortDropdown 模式）。
 *
 * 视觉：与 PlanList 工具栏对齐（白底胶囊容器 / 阴影）。
 */

import { LayoutGrid, List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImportMarkdownButton from './ImportMarkdownButton';
import type { BlogListView, BlogListSort } from '@/stores';
import {
  BLOG_SORT_OPTIONS,
  findBlogSortOption,
  DEFAULT_BLOG_SORT_KEY,
} from '../utils/sortBlogs';
import type { BlogSortKey } from '../utils/sortBlogs';

interface Props {
  view: BlogListView;
  onViewChange: (next: BlogListView) => void;
  sort: BlogListSort;
  onSortChange: (next: BlogListSort) => void;
}

const VIEW_OPTIONS: { value: BlogListView; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: '卡片', icon: LayoutGrid },
  { value: 'list', label: '列表', icon: List },
  { value: 'byPlan', label: '按计划', icon: CalendarDays },
];

export default function BlogListToolbar({
  view,
  onViewChange,
  sort,
  onSortChange,
}: Props): JSX.Element {
  const current = findBlogSortOption(sort ?? DEFAULT_BLOG_SORT_KEY);

  return (
    <div
      className="flex items-center gap-3 animate-fadeUp animate-delay-25"
      data-toolbar="blog-list"
    >
      {/* 视图切换器（2 段） */}
      <div
        role="tablist"
        aria-label="博客列表视图"
        data-view-switcher
        className="flex p-1 bg-stone-100 rounded-xl"
      >
        {VIEW_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = opt.value === view;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-view={opt.value}
              onClick={() => onViewChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition',
                active
                  ? 'bg-white text-brand-900 shadow-sm'
                  : 'text-brand-500 hover:text-brand-900',
              )}
            >
              <Icon size={12} />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 排序下拉（select 简版；3 个 preset） */}
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as BlogSortKey)}
        aria-label="排序方案"
        data-sort-select
        className="h-9 px-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-brand-700 focus:outline-none focus:border-brand-900"
      >
        {BLOG_SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* 显当前选项（与排序下拉平行的静态 label，便于无 hover 时也可读） */}
      <span className="text-xs text-brand-400 hidden md:inline">· {current.label}</span>

      {/* 批量导入 .md */}
      <div className="ml-auto">
        <ImportMarkdownButton label="批量导入 .md" />
      </div>
    </div>
  );
}
