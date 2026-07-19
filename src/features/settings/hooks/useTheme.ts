/**
 * useTheme - 主题解析 + 应用 hook（add-settings-and-shell）
 *
 * 行为：
 * - 读 useUIStore.theme（期望主题：'system' | 'light' | 'dark'）
 * - 监听 prefers-color-scheme media query（仅 system 模式有意义）
 * - 计算 resolvedTheme（'light' | 'dark'，实际生效）
 * - 同步应用 documentElement.dark class
 *
 * 返回：{ theme, resolvedTheme, setTheme }
 *
 * 不在 hook 范围：
 * - FOUC 防御（main.tsx 顶层内联 init）
 * - persist 持久化（useUIStore 自带）
 */

import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { Theme } from '@/stores/uiStore';

export type ResolvedTheme = 'light' | 'dark';

/** 初始值服务端 / 客户端安全（SSR 不可用兜底 false）。 */
function getInitialSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export interface UseThemeResult {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeResult {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const [systemDark, setSystemDark] = useState<boolean>(getInitialSystemDark);

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => {
      setSystemDark(e.matches);
    };
    // addEventListener / removeEventListener 是新 API；旧 Safari 用 addListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') return systemDark ? 'dark' : 'light';
    return theme;
  }, [theme, systemDark]);

  // 应用 class
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  return { theme, resolvedTheme, setTheme };
}
