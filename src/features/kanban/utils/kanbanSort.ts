/**
 * kanbanSort - 看板列内排序
 *
 * 排序规则（add-kanban-board 增量 / spec Requirement: 列内排序）：
 * 1. urgency 降序（红 > 橙 > 黄 > 无），紧急的排前面
 * 2. 紧急度相同时，dueDate 升序（截止早的排前面）
 * 3. 无 dueDate 排最后（视为低优先级）
 *
 * 纯函数，便于单测；不依赖 React / Dexie。
 *
 * @param items 待排序的事项数组
 * @returns 排序后新数组（不修改原数组）
 */

import type { Item, UrgencyLevel } from '@/types/domain';

/** 紧急度等级→数值映射（红=0 最小，最靠前）。 */
export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  none: 3,
};

/** 通过 planId 查 plan.urgency；外部注入避免循环依赖。 */
export type UrgencyResolver = (planId: string) => UrgencyLevel;

/** 不解析 urgency 的简单排序（urgency 默认视为 'none'，仅按 dueDate）。 */
export function sortKanbanItems(items: Item[]): Item[] {
  return sortKanbanItemsWithUrgency(items, () => 'none');
}

/**
 * 带 urgency 解析的排序。
 *
 * @param items       待排序
 * @param resolveUrgency 通过 planId 拿 plan.urgency 的函数
 */
export function sortKanbanItemsWithUrgency(
  items: Item[],
  resolveUrgency: UrgencyResolver,
): Item[] {
  return [...items].sort((a, b) => {
    // 1) urgency 降序（红在前）
    const ua = URGENCY_RANK[resolveUrgency(a.planId)];
    const ub = URGENCY_RANK[resolveUrgency(b.planId)];
    if (ua !== ub) return ua - ub;

    // 2) dueDate 升序（早截止在前；无 dueDate 排最后）
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // 3) 同紧急度 + 同截止 → 保持原序
    return 0;
  });
}
