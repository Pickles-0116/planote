/**
 * computeAppStats · 聚合应用统计数据
 *
 * 来源：openspec/changes/ai-chat-smart-qa/design.md 决策 3。
 */

import { planRepo, blogRepo, itemRepo } from '@/db/repos';
import type { ISODate } from '@/types/domain';

export interface AppStats {
  planCounts: { total: number; todo: number; doing: number; done: number; paused: number };
  blogCounts: { total: number; draft: number; published: number; archived: number };
  itemCounts: { total: number; done: number };
  overallProgress: number;
  weeklyNew: { plans: number; blogs: number };
}

/** 计算"7 天前"的 ISO 字符串。 */
function sevenDaysAgo(): ISODate {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export async function computeAppStats(): Promise<AppStats> {
  const [plans, blogs, items] = await Promise.all([
    planRepo.list(),
    blogRepo.list(),
    itemRepo.list(),
  ]);

  const weekAgo = sevenDaysAgo();
  const weeklyNewPlans = plans.filter((p) => p.createdAt >= weekAgo).length;
  const weeklyNewBlogs = blogs.filter((b) => b.createdAt >= weekAgo).length;

  const overallProgress =
    plans.length > 0
      ? Math.round(plans.reduce((sum, p) => sum + (p.progress ?? 0), 0) / plans.length)
      : 0;

  return {
    planCounts: {
      total: plans.length,
      todo: plans.filter((p) => p.status === 'todo').length,
      doing: plans.filter((p) => p.status === 'doing').length,
      done: plans.filter((p) => p.status === 'done').length,
      paused: plans.filter((p) => p.status === 'paused').length,
    },
    blogCounts: {
      total: blogs.length,
      draft: blogs.filter((b) => b.status === 'draft').length,
      published: blogs.filter((b) => b.status === 'published').length,
      archived: blogs.filter((b) => b.status === 'archived').length,
    },
    itemCounts: {
      total: items.length,
      done: items.filter((i) => i.checked).length,
    },
    overallProgress,
    weeklyNew: { plans: weeklyNewPlans, blogs: weeklyNewBlogs },
  };
}