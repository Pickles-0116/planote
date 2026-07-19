/**
 * useBlog - 订阅单个 Blog 的实时数据
 *
 * @param id 博客 ID；传 `null` / `undefined` 不订阅（返回 undefined）
 * @returns Blog；首次渲染返回 undefined
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { blogRepo } from '@/db/repos';
import type { ID, Blog } from '@/types/domain';

export function useBlog(id: ID | null | undefined): Blog | undefined {
  return useLiveQuery(
    async () => (id ? await blogRepo.get(id) : undefined),
    [id],
  );
}
