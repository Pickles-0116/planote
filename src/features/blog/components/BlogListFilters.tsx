/**
 * BlogListFilters - 博客列表页筛选条（add-blog-list-and-detail 增量）
 *
 * 组成：
 * - 搜索框：实时过滤（title / excerpt / tagIds）
 * - 框架下拉：<select> 单选（全部 + 4 内置）
 * - 标签 chips：横排 scroll，多选 OR
 * - 状态 4 tab：全部 / 草稿 / 已发布 / 已归档
 * - 「清除筛选」按钮：hasFilters 时显
 *
 * 标签 chips a11y：
 * - <button role="switch" aria-checked aria-label>
 *
 * 状态 tab a11y：
 * - <button role="tab" aria-selected aria-label>
 *
 * 视觉：与 add-plan-list-view 的筛选条对齐（白底 + 圆角 + 边框）。
 */

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Framework, ID, Tag } from '@/types/domain';
import type { BlogFilters, StatusFilter } from '../hooks/useFilteredBlogs';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  frameworkId: ID | null;
  onFrameworkChange: (id: ID | null) => void;
  selectedTagIds: ID[];
  onTagToggle: (id: ID) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
  /** 可选数据源（无则不渲染对应区块） */
  frameworks?: Framework[];
  tags?: Tag[];
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

export default function BlogListFilters({
  query,
  onQueryChange,
  frameworkId,
  onFrameworkChange,
  selectedTagIds,
  onTagToggle,
  statusFilter,
  onStatusChange,
  onClearFilters,
  hasFilters,
  frameworks,
  tags,
}: Props): JSX.Element {
  return (
    <div className="space-y-3 animate-fadeUp animate-delay-25">
      {/* 第一行：搜索 + 框架下拉 + 清除筛选 */}
      <div className="flex items-center gap-3 flex-wrap" data-toolbar="blog-filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
            size={14}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索博客标题 / 摘要 / 标签…"
            aria-label="搜索博客"
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-brand-900 transition"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="清除搜索"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-brand-400 hover:text-brand-900 hover:bg-stone-100 transition"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 框架下拉（不依赖 Dexie 数据，避免空数据卡住筛选条） */}
        <select
          value={frameworkId ?? 'all'}
          onChange={(e) => {
            const v = e.target.value;
            onFrameworkChange(v === 'all' ? null : v);
          }}
          aria-label="按框架筛选"
          className="h-9 px-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-brand-700 focus:outline-none focus:border-brand-900"
        >
          <option value="all">全部框架</option>
          {(frameworks ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="h-9 px-3 text-sm text-brand-500 hover:text-brand-900 hover:bg-stone-100 rounded-xl transition flex items-center gap-1"
          >
            <X size={12} />
            清除筛选
          </button>
        )}
      </div>

      {/* 第二行：状态 4 tab */}
      <div role="tablist" aria-label="按状态筛选" className="flex p-1 bg-stone-100 rounded-xl w-fit">
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === statusFilter;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`筛选状态 ${opt.label}`}
              onClick={() => onStatusChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition',
                active
                  ? 'bg-white text-brand-900 shadow-sm'
                  : 'text-brand-500 hover:text-brand-900',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 第三行：标签 chips（多选 OR；空数组不渲染） */}
      {tags && tags.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto"
          data-tag-filter
          aria-label="按标签筛选（多选）"
        >
          {tags.map((t) => {
            const active = selectedTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={`筛选标签 ${t.name}`}
                onClick={() => onTagToggle(t.id)}
                className={cn(
                  'text-xs px-2 py-1 rounded-full transition border',
                  active
                    ? 'bg-brand-900 text-white border-brand-900'
                    : 'bg-white text-brand-600 border-stone-200 hover:border-brand-300',
                )}
              >
                #{t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 显式 re-export BlogFilters 以便 caller 不用单独 import（仅类型）。
export type { BlogFilters };
