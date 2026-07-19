/**
 * Drawer - 通用右侧抽屉壳
 *
 * 视觉（与 prototype framework-drawer 对齐）：
 * - 右侧滑入（width px，默认 480）
 * - 背景黑色/30 半透明遮罩
 * - ESC 关闭 + 背景点击关闭
 * - role="dialog" + aria-modal="true"
 *
 * 行为（spec Requirement: 框架抽屉入口）：
 * - open=false 时不渲染（避免重渲染开销）
 * - ESC 键监听挂在 document 上（抽屉打开时挂，关闭时卸）
 * - 抽屉内点击 e.stopPropagation 阻止冒泡到背景
 *
 * 不在本组件范围：
 * - 焦点陷阱完整实现（v1.0 简化：仅首次打开聚焦标题）
 * - body 滚动锁（避免与详情页内容竞争滚动）
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** 抽屉宽度 px；默认 480。 */
  width?: number;
}

export default function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  width = 480,
}: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 首次打开聚焦标题
  useEffect(() => {
    if (open && titleRef.current) {
      // 下一帧聚焦，等滑入动画稳定
      const id = window.setTimeout(() => {
        titleRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* 背景遮罩 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭抽屉"
        className="absolute inset-0 bg-black/30 animate-fadeUp"
        style={{ animationDuration: '0.2s' }}
      />

      {/* 抽屉主体 */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 bg-white dark:bg-stone-800 shadow-2xl flex flex-col',
          'animate-drawer-slideIn',
        )}
        style={{ width, animation: 'drawerSlideIn 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3
              id="drawer-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-base font-bold outline-none text-brand-900 dark:text-stone-100"
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs text-brand-400 dark:text-stone-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500 dark:text-stone-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}
