/**
 * useEntityFilters - 统一的多维筛选 hook（V1.2 B5）
 *
 * 为「计划列表 / 看板」提供一致的筛选状态管理与应用逻辑：
 * - 维度：status / timeDim / level / tagIds(OR) / dateRange
 * - 纯函数 `applyEntityFilters` 便于测试与复用
 * - hook 封装 state + 切换器 + 重置 + `apply`
 *
 * 设计约束：
 * - 仅当某维度筛选数组非空时才过滤该维度（空数组 = 不过滤）
 * - 标签为 OR 语义（命中任一即保留）
 * - 通用实体需满足 `EntityFilterable`（至少含 tagIds）
 */

import { useCallback, useMemo, useState } from 'react';
import type { ID } from '@/types/domain';

/** 统一筛选状态（计划 / 事项共用）。 */
export interface EntityFilterState {
  statuses: string[];
  timeDims: string[];
  levels: string[];
  selectedTagIds: ID[];
  dateRange: { start: string; end: string } | null;
}

/** 默认（空）筛选状态。 */
export const DEFAULT_ENTITY_FILTERS: EntityFilterState = {
  statuses: [],
  timeDims: [],
  levels: [],
  selectedTagIds: [],
  dateRange: null,
};

/** 可被多维筛选的实体最小接口。 */
export interface EntityFilterable {
  tagIds: ID[];
  status?: string;
  timeDim?: string;
  level?: string;
  startDate?: string;
}

/** 判断筛选状态是否「有激活条件」。 */
export function hasActiveEntityFilters(f: EntityFilterState): boolean {
  return (
    f.statuses.length > 0 ||
    f.timeDims.length > 0 ||
    f.levels.length > 0 ||
    f.selectedTagIds.length > 0 ||
    f.dateRange !== null
  );
}

/**
 * 纯函数：对已筛选集合应用维度过滤。
 * @param items 待筛选实体集合
 * @param f 筛选状态
 * @returns 过滤后的新集合（不修改入参）
 */
export function applyEntityFilters<T extends EntityFilterable>(
  items: T[],
  f: EntityFilterState,
): T[] {
  let result = items;
  if (f.statuses.length > 0) {
    result = result.filter((i) => i.status !== undefined && f.statuses.includes(i.status));
  }
  if (f.timeDims.length > 0) {
    result = result.filter((i) => i.timeDim !== undefined && f.timeDims.includes(i.timeDim));
  }
  if (f.levels.length > 0) {
    result = result.filter((i) => i.level !== undefined && f.levels.includes(i.level));
  }
  if (f.selectedTagIds.length > 0) {
    result = result.filter((i) => i.tagIds.some((t) => f.selectedTagIds.includes(t)));
  }
  if (f.dateRange) {
    const { start, end } = f.dateRange;
    result = result.filter((i) => {
      const d = i.startDate ?? '';
      if (start && d < start) return false;
      if (end && d > end + 'T23:59:59') return false;
      return true;
    });
  }
  return result;
}

export interface UseEntityFiltersReturn<T extends EntityFilterable> {
  filters: EntityFilterState;
  setFilters: (f: EntityFilterState) => void;
  toggleStatus: (s: string) => void;
  toggleTimeDim: (d: string) => void;
  toggleLevel: (l: string) => void;
  toggleTag: (id: ID) => void;
  setDateRange: (r: { start: string; end: string } | null) => void;
  reset: () => void;
  hasActiveFilters: boolean;
  /** 对给定集合应用当前筛选。 */
  apply: (items: T[]) => T[];
}

/**
 * 统一的实体多维筛选 hook。
 *
 * @example
 * const { filters, toggleTag, apply } = useEntityFilters<Plan>();
 * const filtered = apply(plans);
 */
export function useEntityFilters<T extends EntityFilterable>(
  initial: EntityFilterState = DEFAULT_ENTITY_FILTERS,
): UseEntityFiltersReturn<T> {
  const [filters, setFilters] = useState<EntityFilterState>(initial);

  const toggleStatus = useCallback((s: string) => {
    setFilters((p) => ({
      ...p,
      statuses: p.statuses.includes(s)
        ? p.statuses.filter((x) => x !== s)
        : [...p.statuses, s],
    }));
  }, []);

  const toggleTimeDim = useCallback((d: string) => {
    setFilters((p) => ({
      ...p,
      timeDims: p.timeDims.includes(d)
        ? p.timeDims.filter((x) => x !== d)
        : [...p.timeDims, d],
    }));
  }, []);

  const toggleLevel = useCallback((l: string) => {
    setFilters((p) => ({
      ...p,
      levels: p.levels.includes(l)
        ? p.levels.filter((x) => x !== l)
        : [...p.levels, l],
    }));
  }, []);

  const toggleTag = useCallback((id: ID) => {
    setFilters((p) => ({
      ...p,
      selectedTagIds: p.selectedTagIds.includes(id)
        ? p.selectedTagIds.filter((x) => x !== id)
        : [...p.selectedTagIds, id],
    }));
  }, []);

  const setDateRange = useCallback((r: { start: string; end: string } | null) => {
    setFilters((p) => ({ ...p, dateRange: r }));
  }, []);

  const reset = useCallback(() => setFilters(DEFAULT_ENTITY_FILTERS), []);

  const hasActiveFilters = useMemo(() => hasActiveEntityFilters(filters), [filters]);

  const apply = useCallback((items: T[]): T[] => applyEntityFilters(items, filters), [filters]);

  return {
    filters,
    setFilters,
    toggleStatus,
    toggleTimeDim,
    toggleLevel,
    toggleTag,
    setDateRange,
    reset,
    hasActiveFilters,
    apply,
  };
}
