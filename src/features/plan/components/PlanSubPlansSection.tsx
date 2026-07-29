/**
 * PlanSubPlansSection - 计划详情页子计划区
 *
 * v1.4-Organize F4.2：在 PlanDetail 右侧栏展示子计划列表。
 * - 从 plan.childPlanIds 读取子计划 ID
 * - 使用 usePlan(id) 逐个订阅子计划数据
 * - 点击子计划导航到对应详情页
 * - 显示子计划进度 + 状态
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePlan } from '@/stores';
import { cn } from '@/lib/utils';
import type { ID } from '@/types/domain';

interface PlanSubPlansSectionProps {
  childPlanIds: ID[];
}

const STATUS_LABEL: Record<string, string> = {
  todo: '未开始',
  doing: '进行中',
  done: '已完成',
  paused: '已搁置',
};

const STATUS_CLS: Record<string, string> = {
  todo: 'text-stone-600 bg-stone-100',
  doing: 'text-blue-700 bg-blue-50',
  done: 'text-emerald-700 bg-emerald-50',
  paused: 'text-stone-500 bg-stone-50',
};

function SubPlanItem({ planId }: { planId: ID }) {
  const plan = usePlan(planId);
  if (!plan) return null;

  return (
    <Link
      to={`/plans/${plan.id}`}
      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-brand-900 dark:text-stone-100 truncate">
          {plan.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', STATUS_CLS[plan.status] ?? '')}>
            {STATUS_LABEL[plan.status] ?? plan.status}
          </span>
          <span className="text-[10px] text-brand-400">{plan.progress}%</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-brand-400 flex-shrink-0" />
    </Link>
  );
}

export default function PlanSubPlansSection({ childPlanIds }: PlanSubPlansSectionProps) {
  if (childPlanIds.length === 0) return null;

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4 mt-4">
      <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100 mb-2">
        子计划 ({childPlanIds.length})
      </h3>
      <div className="space-y-0.5">
        {childPlanIds.map((id) => (
          <SubPlanItem key={id} planId={id} />
        ))}
      </div>
    </div>
  );
}
