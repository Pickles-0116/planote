/**
 * useBlogs - 订阅全部 Blogs 列表的实时数据
 *
 * 默认按 `updatedAt desc` 排序（见 BlogRepo.list 实现）。
 *
 * @returns Blog[]；首次渲染返回 undefined
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { blogRepo } from '@/db/repos';
import type { Blog } from '@/types/domain';

export function useBlogs(): Blog[] | undefined {
  return useLiveQuery(async () => await blogRepo.list(), []);
}
