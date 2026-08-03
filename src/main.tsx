import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { db } from '@/db';
import { seedIfNeeded, ensureFolders } from '@/db/seed';
import { reconcileTags } from '@/db/reconcileTags';
import { migrateAllToTemplates } from '@/features/templates/hooks/migratePresets';
import { ErrorBoundary } from '@/components/shell/ErrorBoundary';
import { getSyncConfig } from '@/db/sync';
import { GitHubBackend, SyncEngine } from '@/sync';
import './styles/globals.css';

/**
 * 种子数据 + v1.4 统一迁移（fire-and-forget）
 *
 * 1. seedIfNeeded：首次启动写入 4 套 Dexie Framework（v1.0 逻辑，保留兼容）
 * 2. migrateAllToTemplates：v1.4 一站式迁移
 *    - 10 个 Preset → BlogTemplate
 *    - 4 个 Dexie Framework → BlogTemplate
 *    - Blog.frameworkId → Blog.templateId
 *    - Blog.tagIds 字符串 → Tag ID
 *
 * 不 await：主流程不等待迁移完成（idempotent，重复启动安全）。
 */
seedIfNeeded(db).catch((err) => {
  console.error('[seed] failed to seed built-in frameworks:', err);
});

ensureFolders(db).catch((err) => {
  console.error('[seed] failed to ensure folders:', err);
});

reconcileTags(db).catch((err) => {
  console.error('[reconcile] tag reconciliation failed:', err);
});

migrateAllToTemplates().catch((err) => {
  console.error('[migrate] v1.4 migration failed:', err);
});

/* ============================================================
 * T4.8 启动时接入同步引擎（M4 云同步）
 *
 * 读取同步配置，若配置完整则创建 SyncEngine 实例并启动自动同步。
 * 不阻塞主流程：fire-and-forget，即使失败也不影响应用启动。
 * ============================================================ */
getSyncConfig(db).then((config) => {
  if (!config.enabled || !config.repo || !config.token) {
    return; // 配置未就绪，不启动
  }
  const backend = new GitHubBackend(config);
  const engine = new SyncEngine(db, backend);
  engine.startAutoSync();
}).catch((err) => {
  console.error('[sync] failed to initialize sync engine:', err);
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
