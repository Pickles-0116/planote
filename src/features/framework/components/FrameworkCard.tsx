/**
 * FrameworkCard - 单个预置框架卡片（add-framework-drawer 增量）
 *
 * props：
 * - framework: PresetFramework
 * - isSelected: 是否选中
 * - onClick: 点击回调
 *
 * 视觉：
 * - icon + name + description + sections 预览（截前 5 条）+ tag chips
 * - 选中态：border-2 border-accent-300 + bg-accent-50/30 + 右侧 Check 图标
 * - a11y：role="button" aria-pressed
 */

import {
  CalendarDays,
  GitPullRequest,
  BookOpen,
  BarChart3,
  Target,
  CalendarRange,
  Repeat,
  GitBranch,
  GraduationCap,
  Search,
  RotateCcw,
  Sparkles,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PresetFramework } from '@/features/framework/data/presets';

interface Props {
  framework: PresetFramework;
  isSelected: boolean;
  onClick: () => void;
  /** 是否已应用到当前 Blog（用于显示已应用对勾）。 */
  isApplied?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  CalendarDays,
  GitPullRequest,
  BookOpen,
  BarChart3,
  Target,
  CalendarRange,
  Repeat,
  GitBranch,
  GraduationCap,
  Search,
  RotateCcw,
};

export default function FrameworkCard({
  framework,
  isSelected,
  onClick,
  isApplied = false,
}: Props): JSX.Element {
  const Icon = ICON_MAP[framework.icon] ?? Sparkles;
  return (
    <button
      type="button"
      onClick={onClick}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${framework.name}：${framework.description}`}
      className={cn(
        'w-full text-left rounded-xl p-4 transition relative',
        'focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
        isSelected
          ? 'border-2 border-accent-300 bg-accent-50/30'
          : 'border border-stone-200 hover:border-brand-300',
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
              isSelected ? 'bg-accent-500 text-white' : 'bg-stone-100 text-brand-600',
            )}
          >
            <Icon size={14} />
          </div>
          <span className="text-sm font-semibold">{framework.name}</span>
          {isApplied && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-100 text-emerald-700"
              title="已应用到当前博客"
            >
              已应用
            </span>
          )}
        </div>
        {isSelected && <Check className="text-accent-500 flex-shrink-0" size={16} />}
      </div>
      <div className="text-xs text-brand-400 mb-3">{framework.description}</div>
      <div className="space-y-1 text-xs text-brand-600 mb-3">
        {framework.sections.slice(0, 5).map((s) => (
          <div key={s.heading} className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-stone-300 flex-shrink-0" />
            <span className="line-clamp-1">{s.heading}</span>
          </div>
        ))}
      </div>
      {framework.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {framework.tags.map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 text-[10px] rounded-md bg-stone-100 text-brand-500"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
