/**
 * 排序模块统一导出
 *
 * 推荐引入方式：
 *   import { sortEngine, useSortedPlans, SORT_OPTIONS } from '@/shared/sort';
 *   import type { SortKey, SortSpec } from '@/shared/sort';
 */

export { sortEngine } from './engine';
export type {
  SortDirection,
  SortSpec,
  Sortable,
  PlanAccessors,
  SortEngineOptions,
} from './engine';

export {
  DEFAULT_SORT_KEY,
  SORT_OPTIONS,
  findSortOption,
} from './presets';
export type { SortKey, SortOption } from './presets';
