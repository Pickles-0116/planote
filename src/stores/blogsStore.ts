/**
 * 博客 store
 *
 * 业务 store 不持有实体数据；Blog 实体走 `useBlog(id)` / `useBlogs()` hook。
 */

import { create } from 'zustand';
import type { ID, Blog } from '@/types/domain';
import type { BlogCreateInput, AppErrorPayload } from '@/db/repos/types';
import { blogRepo } from '@/db/repos';
import { toAppErrorPayload } from './_internal/toAppErrorPayload';

export interface BlogStoreState {
  loading: boolean;
  error: AppErrorPayload | null;
  selectedId: ID | null;

  // —— actions ——
  setSelected: (id: ID | null) => void;
  clearError: () => void;
  createBlog: (input: BlogCreateInput) => Promise<Blog>;
  updateBlog: (id: ID, patch: Partial<Blog>) => Promise<Blog>;
  deleteBlog: (id: ID) => Promise<void>;
  duplicateBlog: (id: ID) => Promise<Blog>;
  archiveBlog: (id: ID) => Promise<Blog>;
  searchBlogs: (q: string) => Promise<Blog[]>;
}

export const useBlogStore = create<BlogStoreState>((set) => ({
  loading: false,
  error: null,
  selectedId: null,

  setSelected: (id) => set({ selectedId: id }),
  clearError: () => set({ error: null }),

  createBlog: async (input) => {
    set({ loading: true, error: null });
    try {
      const blog = await blogRepo.create(input);
      set({ loading: false });
      return blog;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogsStore.createBlog] failed:', payload);
      throw e;
    }
  },

  updateBlog: async (id, patch) => {
    set({ loading: true, error: null });
    try {
      const blog = await blogRepo.update(id, patch);
      set({ loading: false });
      return blog;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogsStore.updateBlog] failed:', payload);
      throw e;
    }
  },

  deleteBlog: async (id) => {
    set({ loading: true, error: null });
    try {
      await blogRepo.delete(id);
      set({ loading: false });
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogsStore.deleteBlog] failed:', payload);
      throw e;
    }
  },

  duplicateBlog: async (id) => {
    set({ loading: true, error: null });
    try {
      const blog = await blogRepo.duplicate(id);
      set({ loading: false });
      return blog;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogsStore.duplicateBlog] failed:', payload);
      throw e;
    }
  },

  archiveBlog: async (id) => {
    set({ loading: true, error: null });
    try {
      const blog = await blogRepo.archive(id);
      set({ loading: false });
      return blog;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[blogsStore.archiveBlog] failed:', payload);
      throw e;
    }
  },

  searchBlogs: async (q) => {
    try {
      return await blogRepo.search(q);
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ error: payload });
      console.error('[blogsStore.searchBlogs] failed:', payload);
      throw e;
    }
  },
}));
