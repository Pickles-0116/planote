/**
 * AttachmentList - 附件列表（详情页用，add-blog-attachment 增量）
 *
 * 行为：
 * - 网格：grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3
 * - 图片：onClick 触发 `onImageClick(att, url)` → 父组件打开 lightbox
 * - PDF：用 `<a href={url} download={filename}>` 包成下载链接
 * - 排序：按 `uploadedAt` desc（最新在前）；由 useAttachments 注入时已排序
 *
 * 与 AttachmentManager 区别：
 * - AttachmentList：只读（详情页用），包 onImageClick / onDownload
 * - AttachmentManager：编辑页用，包标题 + onRemove
 */

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttachmentStore } from '@/stores';
import type { Attachment, ID } from '@/types/domain';
import AttachmentItem from './AttachmentItem';

interface Props {
  attachments: Attachment[];
  /** 图片点击放大回调。 */
  onImageClick?: (attachment: Attachment, blobUrl: string) => void;
}

interface ResolvedUrl {
  url: string | undefined;
  loading: boolean;
  error: boolean;
}

/** 单条附件 url 解析（hook 形式避免每次父组件重渲都重新计算）。 */
function useAttachmentUrl(id: ID): ResolvedUrl {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const getObjectURL = useAttachmentStore((s) => s.getObjectURL);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getObjectURL(id)
      .then((u) => {
        if (cancelled) return;
        setUrl(u);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, getObjectURL]);

  return { url, loading, error };
}

interface ResolvedAttachmentProps {
  attachment: Attachment;
  onImageClick?: (attachment: Attachment, blobUrl: string) => void;
}

function ResolvedAttachment({
  attachment,
  onImageClick,
}: ResolvedAttachmentProps): JSX.Element {
  const { url, loading, error } = useAttachmentUrl(attachment.id);
  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';

  if (loading) {
    return <div className="aspect-square bg-stone-100 rounded-xl animate-pulse" />;
  }
  if (error || !url) {
    return (
      <div className="aspect-square bg-red-50 rounded-xl flex items-center justify-center text-xs text-red-600">
        加载失败
      </div>
    );
  }

  // url 在此已 narrow 为 string
  const blobUrl: string = url;

  // PDF：用下载链接包裹
  if (isPdf) {
    return (
      <a
        href={blobUrl}
        download={attachment.filename}
        aria-label={`下载 ${attachment.filename}`}
        className={cn(
          'block group relative bg-white border border-stone-200 rounded-xl overflow-hidden',
          'hover:border-brand-300 hover:shadow-soft transition',
          'focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
        )}
      >
        <AttachmentItem attachment={attachment} blobUrl={blobUrl} />
        <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-900/90 text-white text-[10px]">
          <Download size={10} />
          <FileText size={10} />
        </div>
      </a>
    );
  }

  // 图片
  return (
    <AttachmentItem
      attachment={attachment}
      blobUrl={blobUrl}
      onClick={isImage && onImageClick ? () => onImageClick(attachment, blobUrl) : undefined}
    />
  );
}

export default function AttachmentList({
  attachments,
  onImageClick,
}: Props): JSX.Element {
  if (attachments.length === 0) return <></>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {attachments.map((att) => (
        <ResolvedAttachment
          key={att.id}
          attachment={att}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}
