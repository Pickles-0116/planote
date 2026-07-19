/**
 * useRecentBlogs - 最近博客 section 数据
 *
 * 派生规则（详见 add-data-binding-dashboard/design.md）：
 * - 过滤：status === 'published'
 * - 排序：publishedAt desc（publishedAt 缺失时降级用 updatedAt）
 * - 截取：前 `limit` 条（默认 3）
 *
 * useLiveQuery 首帧返回 undefined，本 hook 透传。
 */

import { useMemo } from 'react';
import { useBlogs } from './useBlogs';
import type { Blog } from '@/types/domain';

export function useRecentBlogs(limit: number = 3): Blog[] | undefined {
  const blogs = useBlogs();

  return useMemo<Blog[] | undefined>(() => {
    if (blogs === undefined) return undefined;
    return pickRecentBlogs(blogs, limit);
  }, [blogs, limit]);
}

/** 纯函数，便于单测。 */
export function pickRecentBlogs(blogs: Blog[], limit: number): Blog[] {
  return blogs
    .filter((b) => b.status === 'published')
    .sort((a, b) => {
      // publishedAt 优先；缺失时降级到 updatedAt
      const aTime = a.publishedAt ?? a.updatedAt;
      const bTime = b.publishedAt ?? b.updatedAt;
      if (aTime === bTime) return a.id < b.id ? -1 : 1; // 稳定排序
      return aTime < bTime ? 1 : -1;
    })
    .slice(0, limit);
}
