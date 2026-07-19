/**
 * useSortedPlans - 智能排序 hook（已重构，委托给 sortEngine）
 *
 * add-smart-sort 实施后，本 hook 仅作为「状态 + 缓存」外壳：
 *   - 接收 sort 参数（默认 'smart'，与重构前行为完全一致）
 *   - 内部委托 `@/shared/sort` 的 sortEngine
 *   - 仍负责 `undefined` 入参守卫（liveQuery 首帧返回 undefined 走骨架屏）
 *
 * 行为兼容（add-smart-sort/proposal.md AC-1 / AC-6）：
 *   useSortedPlans(plans) ≡ sortEngine(plans, { key: 'smart' })
 *   ≡ 重构前的 sortPlans(plans)
 */

import { useMemo } from 'react';
import type { Plan } from '@/types/domain';
import { sortEngine, DEFAULT_SORT_KEY } from '@/shared/sort';
import type { SortKey } from '@/shared/sort';

export function useSortedPlans(
  plans: Plan[] | undefined,
  sort: SortKey = DEFAULT_SORT_KEY,
): Plan[] | undefined {
  return useMemo(() => {
    if (plans === undefined) return undefined;
    return sortEngine<Plan>(plans, { key: sort });
  }, [plans, sort]);
}
