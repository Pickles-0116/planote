/**
 * 框架 store
 *
 * v1.0 框架为只读内置常量，store 只暴露 `applyFramework` 一个写 action。
 * 框架实体数据走 `useFrameworks()` hook。
 */

import { create } from 'zustand';
import type { ID, TiptapJSON } from '@/types/domain';
import type { AppErrorPayload } from '@/db/repos/types';
import { frameworkRepo } from '@/db/repos';
import { toAppErrorPayload } from './_internal/toAppErrorPayload';

export interface FrameworkStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  // —— actions ——
  clearError: () => void;
  applyFramework: (frameworkId: ID, planId?: ID) => Promise<TiptapJSON>;
}

export const useFrameworkStore = create<FrameworkStoreState>((set) => ({
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  applyFramework: async (frameworkId, planId) => {
    set({ loading: true, error: null });
    try {
      const doc = await frameworkRepo.apply(frameworkId, planId);
      set({ loading: false });
      return doc;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[frameworksStore.applyFramework] failed:', payload);
      throw e;
    }
  },
}));
