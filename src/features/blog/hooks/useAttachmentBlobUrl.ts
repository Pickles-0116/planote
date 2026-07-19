/**
 * useAttachmentBlobUrl - 取附件 blob URL 的便捷 hook（add-blog-attachment 增量）
 *
 * 用法：
 * ```tsx
 * const { url, loading } = useAttachmentBlobUrl(attachment.id);
 * <img src={url} alt={attachment.filename} />
 * ```
 *
 * 行为：
 * - 首次 mount → 调 useAttachmentStore.getObjectURL(id) → 返回 url
 * - url 来自 store 内部 Map 缓存，同一 id 不重复 createObjectURL
 * - 组件 unmount 不自动 revoke（由 store.revokeAll 在 BlogEdit/BlogDetail 卸载时统一处理）
 *
 * 错误：getObjectURL 失败时 url === undefined，loading === false
 */

import { useEffect, useState } from 'react';
import { useAttachmentStore } from '@/stores';
import type { ID } from '@/types/domain';

export interface UseAttachmentBlobUrlResult {
  url: string | undefined;
  loading: boolean;
  error: unknown;
}

export function useAttachmentBlobUrl(
  attachmentId: ID,
): UseAttachmentBlobUrlResult {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);
  const getObjectURL = useAttachmentStore((s) => s.getObjectURL);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getObjectURL(attachmentId)
      .then((u) => {
        if (cancelled) return;
        setUrl(u);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId, getObjectURL]);

  return { url, loading, error };
}
