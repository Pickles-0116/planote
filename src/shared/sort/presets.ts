/**
 * 排序预设 (presets)
 *
 * 单一来源：4 个 SortKey 的语义 + UI 文案（label / description）。
 * UI（PlanSortDropdown）只读 `SORT_OPTIONS`，新增预设只在这里加一行。
 */

/** 4 种预设枚举。 */
export type SortKey = 'smart' | 'recent' | 'upcoming' | 'progress';

/** 默认排序键。 */
export const DEFAULT_SORT_KEY: SortKey = 'smart';

/** 排序预设的 UI 描述。 */
export interface SortOption {
  key: SortKey;
  label: string;
  description: string;
}

/** 预设顺序：与设计稿一致，smart 在前为默认。 */
export const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { key: 'smart', label: '智能排序', description: '按紧急度 + 进度排序' },
  { key: 'recent', label: '最近活跃', description: '按最近更新时间排序' },
  { key: 'upcoming', label: '即将到期', description: '按截止日期升序' },
  { key: 'progress', label: '进度优先', description: '高进度在前' },
];

/** 由 key 查找对应 UI 选项（找不到时回退到 default）。 */
export function findSortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0];
}
