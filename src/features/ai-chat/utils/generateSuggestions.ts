/**
 * generateSuggestions · 操作建议生成
 *
 * 来源：openspec/changes/ai-chat-smart-qa/design.md 决策 4。
 */

import { planRepo, blogRepo } from '@/db/repos';
import type { SuggestionData, ID, ISODate } from '@/types/domain';

function isOverdue(endDate: ISODate | undefined, status: string, now: number): boolean {
  if (!endDate || status === 'done') return false;
  return new Date(endDate).getTime() < now;
}

function isStaleDraft(updatedAt: ISODate, now: number, days = 14): boolean {
  const diff = now - new Date(updatedAt).getTime();
  return diff > days * 86_400_000;
}

export async function generateSuggestions(
  type: SuggestionData['type'],
): Promise<SuggestionData> {
  const now = Date.now();

  if (type === 'overdue_plans') {
    const plans = await planRepo.list();
    const overdue = plans.filter((p) => isOverdue(p.endDate, p.status, now));
    return {
      type,
      title: overdue.length === 0 ? '没有过期计划，太棒了！' : `你有 ${overdue.length} 个计划已过期`,
      entityIds: overdue.map((p) => p.id as ID),
    };
  }

  if (type === 'stale_drafts') {
    const blogs = await blogRepo.list({ filter: { status: 'draft' } });
    const stale = blogs.filter((b) => isStaleDraft(b.updatedAt, now));
    return {
      type,
      title: stale.length === 0 ? '没有长期未更新的草稿' : `你有 ${stale.length} 篇草稿超过 2 周没更新`,
      entityIds: stale.map((b) => b.id as ID),
    };
  }

  if (type === 'paused_too_long') {
    const plans = await planRepo.list({ filter: { status: 'paused' } });
    return {
      type,
      title: plans.length === 0 ? '没有搁置的计划' : `你有 ${plans.length} 个计划处于搁置状态`,
      entityIds: plans.map((p) => p.id as ID),
    };
  }

  return { type, title: '未知建议类型', entityIds: [] };
}