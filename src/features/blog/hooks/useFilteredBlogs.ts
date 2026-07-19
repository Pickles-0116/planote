/**
 * useFilteredBlogs - 列表页筛选 + 搜索 + 排序组合 hook（add-blog-list-and-detail 增量）
 *
 * 设计（design.md §2.1 数据 pipeline）：
 *   useBlogs()                       ← live query 订阅
 *     ↓
 *   useFilteredBlogs(blogs, filters, sort)
 *     ├─ useMemo: status filter
 *     ├─ useMemo: framework filter
 *     ├─ useMemo: tag filter (OR)
 *     ├─ useMemo: search filter (title / excerpt / tagIds)
 *     └─ useMemo: sort (comparator)
 *     ↓
 *   [GridView | ListView]            ← 仅切渲染分支
 *
 * 边界：
 * - blogs === undefined → 返回 undefined（首帧 live query）
 * - 空筛选 / 空搜索 → 透传上游数组
 * - 入参引用未变 → useMemo 缓存命中，不重算
 */

import { useMemo } from 'react';
import type { Blog, BlogStatus, ID } from '@/types/domain';
import { sortBlogs, type BlogSortKey } from '../utils/sortBlogs';

/** 列表页筛选条件。 */
export interface BlogFilters {
  query: string;
  frameworkId: ID | null;
  selectedTagIds: ID[];
  statusFilter: BlogStatus | 'all';
}

/** 状态过滤单选项（含「全部」）。 */
export type StatusFilter = BlogStatus | 'all';

/** 默认筛选条件（无任何 filter）。 */
export const DEFAULT_BLOG_FILTERS: BlogFilters = {
  query: '',
  frameworkId: null,
  selectedTagIds: [],
  statusFilter: 'all',
};

/**
 * 组合筛选 + 搜索 + 排序。
 * @param blogs 原始 blogs（来自 useBlogs）；undefined 表示 live query 首帧
 * @param filters 筛选条件
 * @param sort 排序键
 * @returns 过滤+排序后的 Blog[]；undefined 表示上游未就绪
 */
export function useFilteredBlogs(
  blogs: Blog[] | undefined,
  filters: BlogFilters,
  sort: BlogSortKey,
): Blog[] | undefined {
  // 1) status
  const statusFiltered = useMemo<Blog[] | undefined>(() => {
    if (!blogs) return undefined;
    if (filters.statusFilter === 'all') return blogs;
    return blogs.filter((b) => b.status === filters.statusFilter);
  }, [blogs, filters.statusFilter]);

  // 2) framework
  const frameworkFiltered = useMemo<Blog[] | undefined>(() => {
    if (!statusFiltered) return undefined;
    if (!filters.frameworkId) return statusFiltered;
    return statusFiltered.filter((b) => b.frameworkId === filters.frameworkId);
  }, [statusFiltered, filters.frameworkId]);

  // 3) tag (OR)
  const tagFiltered = useMemo<Blog[] | undefined>(() => {
    if (!frameworkFiltered) return undefined;
    if (filters.selectedTagIds.length === 0) return frameworkFiltered;
    return frameworkFiltered.filter((b) =>
      b.tagIds.some((t) => filters.selectedTagIds.includes(t)),
    );
  }, [frameworkFiltered, filters.selectedTagIds]);

  // 4) search (title / excerpt / tagIds)
  const searched = useMemo<Blog[] | undefined>(() => {
    if (!tagFiltered) return undefined;
    const needle = filters.query.trim().toLowerCase();
    if (!needle) return tagFiltered;
    return tagFiltered.filter((b) => {
      if (b.title.toLowerCase().includes(needle)) return true;
      if (b.excerpt.toLowerCase().includes(needle)) return true;
      if (b.tagIds.some((t) => t.toLowerCase().includes(needle))) return true;
      return false;
    });
  }, [tagFiltered, filters.query]);

  // 5) sort
  const sorted = useMemo<Blog[] | undefined>(() => {
    if (!searched) return undefined;
    return sortBlogs(searched, sort);
  }, [searched, sort]);

  return sorted;
}
