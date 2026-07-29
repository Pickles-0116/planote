/**
 * TemplateList - 博客模板管理页
 *
 * 功能：搜索（300ms debounce）+ 分类筛选 + 卡片网格 + 新建模板入口。
 *
 * 数据源：useTemplates (IndexedDB useLiveQuery) + useBlogTemplateStore (CRUD 操作)。
 * 空态：EmptyState 组件（variant='default'）。
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Plus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';
import EmptyState from '@/components/shell/EmptyState';
import TemplateCard from './TemplateCard';
import { useTemplates } from '../hooks/useTemplates';
import { useBlogTemplateStore } from '../hooks/useBlogTemplateStore';
import type { TemplateCategory } from '@/types/domain';

/** 分类筛选条配置（"全部" 对应 undefined，即不传 category）。 */
const CATEGORIES: { label: string; value: TemplateCategory | undefined }[] = [
  { label: '全部', value: undefined },
  { label: '复盘', value: 'review' },
  { label: '笔记', value: 'note' },
  { label: '总结', value: 'summary' },
  { label: '习惯', value: 'habit' },
  { label: '决策', value: 'decision' },
  { label: '分析', value: 'analysis' },
  { label: '自定义', value: 'custom' },
];

export default function TemplateList(): JSX.Element {
  const navigate = useNavigate();

  // ---- 搜索 ----
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debouncedSet = useDebouncedCallback((v: string) => setDebouncedQuery(v), 300);
  const handleSearch = useCallback(
    (v: string) => {
      setSearchInput(v);
      debouncedSet(v);
    },
    [debouncedSet],
  );

  // ---- 分类 ----
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | undefined>(undefined);

  // ---- 数据 ----
  const templates = useTemplates(activeCategory, debouncedQuery || undefined);
  const { duplicateTemplate, deleteTemplate } = useBlogTemplateStore();

  const isFiltering = !!activeCategory || !!debouncedQuery;

  return (
    <div className="flex flex-col gap-5">
      {/* ── 搜索栏 ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索模板名称或描述…"
            aria-label="搜索模板"
            className={cn(
              'w-full h-9 pl-9 pr-9 text-sm',
              'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl',
              'focus:border-brand-500 focus:outline-none transition placeholder:text-brand-300 dark:placeholder:text-stone-500',
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => handleSearch('')}
              aria-label="清除搜索"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-brand-400 hover:text-brand-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/templates/new')}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition shadow-sm flex-shrink-0',
            'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200',
          )}
        >
          <Plus size={14} />
          新建模板
        </button>
      </div>

      {/* ── 分类筛选条 ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
        {CATEGORIES.map(({ label, value }) => {
          const isActive = activeCategory === value;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveCategory(value)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition flex-shrink-0',
                'focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
                isActive
                  ? 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'bg-stone-100 dark:bg-stone-700 text-brand-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── 卡片网格 / 空态 ── */}
      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isFiltering ? '没有匹配的模板' : '还没有博客模板'}
          description={isFiltering ? '试试调整搜索关键词或分类筛选' : '创建你的第一个模板，让 AI 写作更贴合你的风格'}
          variant="default"
          action={
            isFiltering
              ? {
                  label: '清除筛选',
                  onClick: () => {
                    setActiveCategory(undefined);
                    handleSearch('');
                  },
                  variant: 'secondary',
                }
              : { label: '新建模板', onClick: () => navigate('/templates/new') }
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onClick={() => navigate(`/templates/${tpl.id}/edit`)}
              onDuplicate={() => duplicateTemplate(tpl.id)}
              onDelete={() => deleteTemplate(tpl.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
