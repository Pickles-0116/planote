/**
 * useRecentActivity - 最近活动 section 数据
 *
 * 派生规则（详见 add-data-binding-dashboard/design.md §3.4）：
 * - 合并 plans + blogs
 * - 每条渲染为：彩色圆点 + 描述 + 「X 前」相对时间
 * - 排序：updatedAt desc（稳定排序：同时间按 id asc）
 * - 截取：前 `limit` 条（默认 4）
 *
 * 时间格式化：调用 shared/utils/format.ts 的 formatRelativeTime。
 */

import { useMemo } from 'react';
import { usePlans } from './usePlans';
import { useBlogs } from './useBlogs';
import { formatRelativeTime } from '@/shared/utils/format';
import type { Blog, Plan } from '@/types/domain';

export type ActivityKind =
  | 'plan_done'
  | 'plan_updated'
  | 'blog_published'
  | 'blog_updated';

export interface Activity {
  id: string;
  kind: ActivityKind;
  /** 渲染好的描述文本。 */
  text: string;
  /** 触发时间（ISO）。 */
  time: string;
  /** 「刚刚 / N 分钟前 / 昨天 HH:mm / M月D日」等。 */
  relativeTime: string;
  /** 圆点颜色：emerald | blue | purple | amber。 */
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}

export function useRecentActivity(limit: number = 4): Activity[] | undefined {
  const plans = usePlans();
  const blogs = useBlogs();

  return useMemo<Activity[] | undefined>(() => {
    if (plans === undefined || blogs === undefined) return undefined;
    return pickRecentActivity(plans, blogs, limit);
  }, [plans, blogs, limit]);
}

/** 纯函数，便于单测。 */
export function pickRecentActivity(
  plans: Plan[],
  blogs: Blog[],
  limit: number,
): Activity[] {
  const items: Activity[] = [
    ...plans.map<Activity>((p) => ({
      id: `plan:${p.id}`,
      kind: p.status === 'done' ? 'plan_done' : 'plan_updated',
      text:
        p.status === 'done'
          ? `完成了「${p.title}」`
          : `更新了计划「${p.title}」`,
      time: p.updatedAt,
      relativeTime: formatRelativeTime(p.updatedAt),
      color: p.status === 'done' ? 'emerald' : 'amber',
    })),
    ...blogs.map<Activity>((b) => ({
      id: `blog:${b.id}`,
      kind: b.status === 'published' ? 'blog_published' : 'blog_updated',
      text:
        b.status === 'published'
          ? `发布了博客「${b.title}」`
          : `编辑了博客「${b.title}」`,
      time: b.updatedAt,
      relativeTime: formatRelativeTime(b.updatedAt),
      color: b.status === 'published' ? 'blue' : 'purple',
    })),
  ];

  return items
    .sort((a, b) => {
      if (a.time === b.time) return a.id < b.id ? -1 : 1; // 稳定排序
      return a.time < b.time ? 1 : -1;
    })
    .slice(0, limit);
}
