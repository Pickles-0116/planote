/**
 * LoadingOverlay - 路由级 / 视图级加载遮罩
 *
 * 用途：包裹 React.lazy + Suspense 的 fallback、视图切换、表单提交等待等整页操作。
 * 与 Skeleton 语义互补（见 Skeleton.tsx 顶部说明）。
 *
 * a11y：
 * - visible=true 时设 role="status" + aria-live="polite"，屏幕阅读器自动播报 label
 * - visible=false 不输出任何 DOM（避免无意义节点）
 */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  /** 是否显示遮罩；false 时返回 null */
  visible: boolean;
  /** 加载提示文案；默认「加载中…」 */
  label?: string;
  /** 是否模糊背景；默认 true（路由切换场景） */
  blur?: boolean;
}

export default function LoadingOverlay({
  visible,
  label = '加载中…',
  blur = true,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-stone-900/60',
        blur && 'backdrop-blur-sm',
      )}
    >
      <Loader2 className="animate-spin text-accent-500" size={32} />
      <p className="text-sm text-brand-500 dark:text-stone-400 mt-3">{label}</p>
    </div>
  );
}
