/**
 * EmptyState - 通用空状态外壳
 *
 * 用途：所有「无数据」场景的视觉外壳（无计划 / 无博客 / 无搜索结果 / 表格内行空等）。
 *
 * 4 种 variant（自上而下尺寸递减）：
 * - illustration (96px / text-2xl) 营销页 / 引导创建
 * - default     (64px / text-xl)   Dashboard 空状态
 * - compact     (40px / text-base) 列表空（PlanList / BlogList）
 * - inline      (32px / text-sm)   表格行内 / 搜索结果
 *
 * 设计原则：
 * - 不带业务依赖：title 文案由调用方传入（不写死「还没有计划」）
 * - icon 必传（LucideIcon 类型），保证视觉一致
 * - action 可选：{ label, onClick, variant: 'primary' | 'secondary' }
 * - 不传 description / action 时不渲染占位空白
 */
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyVariant = 'default' | 'compact' | 'inline' | 'illustration';

interface EmptyStateProps {
  /** Lucide 图标组件；必传以保证视觉一致 */
  icon: LucideIcon;
  /** 主标题 */
  title: string;
  /** 副标题（可选） */
  description?: string;
  /** CTA 按钮（可选） */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  /** 尺寸变体；默认 'default' */
  variant?: EmptyVariant;
}

const VARIANT_STYLES: Record<
  EmptyVariant,
  { iconWrap: string; iconSize: number; title: string; padding: string; gap: string }
> = {
  illustration: {
    iconWrap: 'w-24 h-24 rounded-2xl',
    iconSize: 40,
    title: 'text-2xl',
    padding: 'p-12',
    gap: 'gap-5',
  },
  default: {
    iconWrap: 'w-16 h-16 rounded-2xl',
    iconSize: 28,
    title: 'text-xl',
    padding: 'p-12',
    gap: 'gap-4',
  },
  compact: {
    iconWrap: 'w-10 h-10 rounded-xl',
    iconSize: 18,
    title: 'text-base',
    padding: 'p-6',
    gap: 'gap-3',
  },
  inline: {
    iconWrap: 'w-8 h-8 rounded-lg',
    iconSize: 14,
    title: 'text-sm',
    padding: 'py-6 px-4',
    gap: 'gap-2',
  },
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  const v = VARIANT_STYLES[variant];
  const actionVariant = action?.variant ?? 'primary';

  return (
    <div
      className={cn(
        'bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 text-center flex flex-col items-center animate-fadeUp',
        v.padding,
        v.gap,
      )}
    >
      <div
        className={cn(
          v.iconWrap,
          'bg-stone-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0',
        )}
      >
        <Icon className="text-brand-500 dark:text-stone-400" size={v.iconSize} />
      </div>
      <h2 className={cn('font-bold tracking-tight text-brand-900 dark:text-stone-100', v.title)}>
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'text-brand-500 dark:text-stone-400 max-w-md',
            variant === 'inline' ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm mt-1',
            actionVariant === 'primary'
              ? 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200'
              : 'bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-brand-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-600',
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
