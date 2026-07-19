/**
 * AttachmentItem - 单附件卡片（add-blog-attachment 增量）
 *
 * 行为：
 * - 图片：缩略图（aspect-square cover）+ 底部文件名 + 大小
 * - PDF：`<FileText>` icon + 文件名 + 大小
 * - 可选 `onRemove`：编辑模式显「×」按钮
 * - 可选 `onClick`：详情页图片点击放大
 * - 容器用 div；只有 onClick 时变为交互（role/tabIndex/onClick）
 */

import { FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize, getAttachmentKind } from '@/features/blog/utils/attachmentValidation';
import type { Attachment } from '@/types/domain';

interface Props {
  attachment: Attachment;
  /** blob URL（来自 useAttachmentStore.getObjectURL(id)）。 */
  blobUrl: string;
  /** 编辑页：删除按钮。 */
  onRemove?: () => void;
  /** 详情页：图片点击放大。 */
  onClick?: () => void;
}

export default function AttachmentItem({
  attachment,
  blobUrl,
  onRemove,
  onClick,
}: Props): JSX.Element {
  const kind = getAttachmentKind(attachment.mimeType);
  const isImage = kind === 'image';
  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'relative group bg-white border border-stone-200 rounded-xl overflow-hidden',
        'hover:border-brand-300 hover:shadow-soft transition',
      )}
    >
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        aria-label={interactive ? `查看 ${attachment.filename}` : undefined}
        className={cn(
          'w-full text-left block',
          interactive &&
            'cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
        )}
      >
        {/* 缩略图区 */}
        <div className="w-full aspect-square bg-stone-50 flex items-center justify-center overflow-hidden">
          {isImage ? (
            <img
              src={blobUrl}
              alt={attachment.filename}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <FileText size={36} className="text-brand-400 flex-shrink-0" />
          )}
        </div>

        {/* 底部信息 */}
        <div className="px-2 py-1.5 border-t border-stone-100">
          <div className="text-xs text-brand-900 truncate" title={attachment.filename}>
            {attachment.filename}
          </div>
          <div className="text-[10px] text-brand-400 mt-0.5">
            {formatFileSize(attachment.size)}
          </div>
        </div>
      </div>

      {/* 删除按钮：编辑模式 */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`删除 ${attachment.filename}`}
          className={cn(
            'absolute top-1.5 right-1.5 w-6 h-6 rounded-full',
            'bg-black/60 text-white flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition',
            'hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-400 focus:outline-none',
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
