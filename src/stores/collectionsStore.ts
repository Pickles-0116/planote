/**
 * collectionsStore - 收藏夹写操作 Store
 *
 * v1.4-Organize：收藏夹 CRUD + 项目关联管理。
 * 实体数据走 useCollections() hook（useLiveQuery）。
 */

import { create } from 'zustand';
import { collectionRepo } from '@/db/repos';
import type { ID, Collection, CollectionItem, CollectionEntityType } from '@/types/domain';

export interface CollectionStoreState {
  loading: boolean;
  error: string | null;
  clearError: () => void;
  createCollection: (input: { name: string; icon: string; color: string }) => Promise<Collection>;
  updateCollection: (id: ID, patch: Partial<Pick<Collection, 'name' | 'icon' | 'color'>>) => Promise<Collection>;
  deleteCollection: (id: ID) => Promise<void>;
  reorderCollections: (ids: ID[]) => Promise<void>;
  addItemToCollection: (collectionId: ID, entityType: CollectionEntityType, entityId: ID) => Promise<CollectionItem>;
  removeItemFromCollection: (collectionId: ID, entityId: ID) => Promise<void>;
}

export const useCollectionsStore = create<CollectionStoreState>((set) => ({
  loading: false,
  error: null,
  clearError: () => set({ error: null }),

  createCollection: async (input) => {
    set({ loading: true, error: null });
    try {
      const col = await collectionRepo.create(input);
      return col;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '创建收藏夹失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateCollection: async (id, patch) => {
    set({ loading: true, error: null });
    try {
      const col = await collectionRepo.update(id, patch);
      return col;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '更新收藏夹失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteCollection: async (id) => {
    set({ loading: true, error: null });
    try {
      await collectionRepo.delete(id);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '删除收藏夹失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  reorderCollections: async (ids) => {
    try {
      await collectionRepo.reorder(ids);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '排序失败' });
    }
  },

  addItemToCollection: async (collectionId, entityType, entityId) => {
    try {
      return await collectionRepo.addItem(collectionId, entityType, entityId);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加入收藏夹失败' });
      throw e;
    }
  },

  removeItemFromCollection: async (collectionId, entityId) => {
    try {
      await collectionRepo.removeItem(collectionId, entityId);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '移出收藏夹失败' });
      throw e;
    }
  },
}));
