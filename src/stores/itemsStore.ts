/**
 * 事项 store
 *
 * 业务 store 不持有实体数据；Item 实体走 `useItemsForPlan(planId)` hook。
 * 本 store 只暴露写 action + loading / error 状态。
 */

import { create } from 'zustand';
import type { ID, Item, ItemStatus } from '@/types/domain';
import type { ItemCreateInput, AppErrorPayload } from '@/db/repos/types';
import { itemRepo } from '@/db/repos';
import { toAppErrorPayload } from './_internal/toAppErrorPayload';

export interface ItemStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  // —— actions ——
  clearError: () => void;
  toggleItem: (id: ID) => Promise<Item>;
  /** 设置事项状态（add-plan-detail-view 增量）。 */
  setItemStatus: (id: ID, status: ItemStatus) => Promise<Item>;
  createItem: (planId: ID, input: ItemCreateInput) => Promise<Item>;
  reorderItems: (planId: ID, orderedIds: ID[]) => Promise<void>;
  deleteItem: (id: ID) => Promise<void>;
}

export const useItemsStore = create<ItemStoreState>((set) => ({
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  toggleItem: async (id) => {
    // 不置 loading：toggle 走仓库底层事务，单次操作极快，避免 UI loading 闪烁
    try {
      return await itemRepo.toggle(id);
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ error: payload });
      console.error('[itemsStore.toggleItem] failed:', payload);
      throw e;
    }
  },

  setItemStatus: async (id, status) => {
    try {
      return await itemRepo.setStatus(id, status);
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ error: payload });
      console.error('[itemsStore.setItemStatus] failed:', payload);
      throw e;
    }
  },

  createItem: async (planId, input) => {
    set({ loading: true, error: null });
    try {
      const item = await itemRepo.create(planId, input);
      set({ loading: false });
      return item;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[itemsStore.createItem] failed:', payload);
      throw e;
    }
  },

  reorderItems: async (planId, orderedIds) => {
    set({ loading: true, error: null });
    try {
      await itemRepo.reorder(planId, orderedIds);
      set({ loading: false });
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[itemsStore.reorderItems] failed:', payload);
      throw e;
    }
  },

  deleteItem: async (id) => {
    // 不置 loading：delete 触发 plan.recomputeProgress，单次操作
    try {
      await itemRepo.delete(id);
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ error: payload });
      console.error('[itemsStore.deleteItem] failed:', payload);
      throw e;
    }
  },
}));
