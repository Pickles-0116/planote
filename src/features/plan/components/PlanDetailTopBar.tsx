/**
 * PlanDetailTopBar - 计划详情页顶栏
 *
 * 视觉（与 prototype plan-detail.html header 对齐）：
 * - 左侧 breadcrumb：计划 / 当前标题
 * - 右侧：「编辑」按钮（占位跳 /plans/:id/edit）
 *
 * 复用 add-plan-list-view 的 LEVEL_BG / TIME_DIM_LABEL / STATUS_LABEL 视觉模式
 * （不重新定义 badge 颜色，保持列表 / 详情视觉一致）。
 */

import { Link } from 'react-router-dom';
import { ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Plan, PlanLevel, PlanStatus, PlanTimeDim } from '@/types/domain';

const LEVEL_BG: Record<PlanLevel, string> = {
  short: 'bg-emerald-50 text-emerald-600',
  mid: 'bg-blue-50 text-blue-600',
  long: 'bg-purple-50 text-purple-600',
};

const LEVEL_LABEL: Record<PlanLevel, string> = {
  short: '短期',
  mid: '中期',
  long: '长期',
};

const TIME_DIM_LABEL: Record<PlanTimeDim, string> = {
  daily: '每日',
  monthly: '每月',
  yearly: '每年',
  once: '一次性',
};

const STATUS_LABEL: Record<PlanStatus, string> = {
  todo: '未开始',
  doing: '进行中',
  done: '已完成',
  paused: '已搁置',
};

const STATUS_CLS: Record<PlanStatus, string> = {
  todo: 'text-stone-600 bg-stone-100',
  doing: 'text-blue-700 bg-blue-50',
  done: 'text-emerald-700 bg-emerald-50',
  paused: 'text-stone-500 bg-stone-50',
};

interface Props {
  plan: Plan;
}

export default function PlanDetailTopBar({ plan }: Props) {
  return (
    <div className="flex items-center gap-3 mb-6 animate-fadeUp">
      {/* breadcrumb */}
      <nav className="flex items-center gap-2 text-sm flex-1 min-w-0">
        <Link
          to="/plans"
          className="text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 transition flex-shrink-0"
        >
          计划
        </Link>
        <ChevronRight className="text-brand-300 dark:text-stone-600 flex-shrink-0" size={12} />
        <span className="text-brand-900 dark:text-stone-100 font-medium truncate">{plan.title}</span>
      </nav>

      {/* badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded',
            LEVEL_BG[plan.level],
          )}
        >
          {LEVEL_LABEL[plan.level]}
        </span>
        <span className="text-[10px] text-brand-500 dark:text-stone-400 font-semibold bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded">
          {TIME_DIM_LABEL[plan.timeDim]}
        </span>
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded',
            STATUS_CLS[plan.status],
          )}
        >
          {STATUS_LABEL[plan.status]}
        </span>
      </div>

      {/* 编辑按钮（占位跳 /plans/:id/edit，add-plan-edit-form 接手） */}
      <Link
        to={`/plans/${plan.id}/edit`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition flex-shrink-0"
      >
        <Pencil size={12} />
        编辑
      </Link>
    </div>
  );
}
