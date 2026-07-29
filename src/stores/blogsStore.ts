/**
 * 博客 store
 *
 * 业务 store 不持有实体数据；Blog 实体走 `useBlog(id)` / `useBlogs()` hook。
 */

import { create } from 'zustand';
import type { ID, Blog } from '@/types/domain';
import type { BlogCreateInput, AppErrorPayload } from '@/db/repos/types';
import { blogRepo, folderRepo } from '@/db/repos';
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
      // 维护所属文件夹的博客计数缓存（V1.2 F3）
      await folderRepo.bumpBlogCount(blog.folderId, 1).catch(() => {});
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
      // 记录旧 folderId，便于移动博客时同步计数（V1.2 F3）
      let oldFolderId: ID | undefined;
      if (patch.folderId !== undefined) {
        const cur = await blogRepo.get(id);
        oldFolderId = cur?.folderId;
      }
      const blog = await blogRepo.update(id, patch);
      if (
        patch.folderId !== undefined &&
        oldFolderId !== undefined &&
        oldFolderId !== blog.folderId
      ) {
        await folderRepo.bumpBlogCount(oldFolderId, -1).catch(() => {});
        await folderRepo.bumpBlogCount(blog.folderId, 1).catch(() => {});
      }
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
      const existing = await blogRepo.get(id);
      await blogRepo.delete(id);
      // 维护所属文件夹的博客计数缓存（V1.2 F3）
      if (existing) await folderRepo.bumpBlogCount(existing.folderId, -1).catch(() => {});
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
      // 副本继承源文件夹，计数 +1（V1.2 F3）
      await folderRepo.bumpBlogCount(blog.folderId, 1).catch(() => {});
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
