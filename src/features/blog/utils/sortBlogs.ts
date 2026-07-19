/**
 * sortBlogs - 博客侧 sort-engine 预设（add-blog-list-and-detail 增量）
 *
 * 复用 add-smart-sort 的 preset 注册模式（见 docs/architecture.md §6.4）：
 * - 每种 sort key 是一个 comparator 工厂
 * - sortBlogs(blogs, key) 入口纯函数，返回新数组
 * - v1.1 扩展加 sort key 只动 preset 表
 *
 * 3 个 preset（v1.0 简版）：
 * - created-desc：最近创建（默认；ISO 字符串字典序 == 时间序）
 * - updated-desc：最近更新
 * - title-asc：标题字母 / 中文拼音升序（用 localeCompare(..., 'zh-CN')）
 */

import type { Blog } from '@/types/domain';

/** 3 种预设枚举（v1.0 简版）。 */
export type BlogSortKey = 'created-desc' | 'updated-desc' | 'title-asc';

/** 默认排序键。 */
export const DEFAULT_BLOG_SORT_KEY: BlogSortKey = 'created-desc';

/** 排序预设的 UI 描述。 */
export interface BlogSortOption {
  key: BlogSortKey;
  label: string;
}

/** 预设顺序：与设计稿一致，created-desc 在前为默认。 */
export const BLOG_SORT_OPTIONS: ReadonlyArray<BlogSortOption> = [
  { key: 'created-desc', label: '最近创建' },
  { key: 'updated-desc', label: '最近更新' },
  { key: 'title-asc', label: '标题 A→Z' },
];

/** 由 key 查找 UI 选项（找不到时回退到默认）。 */
export function findBlogSortOption(key: BlogSortKey): BlogSortOption {
  return BLOG_SORT_OPTIONS.find((o) => o.key === key) ?? BLOG_SORT_OPTIONS[0];
}

/** 预设注册表（comparator 工厂）。 */
const COMPARATORS: Record<BlogSortKey, (a: Blog, b: Blog) => number> = {
  'created-desc': (a, b) => b.createdAt.localeCompare(a.createdAt),
  'updated-desc': (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  'title-asc': (a, b) => a.title.localeCompare(b.title, 'zh-CN'),
};

/** 主入口：返回新数组（不修改入参）。 */
export function sortBlogs(blogs: Blog[], key: BlogSortKey): Blog[] {
  const cmp = COMPARATORS[key];
  return [...blogs].sort(cmp);
}
