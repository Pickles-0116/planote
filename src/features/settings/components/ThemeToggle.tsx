/**
 * ThemeToggle - 主题切换胶囊（add-settings-and-shell）
 *
 * 视觉：3 选项胶囊（跟随系统 / 浅色 / 深色），选中态浅色底 + 阴影
 * 交互：调 useTheme().setTheme(t) → useUIStore.setTheme → persist
 *
 * 场景：
 * - Settings/ThemeSettings 区块主控件
 * - Header 主题入口（v1.0 简化：直接展示 + 跳转 /settings#theme）
 */

import { Monitor, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '@/stores/uiStore';

interface Option {
  value: Theme;
  label: string;
  Icon: typeof Monitor;
}

const OPTIONS: Option[] = [
  { value: 'system', label: '跟随系统', Icon: Monitor },
  { value: 'light', label: '浅色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
];

export default function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="主题切换"
      className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl w-full max-w-md"
    >
      {OPTIONS.map((opt) => {
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition',
              isActive
                ? 'bg-white dark:bg-stone-700 shadow-sm font-medium text-brand-900 dark:text-stone-100'
                : 'text-brand-500 hover:text-brand-900 dark:hover:text-stone-100',
            )}
          >
            <opt.Icon size={14} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
