/**
 * usePlan - 订阅单个 Plan 的实时数据
 *
 * 基于 `dexie-react-hooks` 的 `useLiveQuery`。
 * IndexedDB 变化时（任何 Tab）自动重渲染。
 *
 * @param id 计划 ID；传 `null` / `undefined` 不订阅（返回 undefined）
 * @returns Plan 对象；首次渲染返回 undefined（IndexedDB 异步打开）
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { planRepo } from '@/db/repos';
import type { ID, Plan } from '@/types/domain';

export function usePlan(id: ID | null | undefined): Plan | undefined {
  return useLiveQuery(
    async () => (id ? await planRepo.get(id) : undefined),
    [id],
  );
}
