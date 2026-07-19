/**
 * Step2TypeDim - 步骤 2：类型 + 维度选择
 *
 * 字段（spec §「类型 + 维度选择」）：
 * - level：3 卡片单选（短/中/长期）
 * - timeDim：4 卡片单选（每日/每月/每年/一次性）
 *
 * 视觉（与 prototype plan-edit.html 步骤 2 对齐）：
 * - level：3 张大卡 + 副标题
 * - timeDim：4 张大卡 + icon
 * - 选中态：蓝色 border + 浅蓝背景 + 右上 check
 * - 再次点击取消选择
 *
 * Props:
 * - level, timeDim: 当前值
 * - onChange: ({ level?, timeDim? }) => void
 */

import { Flag, Target, Mountain, Sun, CalendarDays, Calendar, Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanLevel, PlanTimeDim } from '@/types/domain';

interface Props {
  level: PlanLevel | null;
  timeDim: PlanTimeDim | null;
  onChange: (patch: { level?: PlanLevel | null; timeDim?: PlanTimeDim | null }) => void;
}

const LEVEL_OPTIONS: Array<{
  value: PlanLevel;
  label: string;
  desc: string;
  icon: typeof Flag;
  color: string;
  border: string;
  bg: string;
}> = [
  {
    value: 'short',
    label: '短期目标',
    desc: '1-4 周可完成',
    icon: Flag,
    color: 'text-emerald-600',
    border: 'border-emerald-500',
    bg: 'bg-emerald-50/30',
  },
  {
    value: 'mid',
    label: '中期计划',
    desc: '1-6 个月的规划',
    icon: Target,
    color: 'text-blue-600',
    border: 'border-blue-500',
    bg: 'bg-blue-50/30',
  },
  {
    value: 'long',
    label: '长期规划',
    desc: '1-3 年的愿景',
    icon: Mountain,
    color: 'text-purple-600',
    border: 'border-purple-500',
    bg: 'bg-purple-50/30',
  },
];

const TIME_DIM_OPTIONS: Array<{
  value: PlanTimeDim;
  label: string;
  icon: typeof Sun;
  color: string;
  border: string;
  bg: string;
}> = [
  {
    value: 'daily',
    label: '每日',
    icon: Sun,
    color: 'text-amber-500',
    border: 'border-emerald-500',
    bg: 'bg-emerald-50/30',
  },
  {
    value: 'monthly',
    label: '每月',
    icon: CalendarDays,
    color: 'text-blue-600',
    border: 'border-blue-500',
    bg: 'bg-blue-50/30',
  },
  {
    value: 'yearly',
    label: '每年',
    icon: Calendar,
    color: 'text-purple-600',
    border: 'border-purple-500',
    bg: 'bg-purple-50/30',
  },
  {
    value: 'once',
    label: '一次性',
    icon: Zap,
    color: 'text-amber-600',
    border: 'border-amber-500',
    bg: 'bg-amber-50/30',
  },
];

export default function Step2TypeDim({ level, timeDim, onChange }: Props) {
  const handleLevelClick = (v: PlanLevel) => {
    onChange({ level: level === v ? null : v });
  };
  const handleDimClick = (v: PlanTimeDim) => {
    onChange({ timeDim: timeDim === v ? null : v });
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-6 mb-6 animate-fadeUp">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-brand-900 text-white text-xs flex items-center justify-center font-bold">
          2
        </span>
        选择类型与时间维度
      </h2>

      {/* 层级 */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-brand-700 block mb-2">
          层级
        </label>
        <div className="grid grid-cols-3 gap-3">
          {LEVEL_OPTIONS.map((opt) => {
            const isSelected = level === opt.value;
            const Icon = opt.icon;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => handleLevelClick(opt.value)}
                aria-pressed={isSelected}
                className={cn(
                  'relative p-4 rounded-xl border-2 transition text-left',
                  isSelected
                    ? `${opt.border} ${opt.bg}`
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
                )}
              >
                {isSelected && (
                  <div
                    className={cn(
                      'absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center',
                      opt.border.replace('border-', 'bg-'),
                    )}
                  >
                    <Check className="text-white" size={8} strokeWidth={3} />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={opt.color} size={14} />
                  <span className="font-semibold text-sm">{opt.label}</span>
                </div>
                <div className="text-xs text-brand-400">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 时间维度 */}
      <div>
        <label className="text-xs font-semibold text-brand-700 block mb-2">
          时间维度
        </label>
        <div className="grid grid-cols-4 gap-3">
          {TIME_DIM_OPTIONS.map((opt) => {
            const isSelected = timeDim === opt.value;
            const Icon = opt.icon;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => handleDimClick(opt.value)}
                aria-pressed={isSelected}
                className={cn(
                  'relative p-3 rounded-xl border-2 transition text-center',
                  isSelected
                    ? `${opt.border} ${opt.bg}`
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
                )}
              >
                {isSelected && (
                  <div
                    className={cn(
                      'absolute top-1.5 right-1.5 w-3 h-3 rounded-full flex items-center justify-center',
                      opt.border.replace('border-', 'bg-'),
                    )}
                  >
                    <Check className="text-white" size={7} strokeWidth={3} />
                  </div>
                )}
                <Icon className={cn(opt.color, 'mb-1 mx-auto')} size={16} />
                <div className="font-semibold text-sm">{opt.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
