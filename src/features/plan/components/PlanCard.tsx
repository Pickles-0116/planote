/**
 * PlanCard - 计划卡片（3 视图共用，3 种密度）
 *
 * density 取值：
 * - 'full'      分组视图大卡：标题 + 描述（line-clamp-2）+ 进度条 + 标签 + 起止 + 状态
 * - 'compact'   全部视图紧凑行：单行 + 进度环（24px）+ 标题 + 紧急度 tag + 进度百分比
 * - 'table-row' 表格视图行单元格（6 列由父级 PlanTable 渲染）
 *
 * 紧急度左边框：red/orange/yellow/none → 4px 左边框
 * 状态视觉：done → 绿色光晕 + "已完成" badge（spec 强调 100% 完成的 CTA 入口）
 *
 * 复用：data-searchable 属性便于父级 [data-search] 一次性过滤。
 */

import { Link } from 'react-router-dom';
import { Sparkles, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Plan, PlanLevel, PlanStatus, UrgencyLevel } from '@/types/domain';

export type PlanCardDensity = 'full' | 'compact' | 'table-row';

interface Props {
  plan: Plan;
  density?: PlanCardDensity;
  /** 表格视图列头点击的「选中行」高亮（仅 density='table-row' 用） */
  selected?: boolean;
}

const URGENCY_BORDER: Record<UrgencyLevel, string> = {
  red: 'border-l-red-500',
  orange: 'border-l-orange-500',
  yellow: 'border-l-amber-500',
  none: 'border-l-stone-200',
};

const URGENCY_TEXT: Record<UrgencyLevel, string> = {
  red: 'text-red-600',
  orange: 'text-orange-600',
  yellow: 'text-amber-600',
  none: 'text-brand-500',
};

const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  red: '今天截止',
  orange: '1-3 天',
  yellow: '4-7 天',
  none: '未来',
};

const URGENCY_DOT: Record<UrgencyLevel, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-amber-500',
  none: 'bg-stone-300',
};

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

const TIME_DIM_LABEL: Record<Plan['timeDim'], string> = {
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

/**
 * 进度条（横向条形，1.5px 高）。
 */
function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'urgency' }) {
  const fill =
    tone === 'urgency' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-stone-700';
  return (
    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full', fill)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/**
 * 紧凑进度环（24px SVG circle + stroke-dasharray）。
 */
function ProgressRing({ value }: { value: number }) {
  const R = 10;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, value));
  const offset = C * (1 - pct / 100);
  return (
    <div className="relative w-6 h-6 flex-shrink-0">
      <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
        <circle cx="12" cy="12" r={R} fill="none" stroke="#e7e5e4" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r={R}
          fill="none"
          stroke="#0f172a"
          strokeWidth="3"
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-brand-900">
        {pct}
      </span>
    </div>
  );
}

/**
 * 起止日期文案（与 prototype 一致）。
 * - 无起止：返回 null
 * - 无 endDate：仅显示 startDate
 * - 距 endDate ≤ 0：显示 "今天" / 红色
 */
function formatEnd(endDate?: string): { text: string; isUrgent: boolean } | null {
  if (!endDate) return null;
  const now = Date.now();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
  if (days <= 0) return { text: '今天', isUrgent: true };
  if (days === 1) return { text: '明天', isUrgent: true };
  if (days <= 7) return { text: `${days} 天后`, isUrgent: days <= 3 };
  // 大于 7 天：直接显示 ISO 日期
  return { text: endDate.slice(0, 10), isUrgent: false };
}

export default function PlanCard({ plan, density = 'full', selected = false }: Props) {
  const urgency = plan.urgency;
  const isComplete = plan.status === 'done' || plan.progress >= 100;

  if (density === 'compact') {
    const endInfo = formatEnd(plan.endDate);
    return (
      <Link
        to={`/plans/${plan.id}`}
        data-searchable
        className={cn(
          'flex items-center gap-3 bg-white rounded-xl p-3 border border-stone-200 hover:border-brand-300 hover:shadow-sm transition',
          selected && 'bg-accent-50/30 border-accent-200',
        )}
      >
        <div className={cn('w-1 h-10 rounded-full flex-shrink-0', URGENCY_DOT[urgency])} />
        <ProgressRing value={plan.progress} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{plan.title}</div>
          <div className="text-[10px] text-brand-400">
            {LEVEL_LABEL[plan.level]} · {TIME_DIM_LABEL[plan.timeDim]}
          </div>
        </div>
        {endInfo && (
          <div className={cn('text-xs font-semibold w-16 text-right', endInfo.isUrgent ? URGENCY_TEXT[urgency] : 'text-brand-500')}>
            {endInfo.text}
          </div>
        )}
        <div className="w-20 text-right">
          <div className="text-[10px] text-brand-400 mb-0.5">{plan.progress}%</div>
          <ProgressBar value={plan.progress} tone="urgency" />
        </div>
      </Link>
    );
  }

  if (density === 'table-row') {
    return null; // 表格行由 PlanTable 渲染，这里仅占位
  }

  // density === 'full'（默认）
  const endInfo = formatEnd(plan.endDate);
  return (
    <Link
      to={`/plans/${plan.id}`}
      data-searchable
      className={cn(
        'relative block bg-white rounded-2xl p-5 border-l-4 border border-stone-200 hover:border-brand-300 hover:shadow-md transition group',
        URGENCY_BORDER[urgency],
        isComplete && 'bg-emerald-50/30 border-emerald-200',
      )}
    >
      <div className="flex items-start gap-4">
        {/* 左侧图标方块（按紧急度变色） */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white',
            urgency === 'red' && 'bg-gradient-to-br from-red-500 to-red-700',
            urgency === 'orange' && 'bg-gradient-to-br from-orange-500 to-orange-700',
            urgency === 'yellow' && 'bg-gradient-to-br from-amber-500 to-amber-700',
            urgency === 'none' && 'bg-gradient-to-br from-stone-400 to-stone-600',
          )}
        >
          <CalendarDays size={20} />
        </div>

        <div className="flex-1 min-w-0">
          {/* 标签行 */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold group-hover:text-brand-700">{plan.title}</h3>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', LEVEL_BG[plan.level])}>
              {LEVEL_LABEL[plan.level]}
            </span>
            <span className="text-[10px] text-brand-500 font-semibold bg-stone-100 px-1.5 py-0.5 rounded">
              {TIME_DIM_LABEL[plan.timeDim]}
            </span>
            {/* 紧急度标签 */}
            {urgency !== 'none' && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1',
                  urgency === 'red' && 'text-red-700 bg-red-100',
                  urgency === 'orange' && 'text-orange-700 bg-orange-100',
                  urgency === 'yellow' && 'text-amber-700 bg-amber-100',
                )}
              >
                🔥 {URGENCY_LABEL[urgency]}
              </span>
            )}
            {/* 100% 完成徽章 */}
            {isComplete && (
              <span className="absolute top-3 right-4 text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles size={8} />
                可总结
              </span>
            )}
            {/* 状态 badge */}
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded',
                plan.status === 'done' && 'text-emerald-700 bg-emerald-50',
                plan.status === 'doing' && 'text-blue-700 bg-blue-50',
                plan.status === 'todo' && 'text-stone-600 bg-stone-100',
                plan.status === 'paused' && 'text-stone-500 bg-stone-50',
              )}
            >
              {STATUS_LABEL[plan.status]}
            </span>
          </div>

          {/* 描述 */}
          {plan.description && (
            <p className="text-sm text-brand-500 mb-3 line-clamp-2">{plan.description}</p>
          )}

          {/* 进度 + 日期 */}
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between text-[10px] text-brand-400 mb-1">
                <span>
                  {plan.itemIds.length} 个事项 · {plan.progress}%
                </span>
              </div>
              <ProgressBar value={plan.progress} tone="urgency" />
            </div>
            <div className="flex items-center gap-3 text-xs text-brand-400 flex-shrink-0">
              {endInfo && (
                <span className={cn('font-semibold', endInfo.isUrgent ? URGENCY_TEXT[urgency] : 'text-brand-500')}>
                  <CalendarDays size={11} className="inline mr-1" />
                  {endInfo.text}
                </span>
              )}
              {plan.blogIds.length > 0 && (
                <span>📝 {plan.blogIds.length} 篇博客</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
