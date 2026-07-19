/**
 * useAttachments - 附件读写 hook（add-blog-attachment 增量）
 *
 * 职责：
 * - 包装 useAttachmentsForBlog（live query）+ useAttachmentStore
 * - `add(file)`：先校验 → 失败 toast + 返回 null → 成功调 uploadAttachment + toast「已添加」
 * - `remove(id)`：直接调 deleteAttachment（store 内部已 revoke + 同步 Blog.attachmentIds）
 * - 错误：所有 catch 走 toast + console.error
 *
 * 为什么不直接用 useAttachmentStore：
 * - 校验逻辑（5MB + MIME）是这一轮才加的，集中放在 hook 内更内聚
 * - toast 是 UI 反馈，hook 内统一触发避免遗漏
 */

import { useCallback, useMemo } from 'react';
import {
  useAttachmentStore,
  useAttachmentsForBlog,
  useToastStore,
} from '@/stores';
import { validateAttachment } from '@/features/blog/utils/attachmentValidation';
import type { Attachment, ID } from '@/types/domain';

export interface UseAttachmentsResult {
  attachments: Attachment[] | undefined;
  add: (file: File) => Promise<Attachment | null>;
  remove: (id: ID) => Promise<void>;
  loading: boolean;
  error: unknown;
  isUploading: boolean;
}

export function useAttachments(blogId: ID | null | undefined): UseAttachmentsResult {
  const attachments = useAttachmentsForBlog(blogId);
  const store = useAttachmentStore();
  const pushToast = useToastStore((s) => s.push);

  // add：校验 → 写 DB → 反馈
  const add = useCallback(
    async (file: File): Promise<Attachment | null> => {
      const result = validateAttachment(file);
      if (!result.ok) {
        pushToast('error', result.error);
        return null;
      }
      if (!blogId) {
        pushToast('error', '博客未就绪，无法上传');
        return null;
      }
      try {
        const att = await store.uploadAttachment(blogId, file);
        pushToast('success', '已添加');
        return att;
      } catch (e) {
        const message = e instanceof Error ? e.message : '上传失败';
        pushToast('error', `上传失败：${message}`);
        console.error('[useAttachments.add] failed:', e);
        return null;
      }
    },
    [blogId, store, pushToast],
  );

  // remove：删除（store 内部已 revoke + 同步 Blog.attachmentIds）
  const remove = useCallback(
    async (id: ID): Promise<void> => {
      try {
        await store.deleteAttachment(id);
        pushToast('info', '附件已删除');
      } catch (e) {
        const message = e instanceof Error ? e.message : '删除失败';
        pushToast('error', `删除失败：${message}`);
        console.error('[useAttachments.remove] failed:', e);
      }
    },
    [store, pushToast],
  );

  // 排序：按 uploadedAt 倒序（最新在前）
  const sorted = useMemo<Attachment[] | undefined>(() => {
    if (!attachments) return undefined;
    return [...attachments].sort((a, b) =>
      a.uploadedAt < b.uploadedAt ? 1 : -1,
    );
  }, [attachments]);

  return {
    attachments: sorted,
    add,
    remove,
    loading: store.loading,
    error: store.error,
    isUploading: store.loading,
  };
}
