/**
 * useTodayFocus - 今日聚焦选 plan
 *
 * 选 plan 策略（详见 add-data-binding-dashboard/design.md §3.2）：
 *   1. urgency === 'red' 中按 endDate asc 取第一个
 *   2. 否则 urgency === 'orange' 中按 endDate asc 取第一个
 *   3. 否则最近编辑的 status === 'doing' plan（按 updatedAt desc）
 *   4. 否则最近编辑的 status === 'todo' plan（按 updatedAt desc）
 *
 * 注意：本 hook 不返回 items。items 由组件二次调 useItemsForPlan(plan.id)
 * 拉取（见 design §3.2.1，方案 A：单一职责）。
 *
 * useLiveQuery 在输入未就绪时返回 undefined；本 hook 透传该语义。
 */

import { useMemo } from 'react';
import { usePlans } from './usePlans';
import type { Plan, UrgencyLevel } from '@/types/domain';

export interface TodayFocus {
  plan: Plan;
  /** 前 4 个 item（由调用方通过 useItemsForPlan 拉取后截取）。此处保留字段供后续派生。 */
  // items 不在此 hook 返回，避免 hooks 规则违反（条件式 useLiveQuery）。
}

const URGENCY_RANK: Record<UrgencyLevel, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  none: 3,
};

export function useTodayFocus(): TodayFocus | undefined {
  const plans = usePlans();

  return useMemo<TodayFocus | undefined>(() => {
    if (plans === undefined) return undefined;
    return pickFocusPlan(plans);
  }, [plans]);
}

/** 纯函数，便于单测。 */
export function pickFocusPlan(plans: Plan[]): TodayFocus | undefined {
  if (plans.length === 0) return undefined;

  // 先按紧急度 + endDate 升序排序
  const sorted = [...plans].sort((a, b) => {
    const ra = URGENCY_RANK[a.urgency];
    const rb = URGENCY_RANK[b.urgency];
    if (ra !== rb) return ra - rb;
    // 同紧急度：endDate 升序（无 endDate 的排后）
    if (a.endDate && b.endDate) {
      return a.endDate < b.endDate ? -1 : 1;
    }
    if (a.endDate) return -1;
    if (b.endDate) return 1;
    return 0;
  });

  // 1) red
  const red = sorted.find((p) => p.urgency === 'red');
  if (red) return { plan: red };

  // 2) orange
  const orange = sorted.find((p) => p.urgency === 'orange');
  if (orange) return { plan: orange };

  // 3) 最近 doing
  const doing = [...plans]
    .filter((p) => p.status === 'doing')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (doing) return { plan: doing };

  // 4) 最近 todo
  const todo = [...plans]
    .filter((p) => p.status === 'todo')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (todo) return { plan: todo };

  // 兜底：返回所有 plan 中最近更新的（处理只有 paused / done 的边界情况）
  const fallback = [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  return fallback ? { plan: fallback } : undefined;
}
