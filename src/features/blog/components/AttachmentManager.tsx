/**
 * AttachmentManager - 编辑页附件管理面板（add-blog-attachment 增量）
 *
 * 行为：
 * - 0 附件时整体不渲染（节省空间）
 * - 标题「附件（N）」+ 网格（复用 AttachmentList 的网格布局）
 * - 每条可删除：先确认 → 调 onRemove（hook 内 toast 反馈 + revoke URL + 同步 Blog.attachmentIds）
 *
 * 与 AttachmentList 区别：
 * - AttachmentManager：编辑页，包标题 + 删除确认
 * - AttachmentList：详情页，只读
 */

import { useCallback, useState } from 'react';
import { useEffect } from 'react';
import { useAttachmentStore } from '@/stores';
import type { Attachment, ID } from '@/types/domain';
import AttachmentItem from './AttachmentItem';

interface ResolvedProps {
  attachment: Attachment;
  onRemove: (id: ID) => void;
}

function ResolvedAttachment({ attachment, onRemove }: ResolvedProps): JSX.Element {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const getObjectURL = useAttachmentStore((s) => s.getObjectURL);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getObjectURL(attachment.id)
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
  }, [attachment.id, getObjectURL]);

  const handleRemove = useCallback((): void => {
    const ok = window.confirm(`确认删除「${attachment.filename}」？`);
    if (!ok) return;
    void onRemove(attachment.id);
  }, [attachment.id, attachment.filename, onRemove]);

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
  return (
    <AttachmentItem
      attachment={attachment}
      blobUrl={url}
      onRemove={handleRemove}
    />
  );
}

interface Props {
  attachments: Attachment[] | undefined;
  onRemove: (id: ID) => void;
}

export default function AttachmentManager({
  attachments,
  onRemove,
}: Props): JSX.Element {
  if (!attachments || attachments.length === 0) return <></>;
  return (
    <div className="mt-6 animate-fadeUp">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-brand-900">
          附件（{attachments.length}）
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {attachments.map((att) => (
          <ResolvedAttachment
            key={att.id}
            attachment={att}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
