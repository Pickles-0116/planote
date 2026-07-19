/**
 * ErrorBoundary - 根级错误边界（class 组件）
 *
 * 用途：捕获子组件树渲染期错误，降级到错误 UI 而非白屏。
 * React 16+ 唯一支持 componentDidCatch + getDerivedStateFromError 的方式是 class 组件
 * （React 19 稳定 ErrorBoundary hook 后可切换为函数式 + hook，本 change 保持 class）。
 *
 * 集成位置：main.tsx 顶层包裹整个应用。
 *
 * a11y：
 * - 默认 fallback role="alert"，屏幕阅读器立即播报错误
 * - 重试按钮用普通 button，焦点状态由 Tailwind :focus-visible 提供
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** 自定义降级 UI（可选） */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // v1.1 接入 Sentry 时在此上报
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  /** 重置错误状态，重新渲染子组件 */
  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

/* ============================================================
 * 默认降级 UI
 *
 * 与 ErrorBoundary 同文件：避免拆为多文件带来的导入噪音；
 * react-refresh HMR 对 class + inner function 混用会告警，本组件文件显式忽略。
 * ============================================================ */

interface FallbackProps {
  error: Error;
  onReset: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
function DefaultErrorFallback({ error, onReset }: FallbackProps) {
  const isDev = import.meta.env.DEV;

  const handleHome = (): void => {
    window.location.href = '/';
  };

  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-900 px-4"
    >
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-card p-8 max-w-md w-full text-center animate-fadeUp">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="text-red-500" size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100 mb-2">
          出了点问题
        </h1>
        <p className="text-sm text-brand-500 dark:text-stone-400 mb-6">
          {isDev
            ? '应用遇到意外错误（开发环境显示详情）'
            : '应用遇到意外错误，请稍后重试'}
        </p>
        {isDev && (
          <pre className="text-left text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-6 overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm"
          >
            <RefreshCw size={14} />
            重试
          </button>
          <button
            onClick={handleHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-brand-900 dark:text-stone-100 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-600 transition"
          >
            <Home size={14} />
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}
