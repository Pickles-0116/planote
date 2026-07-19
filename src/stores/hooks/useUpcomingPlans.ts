/**
 * useUpcomingPlans - 即将到期 section 数据
 *
 * 派生规则（详见 add-data-binding-dashboard/design.md §3.3）：
 * - 过滤：endDate 未过期 && status !== 'done' && status !== 'paused'
 * - 排序：urgency asc（red > orange > yellow > none）+ endDate asc
 * - 截取：前 `limit` 条（默认 3）
 *
 * v1.0 简化：itemProgress 留空（Sprint 2 接入 useItemsForPlan 后再加 X/Y 完成度）。
 */

import { useMemo } from 'react';
import { usePlans } from './usePlans';
import type { Plan, UrgencyLevel } from '@/types/domain';

export interface UpcomingPlan {
  plan: Plan;
  /** 距 endDate 的天数（向上取整；>= 0 表示未过期）。 */
  daysLeft: number;
  urgency: UrgencyLevel;
}

const URGENCY_RANK: Record<UrgencyLevel, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  none: 3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function useUpcomingPlans(limit: number = 3): UpcomingPlan[] | undefined {
  const plans = usePlans();

  return useMemo<UpcomingPlan[] | undefined>(() => {
    if (plans === undefined) return undefined;
    return pickUpcoming(plans, limit);
  }, [plans, limit]);
}

/** 纯函数，便于单测。 */
export function pickUpcoming(plans: Plan[], limit: number): UpcomingPlan[] {
  const now = Date.now();
  return plans
    .filter(
      (p) =>
        p.endDate !== undefined &&
        p.status !== 'done' &&
        p.status !== 'paused' &&
        new Date(p.endDate).getTime() >= now, // 未过期
    )
    .sort((a, b) => {
      const ra = URGENCY_RANK[a.urgency];
      const rb = URGENCY_RANK[b.urgency];
      if (ra !== rb) return ra - rb;
      // 同紧急度按 endDate 升序
      const aTs = new Date(a.endDate!).getTime();
      const bTs = new Date(b.endDate!).getTime();
      return aTs - bTs;
    })
    .slice(0, limit)
    .map<UpcomingPlan>((plan) => ({
      plan,
      daysLeft: Math.ceil(
        (new Date(plan.endDate!).getTime() - now) / DAY_MS,
      ),
      urgency: plan.urgency,
    }));
}
