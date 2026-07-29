/**
 * ModeToggle · 引导/自由模式切换按钮
 */

import { Compass, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMode } from '@/types/domain';

interface Props {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: Props): JSX.Element {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 dark:bg-stone-700 p-0.5">
      <button
        type="button"
        onClick={() => onChange('guided')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          mode === 'guided'
            ? 'bg-white dark:bg-stone-600 text-brand-900 dark:text-stone-100 shadow-sm'
            : 'text-stone-500 dark:text-stone-400',
        )}
      >
        <Compass size={11} />
        引导
      </button>
      <button
        type="button"
        onClick={() => onChange('free')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          mode === 'free'
            ? 'bg-white dark:bg-stone-600 text-brand-900 dark:text-stone-100 shadow-sm'
            : 'text-stone-500 dark:text-stone-400',
        )}
      >
        <Zap size={11} />
        自由
      </button>
    </div>
  );
}