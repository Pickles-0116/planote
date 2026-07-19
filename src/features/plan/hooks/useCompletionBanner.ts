/**
 * useCompletionBanner - 100% 完成横幅的显示状态
 *
 * 行为（design.md §2.4）：
 * - 入参：plan（含 progress + id + status）
 * - 显示条件：plan.progress >= 100 && plan.status !== 'done' && 未被本会话 dismiss
 * - 关闭存到 sessionStorage `planote:plan-detail:banner-dismissed` Set<planId>
 * - 跨 plan 互不干扰（按 planId 区分）
 * - 路由变化：清空 dismissed（不持久化）
 *
 * 路由变化清空策略：useLocation 监听 pathname 变化，重置 dismissed 状态。
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ID, Plan } from '@/types/domain';

const BANNER_DISMISSED_KEY = 'planote:plan-detail:banner-dismissed';

function readDismissed(): Set<ID> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(BANNER_DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<ID>): void {
  try {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    /* sessionStorage 不可用时静默 */
  }
}

export interface UseCompletionBannerResult {
  /** 是否应该显示横幅。 */
  shouldShow: boolean;
  /** 关闭横幅（写入 sessionStorage，本会话不再显示）。 */
  dismiss: () => void;
}

export function useCompletionBanner(plan: Plan | null | undefined): UseCompletionBannerResult {
  const location = useLocation();
  const [dismissed, setDismissed] = useState<Set<ID>>(() => readDismissed());

  // 路由变化时清空 dismissed 集合（设计意图：跨 plan 重新评估）
  useEffect(() => {
    setDismissed(readDismissed());
  }, [location.pathname]);

  const dismiss = useCallback(() => {
    if (!plan) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(plan.id);
      writeDismissed(next);
      return next;
    });
  }, [plan]);

  // 显示条件：plan 存在 + progress >= 100 + status !== 'done' + 未 dismiss
  const shouldShow = !!(
    plan &&
    plan.progress >= 100 &&
    plan.status !== 'done' &&
    !dismissed.has(plan.id)
  );

  return { shouldShow, dismiss };
}
