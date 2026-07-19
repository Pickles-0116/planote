/**
 * 进度派生计算
 *
 * 公式（详见 spec.md Requirement: 进度派生计算）：
 * - `progress = floor(checkedCount / totalCount * 100)`
 * - `totalCount === 0` 时返回 0（不抛错，避免新建空计划崩溃）
 *
 * 纯函数，便于单测。
 */

import type { Item } from '@/types/domain';

/**
 * 根据事项列表计算进度百分比。
 *
 * @param items 只需 `checked` 字段（其他字段不影响）
 * @returns 0-100 整数
 */
export function computeProgress(
  items: Pick<Item, 'checked'>[],
): number {
  if (items.length === 0) return 0;
  const checked = items.filter((i) => i.checked).length;
  return Math.floor((checked / items.length) * 100);
}
