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

import { useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BlogTemplate, BlogSource, ID, Tag } from '@/types/domain';
import type { BlogFilters, StatusFilter } from '../hooks/useFilteredBlogs';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  templateId: ID | null;
  onTemplateChange: (id: ID | null) => void;
  selectedTagIds: ID[];
  onTagToggle: (id: ID) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
  /** v1.4-Organize：高级筛选状态 */
  source: BlogSource | 'all';
  onSourceChange: (s: BlogSource | 'all') => void;
  wordCountRange: { min: number; max: number } | null;
  onWordCountRangeChange: (r: { min: number; max: number } | null) => void;
  dateRange: { start: string; end: string } | null;
  onDateRangeChange: (r: { start: string; end: string } | null) => void;
  /** 可选数据源（无则不渲染对应区块） */
  templates?: BlogTemplate[];
  tags?: Tag[];
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

const SOURCE_OPTIONS: { value: BlogSource | 'all'; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'direct', label: '直接创作' },
  { value: 'plan', label: '从计划生成' },
  { value: 'upload', label: '上传' },
];

export default function BlogListFilters({
  query,
  onQueryChange,
  templateId,
  onTemplateChange,
  selectedTagIds,
  onTagToggle,
  statusFilter,
  onStatusChange,
  onClearFilters,
  hasFilters,
  source,
  onSourceChange,
  wordCountRange,
  onWordCountRangeChange,
  dateRange,
  onDateRangeChange,
  templates,
  tags,
}: Props): JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasAdvancedFilters = source !== 'all' || wordCountRange !== null || dateRange !== null;
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

        {/* 模板下拉（v1.4-Unify：替代框架下拉，兼容旧数据） */}
        <select
          value={templateId ?? 'all'}
          onChange={(e) => {
            const v = e.target.value;
            onTemplateChange(v === 'all' ? null : v);
          }}
          aria-label="按模板筛选"
          className="h-9 px-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-brand-700 focus:outline-none focus:border-brand-900"
        >
          <option value="all">全部模板</option>
          {(templates ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* 高级筛选开关 */}
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className={cn(
            'h-9 px-3 text-sm rounded-xl border transition flex items-center gap-1.5',
            advancedOpen || hasAdvancedFilters
              ? 'bg-brand-900 text-white border-brand-900'
              : 'bg-white text-brand-500 border-stone-200 hover:bg-stone-50',
          )}
        >
          <ChevronDown size={14} className={cn('transition', advancedOpen && 'rotate-180')} />
          高级筛选
          {hasAdvancedFilters && !advancedOpen && (
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
          )}
        </button>

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

      {/* 高级筛选面板（v1.4-Organize） */}
      {advancedOpen && (
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-3 animate-fadeUp">
          {/* 来源 */}
          <div>
            <div className="text-xs font-medium text-brand-500 mb-1.5">来源</div>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSourceChange(opt.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg transition',
                    source === opt.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-brand-700 border border-stone-200',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 字数范围 */}
          <div>
            <div className="text-xs font-medium text-brand-500 mb-1.5">字数范围</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="最少"
                value={wordCountRange?.min ?? ''}
                onChange={(e) => {
                  const min = Number(e.target.value) || 0;
                  onWordCountRangeChange(min > 0 || (wordCountRange?.max ?? 0) > 0 ? { min, max: wordCountRange?.max ?? 0 } : null);
                }}
                className="w-24 px-2 py-1 text-xs bg-white border border-stone-200 rounded-lg"
              />
              <span className="text-xs text-brand-500">~</span>
              <input
                type="number"
                min={0}
                placeholder="最多"
                value={wordCountRange?.max ?? ''}
                onChange={(e) => {
                  const max = Number(e.target.value) || 0;
                  onWordCountRangeChange((wordCountRange?.min ?? 0) > 0 || max > 0 ? { min: wordCountRange?.min ?? 0, max } : null);
                }}
                className="w-24 px-2 py-1 text-xs bg-white border border-stone-200 rounded-lg"
              />
              <span className="text-xs text-brand-400">字</span>
            </div>
          </div>

          {/* 日期范围 */}
          <div>
            <div className="text-xs font-medium text-brand-500 mb-1.5">创建日期</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange?.start ?? ''}
                onChange={(e) => onDateRangeChange({ start: e.target.value, end: dateRange?.end ?? '' })}
                className="px-2 py-1 text-xs bg-white border border-stone-200 rounded-lg"
              />
              <span className="text-xs text-brand-500">~</span>
              <input
                type="date"
                value={dateRange?.end ?? ''}
                onChange={(e) => onDateRangeChange({ start: dateRange?.start ?? '', end: e.target.value })}
                className="px-2 py-1 text-xs bg-white border border-stone-200 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 显式 re-export BlogFilters 以便 caller 不用单独 import（仅类型）。
export type { BlogFilters };
