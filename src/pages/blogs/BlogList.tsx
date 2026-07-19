/**
 * BlogList - 博客列表页（/blogs 路由）（add-blog-list-and-detail 增量）
 *
 * 顶层 hooks pipeline（design.md §2.1 共享数据流）：
 *   useBlogs()                       ← useLiveQuery 订阅
 *     ↓
 *   useFilteredBlogs(blogs, filters, sort)
 *     ├─ status → framework → tag(OR) → search → sort
 *     ↓
 *   [GridView | ListView]            ← 仅切渲染分支
 *
 * 视图切换：useUIStore.blogListView（持久化到 localStorage）
 *
 * 空状态 / 加载态：
 *   - 加载中（undefined）→ Skeleton 占位
 *   - 0 blog + 无任何 filter → illustration variant EmptyState
 *   - 0 blog + 有 filter → compact variant EmptyState + 清除筛选
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notebook, SearchX } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import Skeleton from '@/components/shell/Skeleton';
import BlogCard from '@/features/blog/components/BlogCard';
import BlogListFilters from '@/features/blog/components/BlogListFilters';
import BlogListToolbar from '@/features/blog/components/BlogListToolbar';
import { useFilteredBlogs } from '@/features/blog/hooks/useFilteredBlogs';
import { useBlogs, useFrameworks, useTags, useUIStore } from '@/stores';
import type { Framework, ID } from '@/types/domain';
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
  const [frameworkId, setFrameworkId] = useState<ID | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<ID[]>([]);

  // 数据订阅
  const blogs = useBlogs();
  const frameworks = useFrameworks();
  const tags = useTags();

  // 框架名映射：frameworkId → Framework（O(1) 查找）
  const frameworkMap = useMemo(() => {
    const m = new Map<string, Framework>();
    if (frameworks) {
      for (const f of frameworks) m.set(f.id, f);
    }
    return m;
  }, [frameworks]);

  const filters: BlogFilters = {
    query,
    frameworkId,
    selectedTagIds,
    statusFilter,
  };

  // 组合筛选 + 排序
  const filtered = useFilteredBlogs(blogs, filters, sort);

  const hasFilters: boolean = useMemo(
    () =>
      query !== '' ||
      frameworkId !== null ||
      selectedTagIds.length > 0 ||
      statusFilter !== 'all',
    [query, frameworkId, selectedTagIds, statusFilter],
  );

  const handleTagToggle = useCallback((id: ID) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setFrameworkId(null);
    setSelectedTagIds([]);
    setStatusFilter('all');
  }, [setStatusFilter]);

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
      <EmptyState
        icon={Notebook}
        title="还没有博客"
        description="用富文本写下你的第一篇复盘或总结吧"
        action={{
          label: '写新博客',
          onClick: () => navigate('/blogs/new'),
        }}
        variant="illustration"
      />
    );
  }

  // 筛选无结果
  if (filtered !== undefined && filtered.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader count={blogs.length} />
        <BlogListFilters
          query={query}
          onQueryChange={setQuery}
          frameworkId={frameworkId}
          onFrameworkChange={setFrameworkId}
          selectedTagIds={selectedTagIds}
          onTagToggle={handleTagToggle}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onClearFilters={clearAllFilters}
          hasFilters={hasFilters}
          frameworks={frameworks ?? []}
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
          title="没找到匹配的博客"
          description={query ? `没有博客包含「${query}」` : '当前筛选条件下无博客'}
          action={{
            label: '清除筛选',
            onClick: clearAllFilters,
            variant: 'secondary',
          }}
          variant="compact"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader count={blogs.length} />
      <BlogListFilters
        query={query}
        onQueryChange={setQuery}
        frameworkId={frameworkId}
        onFrameworkChange={setFrameworkId}
        selectedTagIds={selectedTagIds}
        onTagToggle={handleTagToggle}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onClearFilters={clearAllFilters}
        hasFilters={hasFilters}
        frameworks={frameworks ?? []}
        tags={tags ?? []}
      />
      <BlogListToolbar
        view={view}
        onViewChange={setView}
        sort={sort}
        onSortChange={setSort}
      />
      {filtered && view === 'grid' && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-view="grid"
        >
          {filtered.map((b) => (
            <BlogCard
              key={b.id}
              blog={b}
              density="grid"
              framework={b.frameworkId ? frameworkMap.get(b.frameworkId) : undefined}
            />
          ))}
        </div>
      )}
      {filtered && view === 'list' && (
        <div className="space-y-2" data-view="list">
          {filtered.map((b) => (
            <BlogCard
              key={b.id}
              blog={b}
              density="list"
              framework={b.frameworkId ? frameworkMap.get(b.frameworkId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 标题栏
 * ============================================================ */
function PageHeader({ count }: { count: number }): JSX.Element {
  return (
    <div className="flex items-end justify-between animate-fadeUp">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">博客</h1>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          浏览你的所有复盘、笔记与总结 · 共{' '}
          <span className="font-semibold text-brand-900 dark:text-stone-100">{count}</span> 篇
        </p>
      </div>
    </div>
  );
}
