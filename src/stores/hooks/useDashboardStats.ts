/**
 * useDashboardStats - Dashboard 4 个数字卡派生
 *
 * 派生规则（详见 add-data-binding-dashboard/design.md §3.1，梓浩 2026-08-03 调整）：
 * - monthlyCompletionRate：所有 plan 的 `progress` 平均值（planRepo 已缓存）
 * - activePlans         ：status !== 'done' && status !== 'paused' 的 plan 数
 * - completedItems      ：v1.0 简化为「已完成的计划数」（streak 算法留到 v1.1）
 * - totalBlogs          ：全部 blog 数（含 draft/published/archived，不再只统计 published——
 *                         导入与 AI 草稿默认 draft，只统计 published 会让卡片恒为 0 与用户预期不符）
 *
 * 注意：useLiveQuery 返回 `T | undefined`；本 hook 在输入任一未就绪时返回 undefined。
 * 用 useMemo 包裹避免每次渲染重算。
 */

import { useMemo } from 'react';
import { usePlans } from './usePlans';
import { useBlogs } from './useBlogs';
import type { Blog, Plan } from '@/types/domain';

export interface DashboardStats {
  /** 本月完成率 0-100。0 条 plan 时为 0。 */
  monthlyCompletionRate: number;
  /** 进行中的计划数（排除 done / paused）。 */
  activePlans: number;
  /** v1.0 简化为「已完成的计划数」。streak 算法留到 v1.1 仪表盘增强。 */
  completedItems: number;
  /** 博客总数（含所有状态）。 */
  totalBlogs: number;
}

export function useDashboardStats(): DashboardStats | undefined {
  const plans = usePlans();
  const blogs = useBlogs();

  return useMemo<DashboardStats | undefined>(() => {
    if (plans === undefined || blogs === undefined) return undefined;
    return computeStats(plans, blogs);
  }, [plans, blogs]);
}

/** 纯函数，便于单测与外部复用。 */
export function computeStats(plans: Plan[], blogs: Blog[]): DashboardStats {
  const activePlans = plans.filter(
    (p) => p.status !== 'done' && p.status !== 'paused',
  ).length;

  // 全部博客（含 draft/published/archived）。只统计 published 会导致导入/AI 草稿恒不显示，
  // 与用户「我传了多少博客」的预期不符（梓浩，2026-08-03）。
  const totalBlogs = blogs.length;

  // 本月完成率：所有 plan 的 progress 字段平均值（已由 PlanRepo.recomputeProgress 缓存）
  const monthlyCompletionRate =
    plans.length === 0
      ? 0
      : Math.floor(
          plans.reduce((sum, p) => sum + (p.progress ?? 0), 0) / plans.length,
        );

  // v1.0 简化：用「status === 'done' 的 plan 数」作为完成指标。
  // 严格意义（items.checked=true 的总数）需要 items 订阅，留给 Sprint 2。
  const completedItems = plans.filter((p) => p.status === 'done').length;

  return {
    monthlyCompletionRate,
    activePlans,
    completedItems,
    totalBlogs,
  };
}
