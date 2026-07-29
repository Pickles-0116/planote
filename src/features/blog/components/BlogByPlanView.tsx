/**
 * BlogByPlanView - 博客按计划分组视图
 *
 * v1.4-Organize F5.1：将博客按关联的计划分组展示。
 * - 有关联计划的博客归入对应计划组
 * - 无关联计划的博客归入「独立博客」组
 * - 每组显示计划标题 + 博客数量
 * - 计划组内博客用紧凑卡片展示
 */

import { Link } from 'react-router-dom';
import { Calendar, FileText } from 'lucide-react';
import { usePlans } from '@/stores';
import { cn } from '@/lib/utils';
import type { Blog, Plan } from '@/types/domain';
import { formatRelativeTime } from '@/features/blog/utils/formatRelativeTime';

interface BlogByPlanViewProps {
  blogs: Blog[];
}

interface PlanGroup {
  plan: Plan | null; // null = 独立博客组
  blogs: Blog[];
}

const STATUS_CLS: Record<string, string> = {
  draft: 'text-stone-600 bg-stone-100',
  published: 'text-emerald-700 bg-emerald-50',
  archived: 'text-amber-700 bg-amber-50',
};

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

function buildGroups(blogs: Blog[], plans: Plan[] | undefined): PlanGroup[] {
  const planMap = new Map(plans?.map((p) => [p.id, p]) ?? []);
  const groups = new Map<string, PlanGroup>();

  for (const blog of blogs) {
    const planId = blog.sourcePlanId;
    if (planId && planMap.has(planId)) {
      if (!groups.has(planId)) {
        groups.set(planId, { plan: planMap.get(planId)!, blogs: [] });
      }
      groups.get(planId)!.blogs.push(blog);
    } else {
      if (!groups.has('__independent')) {
        groups.set('__independent', { plan: null, blogs: [] });
      }
      groups.get('__independent')!.blogs.push(blog);
    }
  }

  // 按计划标题排序，独立博客组排最后
  const result = Array.from(groups.values());
  result.sort((a, b) => {
    if (!a.plan) return 1;
    if (!b.plan) return -1;
    return a.plan.title.localeCompare(b.plan.title);
  });
  return result;
}

export default function BlogByPlanView({ blogs }: BlogByPlanViewProps) {
  const plans = usePlans();
  const groups = buildGroups(blogs, plans);

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-brand-500 dark:text-stone-400">
        暂无博客数据
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const key = group.plan?.id ?? '__independent';
        return (
          <section key={key} className="animate-fadeUp">
            {/* 组标题 */}
            <div className="flex items-center gap-2 mb-3">
              {group.plan ? (
                <Link
                  to={`/plans/${group.plan.id}`}
                  className="flex items-center gap-2 text-sm font-semibold text-brand-900 dark:text-stone-100 hover:text-brand-700 transition"
                >
                  <Calendar size={14} />
                  {group.plan.title}
                  <span className="text-[10px] font-normal text-brand-400 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded">
                    {group.plan.progress}%
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-2 text-sm font-semibold text-brand-500 dark:text-stone-400">
                  <FileText size={14} />
                  独立博客
                </span>
              )}
              <span className="text-[10px] text-brand-400">
                {group.blogs.length} 篇
              </span>
            </div>

            {/* 博客列表 */}
            <div className="space-y-1.5">
              {group.blogs.map((blog) => (
                <Link
                  key={blog.id}
                  to={`/blogs/${blog.id}`}
                  className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-brand-300 hover:shadow-sm transition"
                >
                  <FileText size={14} className="text-brand-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-brand-900 dark:text-stone-100 truncate flex-1 min-w-0">
                    {blog.title}
                  </span>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0', STATUS_CLS[blog.status] ?? '')}>
                    {STATUS_LABEL[blog.status] ?? blog.status}
                  </span>
                  <span className="text-[10px] text-brand-400 flex-shrink-0 w-16 text-right">
                    {formatRelativeTime(blog.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
