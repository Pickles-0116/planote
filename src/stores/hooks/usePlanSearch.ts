/**
 * usePlanSearch - 全文搜索 hook（title + description 子串匹配）
 *
 * 设计要点（add-plan-list-view/design.md §2.1）：
 * - 大小写不敏感（统一 toLowerCase）
 * - 中文按字符直接匹配（`String.includes`，不分词）
 * - 空 query / 纯空白 query 透传原数组（不复制，避免不必要重算）
 * - useMemo 缓存：query 未变时不重算
 *
 * v1.0 不做语义搜索 / 标签搜索 / 事项内容搜索（design.md §6 明确出范围）。
 */

import { useMemo } from 'react';
import type { Plan } from '@/types/domain';

export function usePlanSearch(
  plans: Plan[] | undefined,
  query: string,
): Plan[] | undefined {
  return useMemo(() => {
    if (plans === undefined) return undefined;
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [plans, query]);
}
