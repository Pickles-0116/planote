/**
 * BlogList - 博客列表页（/blogs 路由）（add-blog-list-and-detail + V1.2 F4 增量）
 *
 * 顶层 hooks pipeline（design.md §2.1 共享数据流）：
 *   useBlogs()                       ← useLiveQuery 订阅
 *     ↓
 *   useFilteredBlogs(blogs, filters, sort)
 *     ├─ status → framework → template → tag(OR) → source → wordCount → date → search → sort
 *     ↓
 *   [GridView | ListView | ByPlan]   ← 仅切渲染分支
 *
 * 2024-06 修正：恢复为「全部博客」视图。移除上一版误加的文件夹视图相关 UI：
 *   - 顶栏文件夹筛选条（FolderFilterBar）
 *   - 文件夹面包屑（Breadcrumb）
 *   - 按文件夹分组（grouped）
 *   - 右侧「管理文件夹」抽屉（Drawer + FolderTree）
 *
 * 现在 /blogs 只保留：搜索框（带命中高亮）、标签多维筛选、网格/列表/按计划 三种视图切换，
 * 即一个干净的「看全部博客」列表页。收藏夹（collections）卡片与「去掉已收藏博客」逻辑
 * 属于 v1.4-Organize 独立特性，与文件夹无关，予以保留。
 *
 * V1.2 B4：useFilteredBlogs 返回 BlogWithSnippet，命中片段经 `snippet` 传入 BlogCard。
 *
 * 视图切换：useUIStore.blogListView（持久化到 localStorage）
 *
 * 空状态 / 加载态：
 *   - 加载中（undefined）→ Skeleton 占位
 *   - 0 blog + 无任何 filter → illustration variant EmptyState
 *   - 0 blog + 有 filter → compact variant EmptyState + 清除筛选
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notebook, PenLine, SearchX } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import Skeleton from '@/components/shell/Skeleton';
import BlogCard from '@/features/blog/components/BlogCard';
import BlogListFilters from '@/features/blog/components/BlogListFilters';
import BlogListToolbar from '@/features/blog/components/BlogListToolbar';
import ImportMarkdownButton from '@/features/blog/components/ImportMarkdownButton';
import BlogByPlanView from '@/features/blog/components/BlogByPlanView';
import { useFilteredBlogs, type BlogWithSnippet } from '@/features/blog/hooks/useFilteredBlogs';
import { useBlogs, useAllTemplates, useTags, useUIStore } from '@/stores';
import type { BlogTemplate, BlogSource, ID } from '@/types/domain';
import type { BlogFilters } from '@/features/blog/hooks/useFilteredBlogs';

export default function BlogList(): JSX.Element {
  const navigate = useNavigate();

  // uiStore 持久化字段
  const view = useUIStore((s) => s.blogListView);
  const setView = useUIStore((s) => s.setBlogListView);
  const sort = useUIStore((s) => s.blogListSort);
  const setSort = useUIStore((s) => s.setBlogListSort);
  const statusFilter = useUIStore((s) => s.blogListStatusFilter);
  const setStatusFilter = useUIStore((s) => s.setBlogListStatusFilter);

  // 本地 state（不持久化）
  const [query, setQuery] = useState<string>('');
  const [templateId, setTemplateId] = useState<ID | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<ID[]>([]);
  const [source, setSource] = useState<BlogSource | 'all'>('all');
  const [wordCountRange, setWordCountRange] = useState<{ min: number; max: number } | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  // 数据订阅
  const blogs = useBlogs();
  const templates = useAllTemplates();
  const tags = useTags();

  // 模板名映射：templateId → BlogTemplate（O(1) 查找）
  const templateMap = useMemo(() => {
    const m = new Map<string, BlogTemplate>();
    if (templates) {
      for (const t of templates) m.set(t.id, t);
    }
    return m;
  }, [templates]);

  const filters: BlogFilters = {
    query,
    frameworkId: null,
    templateId,
    selectedTagIds,
    statusFilter,
    source,
    wordCountRange,
    dateRange,
    // 全部博客视图：不过滤文件夹（folderId = null 表示「全部文件夹」）
    folderId: null,
  };

  // 组合筛选 + 排序
  const filtered = useFilteredBlogs(blogs, filters, sort);

  const hasFilters: boolean = useMemo(
    () =>
      query !== '' ||
      templateId !== null ||
      selectedTagIds.length > 0 ||
      statusFilter !== 'all' ||
      source !== 'all' ||
      wordCountRange !== null ||
      dateRange !== null,
    [query, templateId, selectedTagIds, statusFilter, source, wordCountRange, dateRange],
  );

  const handleTagToggle = useCallback((id: ID) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setTemplateId(null);
    setSelectedTagIds([]);
    setStatusFilter('all');
    setSource('all');
    setWordCountRange(null);
    setDateRange(null);
  }, [setStatusFilter]);

  const renderBlogs = useCallback(
    (list: BlogWithSnippet[]): JSX.Element => {
      if (view === 'grid') {
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-view="grid">
            {list.map((b) => (
              <BlogCard
                key={b.id}
                blog={b}
                density="grid"
                framework={templateMap.get(b.templateId ?? b.frameworkId ?? '') ?? undefined}
                snippet={b.searchSnippet}
              />
            ))}
          </div>
        );
      }
      return (
        <div className="space-y-2" data-view="list">
          {list.map((b) => (
            <BlogCard
              key={b.id}
              blog={b}
              density="list"
              framework={templateMap.get(b.templateId ?? b.frameworkId ?? '') ?? undefined}
              snippet={b.searchSnippet}
            />
          ))}
        </div>
      );
    },
    [view, templateMap],
  );

  // 加载态
  if (blogs === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader count={0} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  // 0 blog + 无 filter → 引导创建
  if (blogs.length === 0 && !hasFilters) {
    return (
      <div className="space-y-6">
        <PageHeader count={0} />
        <EmptyState
          icon={Notebook}
          title="还没有博客"
          description="用富文本写下你的第一篇复盘，或一次性批量导入多篇 Markdown 笔记（≤ 5MB / 个）"
          variant="illustration"
        />
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/blogs/new')}
            className="px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm"
          >
            写新博客
          </button>
          <ImportMarkdownButton label="批量导入 .md" />
        </div>
      </div>
    );
  }

  // 筛选无结果（但收藏夹仍展示）
  if (filtered !== undefined && filtered.length === 0 && view !== 'byPlan') {
    return (
      <div className="space-y-6">
        <PageHeader count={blogs.length}>
          <button
            type="button"
            onClick={() => navigate('/blogs/new')}
            className="px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm flex items-center gap-2"
          >
            <PenLine size={14} />
            新建博客
          </button>
        </PageHeader>

        <BlogListFilters
          query={query}
          onQueryChange={setQuery}
          templateId={templateId}
          onTemplateChange={setTemplateId}
          selectedTagIds={selectedTagIds}
          onTagToggle={handleTagToggle}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onClearFilters={clearAllFilters}
          hasFilters={hasFilters}
          source={source}
          onSourceChange={setSource}
          wordCountRange={wordCountRange}
          onWordCountRangeChange={setWordCountRange}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          templates={templates ?? []}
          tags={tags ?? []}
        />
        <BlogListToolbar
          view={view}
          onViewChange={setView}
          sort={sort}
          onSortChange={setSort}
        />

        <EmptyState
          icon={SearchX}
          title={hasFilters ? '没找到匹配的博客' : '还没有博客'}
          description={
            hasFilters
              ? query
                ? `没有博客包含「${query}」`
                : '当前筛选条件下无博客'
              : '当前还没有任何博客，点击右上角「新建博客」开始记录'
          }
          action={hasFilters ? {
            label: '清除筛选',
            onClick: clearAllFilters,
            variant: 'secondary' as const,
          } : undefined}
          variant="compact"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader count={blogs.length}>
        <button
          type="button"
          onClick={() => navigate('/blogs/new')}
          className="px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm flex items-center gap-2"
        >
          <PenLine size={14} />
          新建博客
        </button>
      </PageHeader>

      <BlogListFilters
        query={query}
        onQueryChange={setQuery}
        templateId={templateId}
        onTemplateChange={setTemplateId}
        selectedTagIds={selectedTagIds}
        onTagToggle={handleTagToggle}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onClearFilters={clearAllFilters}
        hasFilters={hasFilters}
        source={source}
        onSourceChange={setSource}
        wordCountRange={wordCountRange}
        onWordCountRangeChange={setWordCountRange}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        templates={templates ?? []}
        tags={tags ?? []}
      />
      <BlogListToolbar
        view={view}
        onViewChange={setView}
        sort={sort}
        onSortChange={setSort}
      />

      {/* byPlan 视图：独立渲染 */}
      {filtered && view === 'byPlan' && <BlogByPlanView blogs={filtered} />}

      {/* 网格 / 列表视图：扁平渲染全部博客（按文件夹分组已移除） */}
      {!filtered && view !== 'byPlan' && <Skeleton className="h-44" />}
      {filtered && view !== 'byPlan' && renderBlogs(filtered)}
    </div>
  );
}

/* ============================================================
 * 标题栏
 * ============================================================ */
function PageHeader({ count, children }: { count: number; children?: ReactNode }): JSX.Element {
  return (
    <div className="flex items-end justify-between animate-fadeUp">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">博客</h1>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          浏览你的所有复盘、笔记与总结 · 共{' '}
          <span className="font-semibold text-brand-900 dark:text-stone-100">{count}</span> 篇
        </p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
