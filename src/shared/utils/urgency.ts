/**
 * 紧急度派生计算
 *
 * 公式（详见 architecture.md §6.4 + design.md §6.1）：
 * - 无 endDate            → 'none'
 * - status 为 done/paused → 'none'（已完成或已搁置不算紧急）
 * - 距截止 ≤ 0 天（已逾期或今天）→ 'red'
 * - 1-3 天               → 'orange'
 * - 4-7 天               → 'yellow'
 * - > 7 天               → 'none'
 *
 * 纯函数，便于单测；`now` 参数可注入固定时间。
 */

import type { Plan, UrgencyLevel } from '@/types/domain';

/** 一天的毫秒数。 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 计算 `from` 到 `to` 之间的天数差（向上取整，`to` 在 `from` 之前则返回负数）。
 */
export function daysBetween(from: number, to: string | Date): number {
  const t = typeof to === 'string' ? new Date(to).getTime() : to.getTime();
  return Math.ceil((t - from) / DAY_MS);
}

/**
 * 计算 Plan 的紧急度。
 *
 * @param plan 只需 `endDate` 与 `status` 字段（其他字段不影响）
 * @param now  当前时间（毫秒），默认 `Date.now()`，便于测试注入
 */
export function computeUrgency(
  plan: Pick<Plan, 'endDate' | 'status'>,
  now: number = Date.now(),
): UrgencyLevel {
  if (!plan.endDate) return 'none';
  if (plan.status === 'done' || plan.status === 'paused') return 'none';
  const days = daysBetween(now, plan.endDate);
  if (days <= 0) return 'red';
  if (days <= 3) return 'orange';
  if (days <= 7) return 'yellow';
  return 'none';
}
