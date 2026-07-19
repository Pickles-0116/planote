/**
 * ImageLightbox - 全屏图片预览（add-blog-attachment 增量）
 *
 * 行为：
 * - 用原生 `<dialog>` 元素 + `showModal()` / `close()`
 * - src 变化时自动 showModal；src 变 null 时 close
 * - 背景点击关闭（`e.target === e.currentTarget`）
 * - Esc 关闭（dialog 原生内建）
 * - a11y：dialog 原生 focus trap + Esc 关闭
 *
 * 不传 src 时不渲染（避免重渲染开销）。
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  src: string | null;
  alt: string;
  onClose: () => void;
}

export default function ImageLightbox({
  src,
  alt,
  onClose,
}: Props): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 同步 open 状态
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (src && !dialog.open) {
      dialog.showModal();
    } else if (!src && dialog.open) {
      dialog.close();
    }
  }, [src]);

  // 卸载时关闭
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      dialog?.close();
    };
  }, []);

  // 监听 dialog 自身的 close 事件（Esc 触发）
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = (): void => {
      // 仅在 src 仍非 null 时回调（避免和 unmount close 冲突）
      if (src) onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [src, onClose]);

  if (!src) return <></>;

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="backdrop:bg-black/80 p-0 max-w-[95vw] max-h-[95vh] bg-transparent border-0 shadow-none"
      aria-label={alt}
    >
      <div className="relative flex items-center justify-center p-4">
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[90vh] object-contain"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭预览"
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus:outline-none"
        >
          <X size={16} />
        </button>
      </div>
    </dialog>
  );
}
