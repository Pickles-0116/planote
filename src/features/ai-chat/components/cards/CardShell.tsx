/**
 * CardShell · 操作卡片通用壳
 *
 * Header + preview area + 三按钮 footer（确认 / 修改 / 取消）。
 * DataQueryCard 不使用此壳（read-only）。
 *
 * 来源：openspec/changes/ai-chat-intent-routing/design.md 决策 5。
 */

import type { ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardShellProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  onConfirm?: () => void;
  onModify?: () => void;
  onCancel?: () => void;
  /** 隐藏按钮 footer（DataQueryCard 用）。 */
  hideActions?: boolean;
}

export default function CardShell({
  title,
  icon,
  children,
  onConfirm,
  onModify,
  onCancel,
  hideActions,
}: CardShellProps): JSX.Element {
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border border-stone-200 dark:border-stone-600 overflow-hidden',
        'bg-stone-50 dark:bg-stone-700/50',
      )}
    >
      {/* Header */}
      <div className="px-4 py-2.5 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-600 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-brand-900 dark:text-stone-100">{title}</h4>
      </div>

      {/* Preview */}
      <div className="px-4 py-3 text-sm text-brand-900 dark:text-stone-100">
        {children}
      </div>

      {/* Actions */}
      {!hideActions && (
        <div className="px-4 py-2.5 border-t border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 flex gap-2">
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              data-testid="card-confirm"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-xs font-medium transition-colors dark:bg-brand-700 dark:hover:bg-brand-600"
            >
              <Check size={12} />
              确认
            </button>
          )}
          {onModify && (
            <button
              type="button"
              onClick={onModify}
              data-testid="card-modify"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-medium transition-colors"
            >
              <Pencil size={12} />
              修改
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              data-testid="card-cancel"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-500 hover:text-red-600 dark:text-stone-400 dark:hover:text-red-400 text-xs font-medium transition-colors"
            >
              <X size={12} />
              取消
            </button>
          )}
        </div>
      )}
    </div>
  );
}