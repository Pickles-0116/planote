/**
 * 博客模板 Zustand Store
 *
 * 业务 store 不持有模板实体数据；模板实体走 useLiveQuery hook。
 * Store 仅持有 transient 状态（loading / error）。
 */

import { create } from 'zustand';
import type { ID, BlogTemplate } from '@/types/domain';
import type { BlogTemplateCreateInput, AppErrorPayload } from '@/db/repos/types';
import { blogTemplateRepo } from '@/db/repos';
import { toAppErrorPayload } from '@/stores/_internal/toAppErrorPayload';

export interface BlogTemplateStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  clearError: () => void;
  createTemplate: (input: BlogTemplateCreateInput) => Promise<BlogTemplate>;
  updateTemplate: (id: ID, patch: Partial<BlogTemplate>) => Promise<BlogTemplate>;
  deleteTemplate: (id: ID) => Promise<void>;
  duplicateTemplate: (id: ID) => Promise<BlogTemplate>;
  incrementUseCount: (id: ID) => Promise<void>;
}

export const useBlogTemplateStore = create<BlogTemplateStoreState>((set) => ({
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  createTemplate: async (input) => {
    set({ loading: true, error: null });
    try {
      const tpl = await blogTemplateRepo.create(input);
      set({ loading: false });
      return tpl;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogTemplateStore.createTemplate]', payload);
      throw e;
    }
  },

  updateTemplate: async (id, patch) => {
    set({ loading: true, error: null });
    try {
      const tpl = await blogTemplateRepo.update(id, patch);
      set({ loading: false });
      return tpl;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogTemplateStore.updateTemplate]', payload);
      throw e;
    }
  },

  deleteTemplate: async (id) => {
    set({ loading: true, error: null });
    try {
      await blogTemplateRepo.delete(id);
      set({ loading: false });
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogTemplateStore.deleteTemplate]', payload);
      throw e;
    }
  },

  duplicateTemplate: async (id) => {
    set({ loading: true, error: null });
    try {
      const tpl = await blogTemplateRepo.duplicate(id);
      set({ loading: false });
      return tpl;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogTemplateStore.duplicateTemplate]', payload);
      throw e;
    }
  },

  incrementUseCount: async (id) => {
    try {
      await blogTemplateRepo.incrementUseCount(id);
    } catch (e) {
      console.error('[blogTemplateStore.incrementUseCount]', e);
    }
  },
}));
