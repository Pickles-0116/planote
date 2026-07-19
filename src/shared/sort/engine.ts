/**
 * 排序引擎 (sortEngine)
 *
 * 泛型纯函数，为 Plan / Blog 等任意实体提供可复用的排序能力。
 * 详见 add-smart-sort/design.md §2.1 / §2.2。
 *
 * 4 关键字公式（smart 预设，与原 useSortedPlans 完全一致）：
 *   1) urgency  升序  red(0) → orange(1) → yellow(2) → none(3)
 *   2) progress 降序  高进度优先（给用户「完成感」）
 *   3) endDate  升序  无 endDate 排最后
 *   4) createdAt 降序 最新创建在前（平 tie）
 *
 * 设计要点：
 * - 纯函数 + 不引外部依赖；
 * - 字段取值走 `accessors` 注入，避免引擎内 switch 写死 `plan.urgency`；
 * - v1.0 引擎内置 Plan 的默认 accessors，其他实体（如 Blog）复用时显式传入。
 */

import type { ISODate, Plan, UrgencyLevel } from '@/types/domain';
import type { SortKey } from './presets';

/** 排序方向（v1.0 字段预留，UI 不暴露）。 */
export type SortDirection = 'asc' | 'desc';

/** 4 种预设的规约（v1.0 硬编码字段，方向可选反转）。 */
export interface SortSpec {
  key: SortKey;
  direction?: SortDirection;
}

/** 可比较的字段类型。 */
export type Sortable = string | number | Date | null | undefined;

/** accessors：引擎需要的字段取值函数集合。 */
export interface PlanAccessors<T> {
  urgency: (item: T) => UrgencyLevel;
  progress: (item: T) => number;
  endDate: (item: T) => ISODate | undefined;
  createdAt: (item: T) => ISODate;
  updatedAt: (item: T) => ISODate;
}

/** 引擎可选项：accessors + 自定义 comparator。 */
export interface SortEngineOptions<T> {
  accessors?: Partial<PlanAccessors<T>>;
  /** 自定义 comparator（覆盖预设，v1.0 不暴露给 UI）。 */
  comparator?: (a: T, b: T) => number;
}

/* ------------------------------------------------------------
 * 内部工具：日期升序比较（无值排最后）
 * ------------------------------------------------------------ */
function compareDateAsc(a: ISODate | undefined, b: ISODate | undefined): number {
  if (a && b) return a < b ? -1 : a > b ? 1 : 0;
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/* ------------------------------------------------------------
 * Plan 实体默认 accessors
 * ------------------------------------------------------------ */
const PLAN_ACCESSORS: PlanAccessors<Plan> = {
  urgency: (p) => p.urgency,
  progress: (p) => p.progress,
  endDate: (p) => p.endDate,
  createdAt: (p) => p.createdAt,
  updatedAt: (p) => p.updatedAt,
};

/* ------------------------------------------------------------
 * 紧急度排序权重（与 add-plan-list-view 硬编码公式一致）
 * ------------------------------------------------------------ */
const URGENCY_RANK: Record<UrgencyLevel, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  none: 3,
};

/* ------------------------------------------------------------
 * 4 种预设的 comparator 工厂
 *
 * 每个 preset 接收完整 accessors；类型上「实际只会用到它需要的字段」，
 * 但显式声明全部字段可以让 caller 零负担（不必为每个 preset 单独构造）。
 * ------------------------------------------------------------ */
type PresetComparator<T> = (
  a: T,
  b: T,
  acc: PlanAccessors<T>,
) => number;

const PRESETS: Record<SortKey, PresetComparator<unknown>> = {
  smart: (a, b, acc) => {
    // 1) 紧急度升序
    const ua = URGENCY_RANK[acc.urgency(a as never)] - URGENCY_RANK[acc.urgency(b as never)];
    if (ua !== 0) return ua;
    // 2) 进度降序
    const pa = acc.progress(b as never) - acc.progress(a as never);
    if (pa !== 0) return pa;
    // 3) endDate 升序（无 endDate 排最后）
    const ea = compareDateAsc(acc.endDate(a as never), acc.endDate(b as never));
    if (ea !== 0) return ea;
    // 4) createdAt 降序（ISO 字符串字典序 == 时间序）
    return acc.createdAt(b as never).localeCompare(acc.createdAt(a as never));
  },
  recent: (a, b, acc) =>
    acc.updatedAt(b as never).localeCompare(acc.updatedAt(a as never)),
  upcoming: (a, b, acc) =>
    compareDateAsc(acc.endDate(a as never), acc.endDate(b as never)),
  progress: (a, b, acc) => {
    const pa = acc.progress(b as never) - acc.progress(a as never);
    return pa !== 0 ? pa : acc.createdAt(b as never).localeCompare(acc.createdAt(a as never));
  },
};

/* ------------------------------------------------------------
 * 引擎主入口
 *
 * 行为：
 * - 返回新数组（[...items].sort()），不修改入参；
 * - 空数组 / 单元素直接返回新浅拷贝；
 * - 自定义 comparator 优先于预设（v1.0 不暴露，扩展点）。
 * ------------------------------------------------------------ */
export function sortEngine<T>(
  items: T[],
  spec: SortSpec,
  options?: SortEngineOptions<T>,
): T[] {
  // 显式自定义 comparator：完全覆盖预设
  if (options?.comparator) {
    return [...items].sort(options.comparator);
  }
  // 合并 accessors：caller 提供的优先
  const acc: PlanAccessors<T> = {
    ...(PLAN_ACCESSORS as unknown as PlanAccessors<T>),
    ...(options?.accessors ?? {}),
  };
  const preset = PRESETS[spec.key] as PresetComparator<T>;
  return [...items].sort((a, b) => preset(a, b, acc));
}
