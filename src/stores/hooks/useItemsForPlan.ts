/**
 * useItemsForPlan - 订阅某计划下所有 Items 的实时数据
 *
 * 按 `[planId+order]` 复合索引返回，order 升序。
 *
 * @param planId 计划 ID；传 `null` / `undefined` 不订阅（返回 undefined）
 * @returns Item[]；首次渲染返回 undefined
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { itemRepo } from '@/db/repos';
import type { ID, Item } from '@/types/domain';

export function useItemsForPlan(
  planId: ID | null | undefined,
): Item[] | undefined {
  return useLiveQuery(
    async () => (planId ? await itemRepo.listByPlan(planId) : []),
    [planId],
  );
}
