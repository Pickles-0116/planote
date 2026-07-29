/**
 * useFilteredBlogs - 列表页筛选 + 搜索 + 排序组合 hook（add-blog-list-and-detail 增量）
 *
 * 设计（design.md §2.1 数据 pipeline）：
 *   useBlogs()                       ← live query 订阅
 *     ↓
 *   useFilteredBlogs(blogs, filters, sort)
 *     ├─ useMemo: status filter
 *     ├─ useMemo: framework filter
 *     ├─ useMemo: template filter
 *     ├─ useMemo: tag filter (OR)
 *     ├─ useMemo: source filter
 *     ├─ useMemo: word count range
 *     ├─ useMemo: date range
 *     ├─ useMemo: folder filter         ← V1.2 F4：按文件夹过滤
 *     ├─ useMemo: search filter          ← V1.2 B4：改走 BlogSearchService（含 contentText）
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
import type { Blog, BlogStatus, BlogSource, ID } from '@/types/domain';
import { sortBlogs, type BlogSortKey } from '../utils/sortBlogs';
import { blogSearchService } from '../search/SearchService';

/** 列表页筛选条件。 */
export interface BlogFilters {
  query: string;
  /** @deprecated v1.4-Unify：统一使用 templateId。保留向后兼容。 */
  frameworkId: ID | null;
  /** v1.4-Unify：按博客模板筛选。 */
  templateId: ID | null;
  selectedTagIds: ID[];
  statusFilter: BlogStatus | 'all';
  /** v1.4-Organize：按来源筛选。 */
  source: BlogSource | 'all';
  /** v1.4-Organize：字数范围（contentText 长度）。 */
  wordCountRange: { min: number; max: number } | null;
  /** v1.4-Organize：日期范围（createdAt）。 */
  dateRange: { start: string; end: string } | null;
  /** V1.2 F4：按文件夹筛选（null = 不过滤，即「全部文件夹」）。 */
  folderId: ID | null;
}

/** 状态过滤单选项（含「全部」）。 */
export type StatusFilter = BlogStatus | 'all';

/** 默认筛选条件（无任何 filter）。 */
export const DEFAULT_BLOG_FILTERS: BlogFilters = {
  query: '',
  frameworkId: null,
  templateId: null,
  selectedTagIds: [],
  statusFilter: 'all',
  source: 'all',
  wordCountRange: null,
  dateRange: null,
  folderId: null,
};

/**
 * 搜索结果在 Blog 基础上附加的评分与片段字段。
 * 当无查询时，searchScore=0 / searchSnippet=''。
 */
export interface BlogWithSnippet extends Blog {
  searchScore: number;
  searchSnippet: string;
}

/**
 * 组合筛选 + 搜索 + 排序。
 * @param blogs 原始 blogs（来自 useBlogs）；undefined 表示 live query 首帧
 * @param filters 筛选条件
 * @param sort 排序键
 * @returns 过滤+排序后的 BlogWithSnippet[]；undefined 表示上游未就绪
 */
export function useFilteredBlogs(
  blogs: Blog[] | undefined,
  filters: BlogFilters,
  sort: BlogSortKey,
): BlogWithSnippet[] | undefined {
  // 1) status
  const statusFiltered = useMemo<Blog[] | undefined>(() => {
    if (!blogs) return undefined;
    if (filters.statusFilter === 'all') return blogs;
    return blogs.filter((b) => b.status === filters.statusFilter);
  }, [blogs, filters.statusFilter]);

  // 2) framework (legacy)
  const frameworkFiltered = useMemo<Blog[] | undefined>(() => {
    if (!statusFiltered) return undefined;
    if (!filters.frameworkId) return statusFiltered;
    return statusFiltered.filter((b) => b.frameworkId === filters.frameworkId);
  }, [statusFiltered, filters.frameworkId]);

  // 2.5) template (v1.4-Unify：兼容旧 frameworkId)
  const templateFiltered = useMemo<Blog[] | undefined>(() => {
    if (!frameworkFiltered) return undefined;
    if (!filters.templateId) return frameworkFiltered;
    return frameworkFiltered.filter(
      (b) => b.templateId === filters.templateId || b.frameworkId === filters.templateId,
    );
  }, [frameworkFiltered, filters.templateId]);

  // 3) tag (OR)
  const tagFiltered = useMemo<Blog[] | undefined>(() => {
    if (!templateFiltered) return undefined;
    if (filters.selectedTagIds.length === 0) return templateFiltered;
    return templateFiltered.filter((b) =>
      b.tagIds.some((t) => filters.selectedTagIds.includes(t)),
    );
  }, [templateFiltered, filters.selectedTagIds]);

  // 3.5) source (v1.4-Organize)
  const sourceFiltered = useMemo<Blog[] | undefined>(() => {
    if (!tagFiltered) return undefined;
    if (filters.source === 'all') return tagFiltered;
    return tagFiltered.filter((b) => b.source === filters.source);
  }, [tagFiltered, filters.source]);

  // 3.6) word count range (v1.4-Organize)
  const wordCountFiltered = useMemo<Blog[] | undefined>(() => {
    if (!sourceFiltered) return undefined;
    if (!filters.wordCountRange) return sourceFiltered;
    const { min, max } = filters.wordCountRange;
    return sourceFiltered.filter((b) => {
      const len = b.contentText?.length ?? 0;
      if (min > 0 && len < min) return false;
      if (max > 0 && len > max) return false;
      return true;
    });
  }, [sourceFiltered, filters.wordCountRange]);

  // 3.7) date range (v1.4-Organize)
  const dateFiltered = useMemo<Blog[] | undefined>(() => {
    if (!wordCountFiltered) return undefined;
    if (!filters.dateRange) return wordCountFiltered;
    const { start, end } = filters.dateRange;
    return wordCountFiltered.filter((b) => {
      if (start && b.createdAt < start) return false;
      if (end && b.createdAt > end + 'T23:59:59') return false;
      return true;
    });
  }, [wordCountFiltered, filters.dateRange]);

  // 3.8) folder (V1.2 F4)
  const folderFiltered = useMemo<Blog[] | undefined>(() => {
    if (!dateFiltered) return undefined;
    if (!filters.folderId) return dateFiltered;
    return dateFiltered.filter((b) => b.folderId === filters.folderId);
  }, [dateFiltered, filters.folderId]);

  // 4) search（V1.2 B4：改走 BlogSearchService，覆盖 title + contentText）
  const searched = useMemo<BlogWithSnippet[] | undefined>(() => {
    if (!folderFiltered) return undefined;
    const needle = filters.query.trim().toLowerCase();
    if (!needle) {
      // 无查询：透传，附空评分/片段
      return folderFiltered.map((b) => ({ ...b, searchScore: 0, searchSnippet: '' }));
    }
    // 载入当前（已按文件夹过滤的）文档集合，再检索
    blogSearchService.setDocuments(folderFiltered);
    return blogSearchService
      .search(needle)
      .map((r) => ({ ...r.blog, searchScore: r.score, searchSnippet: r.snippet }));
  }, [folderFiltered, filters.query]);

  // 5) sort
  const sorted = useMemo<BlogWithSnippet[] | undefined>(() => {
    if (!searched) return undefined;
    return sortBlogs(searched, sort) as BlogWithSnippet[];
  }, [searched, sort]);

  return sorted;
}
