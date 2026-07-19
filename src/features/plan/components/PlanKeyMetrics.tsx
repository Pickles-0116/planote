/**
 * PlanKeyMetrics - 详情页 Hero 区右侧 5 个只读数据卡
 *
 * 数据点（spec Requirement: 关键数据展示）：
 * 1. 已完成事项 / 总事项
 * 2. 进度百分比
 * 3. 坚持天数（v1.0 简化为 floor((now - createdAt) / 86400e3)）
 * 4. 截止日期 / 剩余天数（复用 PlanCard.formatEnd 工具的等价计算）
 * 5. 关联博客数
 *
 * 视觉：grid-cols-2（与 ProgressRing 共享右侧 1/3 栏）
 * 全部只读——编辑留给 add-plan-edit-form
 */

import {
  CheckCircle2,
  TrendingUp,
  CalendarDays,
  Newspaper,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Plan } from '@/types/domain';
import { daysBetween } from '@/shared/utils/urgency';

interface Props {
  plan: Plan;
  completedItems: number;
  totalItems: number;
}

interface Metric {
  label: string;
  value: string;
  icon: typeof CheckCircle2;
  color: 'emerald' | 'brand' | 'blue' | 'amber';
}

const COLOR_CLS: Record<Metric['color'], { icon: string; value: string }> = {
  emerald: { icon: 'text-emerald-600 bg-emerald-50', value: 'text-emerald-700' },
  brand: { icon: 'text-brand-700 bg-stone-100', value: 'text-brand-900' },
  blue: { icon: 'text-blue-600 bg-blue-50', value: 'text-blue-700' },
  amber: { icon: 'text-amber-600 bg-amber-50', value: 'text-amber-700' },
};

export default function PlanKeyMetrics({ plan, completedItems, totalItems }: Props) {
  // 坚持天数
  const daySpan = Math.max(
    0,
    Math.floor(daysBetween(new Date(plan.createdAt).getTime(), new Date())),
  );

  // 截止 / 剩余
  let endText: string;
  let endColor: Metric['color'] = 'brand';
  if (!plan.endDate) {
    endText = '持续';
  } else {
    const days = daysBetween(Date.now(), plan.endDate);
    if (days <= 0) {
      endText = '今天';
      endColor = 'amber';
    } else if (days === 1) {
      endText = '明天';
      endColor = 'amber';
    } else if (days <= 3) {
      endText = `${days} 天后`;
      endColor = 'amber';
    } else if (days <= 7) {
      endText = `${days} 天后`;
    } else {
      endText = plan.endDate.slice(0, 10);
    }
  }

  const metrics: Metric[] = [
    {
      label: '已完成 / 总事项',
      value: `${completedItems} / ${totalItems}`,
      icon: CheckCircle2,
      color: completedItems === totalItems && totalItems > 0 ? 'emerald' : 'brand',
    },
    {
      label: '进度',
      value: `${plan.progress}%`,
      icon: TrendingUp,
      color: plan.progress >= 100 ? 'emerald' : 'brand',
    },
    {
      label: '坚持天数',
      value: daySpan === 0 ? '今天开始' : `${daySpan} 天`,
      icon: Clock,
      color: 'blue',
    },
    {
      label: '截止',
      value: endText,
      icon: CalendarDays,
      color: endColor,
    },
    {
      label: '关联博客',
      value: `${plan.blogIds.length} 篇`,
      icon: Newspaper,
      color: plan.blogIds.length > 0 ? 'blue' : 'brand',
    },
  ];

  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-5 animate-fadeUp animate-delay-200">
      <h3 className="text-sm font-semibold mb-4">关键数据</h3>
      <div className="space-y-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          const c = COLOR_CLS[m.color];
          return (
            <div key={m.label} className="flex items-center gap-3">
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                  c.icon,
                )}
              >
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-brand-400">{m.label}</div>
                <div className={cn('text-sm font-bold', c.value)}>{m.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
