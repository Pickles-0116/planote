/**
 * 标签 store
 *
 * 业务 store 不持有实体数据；Tag 实体走 `useTags()` hook。
 */

import { create } from 'zustand';
import type { ID, Tag } from '@/types/domain';
import type { TagCreateInput, AppErrorPayload } from '@/db/repos/types';
import { tagRepo } from '@/db/repos';
import { toAppErrorPayload } from './_internal/toAppErrorPayload';

export interface TagStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  // —— actions ——
  clearError: () => void;
  createTag: (input: TagCreateInput) => Promise<Tag>;
  deleteTag: (id: ID) => Promise<void>;
}

export const useTagStore = create<TagStoreState>((set) => ({
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  createTag: async (input) => {
    set({ loading: true, error: null });
    try {
      const tag = await tagRepo.create(input);
      set({ loading: false });
      return tag;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[tagsStore.createTag] failed:', payload);
      throw e;
    }
  },

  deleteTag: async (id) => {
    set({ loading: true, error: null });
    try {
      await tagRepo.delete(id);
      set({ loading: false });
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[tagsStore.deleteTag] failed:', payload);
      throw e;
    }
  },
}));
