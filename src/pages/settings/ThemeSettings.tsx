/**
 * ThemeSettings - 主题设置区块（add-settings-and-shell）
 *
 * 内容：
 * - 标题 + 描述
 * - <ThemeToggle /> 3 选项胶囊
 * - 当前 resolvedTheme 显示（视觉确认）
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import ThemeToggle from '@/features/settings/components/ThemeToggle';
import { useTheme } from '@/features/settings/hooks/useTheme';

const RESOLVED_LABEL: Record<'light' | 'dark', { label: string; Icon: typeof Sun }> = {
  light: { label: '当前生效：浅色', Icon: Sun },
  dark: { label: '当前生效：深色', Icon: Moon },
};

export default function ThemeSettings(): JSX.Element {
  const { theme, resolvedTheme } = useTheme();
  const { label, Icon } =
    theme === 'system'
      ? { label: '当前生效：跟随系统（' + (resolvedTheme === 'dark' ? '深色' : '浅色') + '）', Icon: Monitor }
      : RESOLVED_LABEL[resolvedTheme];

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-brand-900 dark:text-stone-100">主题</h2>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          切换浅色 / 深色，或跟随系统自动切换。设置会立即生效并保存。
        </p>
      </header>

      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
        <ThemeToggle />

        <div className="flex items-center gap-2 text-sm text-brand-500 dark:text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-700">
          <Icon size={14} className="text-brand-700 dark:text-stone-300" />
          <span>{label}</span>
        </div>
      </div>
    </section>
  );
}
