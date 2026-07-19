/**
 * 附件 store
 *
 * 业务 store 不持有实体数据；Attachment 实体走 `useAttachmentsForBlog(blogId)` hook。
 *
 * 特殊职责：缓存 `URL.createObjectURL` 返回的 object URL，避免同一 blob 重复创建。
 * `revokeAll` 用于组件卸载时清理所有 URL 防内存泄漏。
 */

import { create } from 'zustand';
import type { ID, Attachment } from '@/types/domain';
import type { AppErrorPayload } from '@/db/repos/types';
import { attachmentRepo } from '@/db/repos';
import { toAppErrorPayload } from './_internal/toAppErrorPayload';

export interface AttachmentStoreState {
  loading: boolean;
  error: AppErrorPayload | null;
  /** object URL 缓存。key=attachmentId, value=URL.createObjectURL 返回的字符串。 */
  objectUrls: Map<ID, string>;

  // —— actions ——
  clearError: () => void;
  uploadAttachment: (blogId: ID, file: File) => Promise<Attachment>;
  deleteAttachment: (id: ID) => Promise<void>;
  getObjectURL: (id: ID) => Promise<string>;
  /** 遍历 objectUrls 调 URL.revokeObjectURL 并清空。组件卸载时调用。 */
  revokeAll: () => void;
}

export const useAttachmentStore = create<AttachmentStoreState>((set, get) => ({
  loading: false,
  error: null,
  objectUrls: new Map(),

  clearError: () => set({ error: null }),

  uploadAttachment: async (blogId, file) => {
    set({ loading: true, error: null });
    try {
      const att = await attachmentRepo.upload(blogId, file);
      set({ loading: false });
      return att;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[attachmentsStore.uploadAttachment] failed:', payload);
      throw e;
    }
  },

  deleteAttachment: async (id) => {
    set({ loading: true, error: null });
    try {
      // 先 revoke 已缓存的 URL
      const cached = get().objectUrls.get(id);
      if (cached) {
        URL.revokeObjectURL(cached);
        const next = new Map(get().objectUrls);
        next.delete(id);
        set({ objectUrls: next });
      }
      await attachmentRepo.delete(id);
      set({ loading: false });
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[attachmentsStore.deleteAttachment] failed:', payload);
      throw e;
    }
  },

  getObjectURL: async (id) => {
    const cached = get().objectUrls.get(id);
    if (cached) return cached;
    try {
      const url = await attachmentRepo.getObjectURL(id);
      const next = new Map(get().objectUrls);
      next.set(id, url);
      set({ objectUrls: next });
      return url;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ error: payload });
      console.error('[attachmentsStore.getObjectURL] failed:', payload);
      throw e;
    }
  },

  revokeAll: () => {
    for (const url of get().objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    set({ objectUrls: new Map() });
  },
}));
