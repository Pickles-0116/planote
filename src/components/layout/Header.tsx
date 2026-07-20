import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/features/settings/hooks/useTheme';
import { cn } from '@/lib/utils';

/** 当前 resolvedTheme 图标 + 文字。 */
function ResolvedBadge(): JSX.Element {
  const { theme, resolvedTheme } = useTheme();
  if (theme === 'system') {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-brand-500 dark:text-stone-400">
        <Monitor size={11} />
        自动
      </span>
    );
  }
  return (
    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-brand-500 dark:text-stone-400">
      {resolvedTheme === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
      {resolvedTheme === 'dark' ? '深色' : '浅色'}
    </span>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-16 bg-white/80 dark:bg-stone-900/80 glass border-b border-stone-200 dark:border-stone-700 flex items-center px-8 gap-4">
      {/* 占位（保持布局对齐，后续可放面包屑或项目名） */}
      <div className="flex-1" />

      {/* 主题入口（v1.0 简化：3 选项下拉） */}
      <div
        className="inline-flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl p-0.5 gap-0.5"
        role="radiogroup"
        aria-label="主题切换"
      >
        {(['system', 'light', 'dark'] as const).map((t) => {
          const isActive = theme === t;
          const Icon = t === 'system' ? Monitor : t === 'light' ? Sun : Moon;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(t)}
              title={t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition',
                isActive
                  ? 'bg-white dark:bg-stone-700 text-brand-900 dark:text-stone-100 shadow-sm'
                  : 'text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100',
              )}
            >
              <Icon size={14} />
            </button>
          );
        })}
        <ResolvedBadge />
      </div>

      {/* 设置入口（深链跳到主题） */}
      <button
        type="button"
        onClick={() => navigate('/settings#theme')}
        className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-brand-500 dark:text-stone-400"
        title="设置"
        aria-label="设置"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  );
}
