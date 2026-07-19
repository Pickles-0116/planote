/**
 * ToastViewport - 全局 toast 渲染器（add-blog-attachment 增量）
 *
 * 行为：
 * - 订阅 useToastStore.toasts
 * - 右下角堆叠；最多 3 条同时显示
 * - 3 秒后自动 dismiss（store 内部 setTimeout）
 * - 颜色：error=red, info=blue, success=emerald
 * - 手动关闭：右侧「×」按钮
 *
 * a11y：
 * - role="status" aria-live="polite"（info / success 屏幕阅读器不打断）
 * - error 用 role="alert" + aria-live="assertive"（立即播报）
 * - 关闭按钮 aria-label
 *
 * 位置与 z-index：
 * - fixed bottom-4 right-4
 * - z-60（高于 Drawer 的 z-50，避免被遮罩盖住）
 * - 容器 pointer-events-none + 单 toast pointer-events-auto（背景可点击）
 */

import { X, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, TOAST_MAX_VISIBLE } from '@/stores/toastStore';
import type { Toast, ToastKind } from '@/stores/toastStore';

const ICON_MAP: Record<ToastKind, LucideIcon> = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
};

const KIND_STYLES: Record<ToastKind, string> = {
  error: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

function ToastItem({ toast }: { toast: Toast }): JSX.Element {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICON_MAP[toast.kind];
  const isError = toast.kind === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex items-center gap-2.5 pl-3 pr-2 py-2.5',
        'rounded-xl border shadow-md min-w-[260px] max-w-[420px]',
        'animate-fadeUp',
        KIND_STYLES[toast.kind],
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="text-sm flex-1 min-w-0 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="关闭通知"
        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/5 flex-shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ToastViewport(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  // 超出容量时只渲染前 N 条（store 内部不排队；视觉截断即可）
  const visible = toasts.slice(-TOAST_MAX_VISIBLE);
  return (
    <div
      aria-label="通知"
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      {visible.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
