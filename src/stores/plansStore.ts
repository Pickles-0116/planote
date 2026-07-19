/**
 * 计划 store
 *
 * **关键架构决策（见 design.md §2）**：
 * - 本 store **不**持有实体数据（plans 数组）
 * - 实体数据走 `usePlan` / `usePlans` hook（基于 `useLiveQuery`）
 * - 本 store 只持有 transient 状态：loading / error / selectedId / draft
 * - 所有 action 包装 `planRepo`，失败时归一化错误 + console.error + 向上抛
 */

import { create } from 'zustand';
import type { ID, Plan } from '@/types/domain';
import type {
  PlanCreateInput,
  PlanUpdatePatch,
  AppErrorPayload,
} from '@/db/repos/types';
import { planRepo } from '@/db/repos';
import { toAppErrorPayload } from './_internal/toAppErrorPayload';

export interface PlanStoreState {
  // —— transient 状态 ——
  loading: boolean;
  error: AppErrorPayload | null;
  selectedId: ID | null;
  /** 编辑页 3 步骤表单的草稿（中途暂存） */
  draft: Partial<PlanCreateInput> | null;

  // —— actions ——
  setSelected: (id: ID | null) => void;
  setDraft: (draft: Partial<PlanCreateInput> | null) => void;
  clearError: () => void;

  createPlan: (input: PlanCreateInput) => Promise<Plan>;
  updatePlan: (id: ID, patch: PlanUpdatePatch) => Promise<Plan>;
  deletePlan: (id: ID) => Promise<void>;
  bulkUpdatePlans: (ids: ID[], patch: PlanUpdatePatch) => Promise<Plan[]>;
  recomputeProgress: (planId: ID) => Promise<number>;
}

export const usePlanStore = create<PlanStoreState>((set) => ({
  loading: false,
  error: null,
  selectedId: null,
  draft: null,

  setSelected: (id) => set({ selectedId: id }),
  setDraft: (draft) => set({ draft }),
  clearError: () => set({ error: null }),

  createPlan: async (input) => {
    set({ loading: true, error: null });
    try {
      const plan = await planRepo.create(input);
      set({ loading: false });
      return plan;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[plansStore.createPlan] failed:', payload);
      throw e;
    }
  },

  updatePlan: async (id, patch) => {
    set({ loading: true, error: null });
    try {
      const plan = await planRepo.update(id, patch);
      set({ loading: false });
      return plan;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[plansStore.updatePlan] failed:', payload);
      throw e;
    }
  },

  deletePlan: async (id) => {
    set({ loading: true, error: null });
    try {
      await planRepo.delete(id);
      set({ loading: false });
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[plansStore.deletePlan] failed:', payload);
      throw e;
    }
  },

  bulkUpdatePlans: async (ids, patch) => {
    set({ loading: true, error: null });
    try {
      const updated = await planRepo.bulkUpdate(ids, patch);
      set({ loading: false });
      return updated;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[plansStore.bulkUpdatePlans] failed:', payload);
      throw e;
    }
  },

  recomputeProgress: async (planId) => {
    // 不置 loading：静默重算（通常由 itemsStore.toggle 触发，不应让 UI loading 闪烁）
    try {
      return await planRepo.recomputeProgress(planId);
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ error: payload });
      console.error('[plansStore.recomputeProgress] failed:', payload);
      throw e;
    }
  },
}));
