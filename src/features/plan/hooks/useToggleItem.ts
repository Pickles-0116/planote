/**
 * useToggleItem - 事项勾选 + Plan.progress 重算联动
 *
 * 行为（design.md §2.2）：
 * 1. 单击 checkbox → useItemStore.toggleItem(id) 立即乐观更新（UI 反映）
 * 2. 200ms debounce 内多次勾选只触发 1 次 planRepo.recomputeProgress
 * 3. recomputeProgress 写回 Plan.progress 字段 → useLiveQuery 推送 → 进度环同步
 *
 * setStatus（标记进行中/待办）：包装 useItemStore.setItemStatus。
 * 当前 v1.0 状态机：done ⇄ todo 通过 toggle；doing 是 UI 视觉态，由 setStatus 单独触发。
 *
 * 失败处理：store 内已 console.error；本 hook 静默吞错（v1.0 简化）。
 */

import { useCallback, useRef } from 'react';
import type { ID, ItemStatus } from '@/types/domain';
import { useItemsStore, usePlanStore } from '@/stores';

export interface UseToggleItemResult {
  /** 勾选/取消勾选（done ⇄ todo）。 */
  toggle: (itemId: ID) => Promise<void>;
  /** 设置事项状态（todo / doing / done）。 */
  setStatus: (itemId: ID, status: ItemStatus) => Promise<void>;
}

export function useToggleItem(planId: ID): UseToggleItemResult {
  const toggleItem = useItemsStore((s) => s.toggleItem);
  const setItemStatus = useItemsStore((s) => s.setItemStatus);
  const recompute = usePlanStore((s) => s.recomputeProgress);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 触发 plan.progress 重算（200ms debounce）。
   * setStatus 路径不经过此处——setItemStatus 内部已同步 recompute。
   */
  const scheduleRecompute = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void recompute(planId).catch((e) => {
        console.error('[useToggleItem] recompute failed:', e);
      });
    }, 200);
  }, [recompute, planId]);

  const toggle = useCallback(
    async (itemId: ID) => {
      try {
        await toggleItem(itemId);
        scheduleRecompute();
      } catch (e) {
        // store 内已 console.error；本 hook 静默吞错
        console.error('[useToggleItem] toggle failed:', e);
      }
    },
    [toggleItem, scheduleRecompute],
  );

  const setStatus = useCallback(
    async (itemId: ID, status: ItemStatus) => {
      try {
        await setItemStatus(itemId, status);
        // setItemStatus 已同步 recompute，不需 debounce
      } catch (e) {
        console.error('[useToggleItem] setStatus failed:', e);
      }
    },
    [setItemStatus],
  );

  return { toggle, setStatus };
}
