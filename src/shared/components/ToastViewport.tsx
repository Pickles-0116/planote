/**
 * ToastViewport - 全局 toast 渲染器（add-blog-attachment 增量 + v1.1 batch-import 扩展）
 *
 * 行为：
 * - 订阅 useToastStore.toasts
 * - 右下角堆叠；最多 3 条同时显示
 * - 3 秒后自动 dismiss（store 内部 setTimeout；sticky toast 跳过）
 * - 颜色：error=red, info=blue, success=emerald
 * - 手动关闭：右侧「×」按钮
 *
 * v1.1 扩展（spec Requirement: 失败文件支持重试）：
 * - toast.details: Array<{ message, action? }>
 * - 主 message 下方堆叠 details，每行右侧可放一个「重试」按钮
 * - sticky toast 不自动消失
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
  const hasDetails = (toast.details?.length ?? 0) > 0;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex flex-col gap-1.5 pl-3 pr-2 py-2.5',
        'rounded-xl border shadow-md min-w-[260px] max-w-[420px]',
        'animate-fadeUp',
        KIND_STYLES[toast.kind],
      )}
    >
      {/* 主行：图标 + message + 关闭 */}
      <div className="flex items-center gap-2.5">
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

      {/* v1.1：details 列表（支持内联 action） */}
      {hasDetails && (
        <ul className="ml-6 space-y-1 border-l-2 border-current/20 pl-2">
          {toast.details!.map((d, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[11px] opacity-90"
              data-toast-detail
            >
              <span className="flex-1 min-w-0 break-words">{d.message}</span>
              {d.action && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      d.action!.onClick();
                    } catch (e) {
                      console.error('[ToastViewport] action onClick failed:', e);
                    }
                  }}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-white/60 hover:bg-white border border-current/30 transition"
                  data-toast-action
                >
                  {d.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
