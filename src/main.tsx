import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { db } from '@/db';
import { seedIfNeeded } from '@/db/seed';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';
import './styles/globals.css';

/**
 * 种子数据接入点（fire-and-forget）
 *
 * 选择 main.tsx 顶层而非 App.tsx useEffect：
 * - 早启动：IndexedDB 写入与 React 渲染并行，不互相阻塞
 * - 错误隔离：seed 失败不影响首屏渲染（用户看到空框架抽屉，但能继续操作）
 * - 后续 add-zustand-stores change 接管此逻辑时，本处可整体替换
 *
 * 不 await：主流程不等待种子完成（idempotent，重复启动安全）。
 */
seedIfNeeded(db).catch((err) => {
  // 种子失败仅记录，不抛错阻塞 UI
  console.error('[seed] failed to seed built-in frameworks:', err);
});

/* ============================================================
 * FOUC 防御：dark mode 内联初始化（add-settings-and-shell）
 *
 * 为什么放在 main.tsx 顶层（React 渲染前）：
 * - useEffect 在 React 渲染后执行，必有闪屏
 * - 同步代码在 createRoot 之前 → 无闪屏
 * - localStorage 读取 < 1ms，性能可忽略
 * ============================================================ */
(function applyInitialTheme() {
  if (typeof document === 'undefined') return;
  try {
    const stored = localStorage.getItem('planote-ui');
    let initialTheme: 'system' | 'light' | 'dark' = 'system';
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { theme?: string } };
      const t = parsed?.state?.theme;
      if (t === 'system' || t === 'light' || t === 'dark') {
        initialTheme = t;
      }
    }
    const systemDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedDark =
      initialTheme === 'dark' ||
      (initialTheme === 'system' && systemDark);
    document.documentElement.classList.toggle('dark', resolvedDark);
  } catch {
    // localStorage 损坏 / 解析失败 → 默认 light
    document.documentElement.classList.remove('dark');
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      ErrorBoundary 包裹在 BrowserRouter 之外：
      - 捕获路由层 / 应用层任何渲染错误
      - 避免单个组件抛错导致整页白屏
      - v1.1 可在 Sentry 接入时改为在 componentDidCatch 上报
    */}
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
