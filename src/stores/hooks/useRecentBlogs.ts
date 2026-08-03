/**
 * useRecentBlogs - 最近博客 section 数据
 *
 * 派生规则（详见 add-data-binding-dashboard/design.md §3.3，梓浩 2026-08-03 调整）：
 * - 过滤：无（含 draft/published/archived 全部博客——只显示 published 会导致
 *   导入/AI 草稿在「最近博客」区永远为空，与「博客总数」卡片口径不一致）
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
    .slice()
    .sort((a, b) => {
      // publishedAt 优先；缺失时降级到 updatedAt
      const aTime = a.publishedAt ?? a.updatedAt;
      const bTime = b.publishedAt ?? b.updatedAt;
      if (aTime === bTime) return a.id < b.id ? -1 : 1; // 稳定排序
      return aTime < bTime ? 1 : -1;
    })
    .slice(0, limit);
}
