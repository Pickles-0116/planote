/**
 * useUndoableActions - 将 CRUD 操作包装为可撤销操作
 *
 * 使用方式：
 *   const undoable = useUndoableActions();
 *   await undoable.toggleItem(itemId, planId);
 *   await undoable.deletePlan(planId);
 *
 * 每次操作前捕获快照，操作后捕获快照，推入 undoStore。
 * undoStore 内部通过 isUndoRedoing 标志位避免 undo/redo 操作本身入栈。
 */

import { useCallback } from 'react';
import {
  useUndoStore,
  capturePlanSnapshot,
  captureItemSnapshot,
  captureBlogSnapshot,
} from '@/stores/undoStore';
import { planRepo } from '@/db/repos';
import { itemRepo } from '@/db/repos';
import { blogRepo } from '@/db/repos';
import type { ID, ItemStatus } from '@/types/domain';

export function useUndoableActions() {
  const push = useUndoStore((s) => s.push);

  /** 切换事项状态（勾选/取消勾选）。 */
  const toggleItem = useCallback(
    async (itemId: ID, planId: ID) => {
      const beforeItem = await captureItemSnapshot(itemId);
      const beforePlan = await capturePlanSnapshot(planId);

      const result = await itemRepo.toggle(itemId);

      const afterItem = await captureItemSnapshot(itemId);
      const afterPlan = await capturePlanSnapshot(planId);

      push({
        description: result.checked ? '勾选事项' : '取消勾选',
        plans: { before: [beforePlan], after: [afterPlan] },
        items: { before: [beforeItem], after: [afterItem] },
        blogs: { before: [], after: [] },
        affectedPlanIds: [planId],
      });

      return result;
    },
    [push],
  );

  /** 设置事项状态。 */
  const setItemStatus = useCallback(
    async (itemId: ID, planId: ID, status: ItemStatus) => {
      const beforeItem = await captureItemSnapshot(itemId);
      const beforePlan = await capturePlanSnapshot(planId);

      const result = await itemRepo.setStatus(itemId, status);

      const afterItem = await captureItemSnapshot(itemId);
      const afterPlan = await capturePlanSnapshot(planId);

      push({
        description: `设置事项状态为 ${status}`,
        plans: { before: [beforePlan], after: [afterPlan] },
        items: { before: [beforeItem], after: [afterItem] },
        blogs: { before: [], after: [] },
        affectedPlanIds: [planId],
      });

      return result;
    },
    [push],
  );

  /** 删除事项。 */
  const deleteItem = useCallback(
    async (itemId: ID, planId: ID) => {
      const beforeItem = await captureItemSnapshot(itemId);
      const beforePlan = await capturePlanSnapshot(planId);

      await itemRepo.delete(itemId);

      const afterItem = await captureItemSnapshot(itemId);
      const afterPlan = await capturePlanSnapshot(planId);

      push({
        description: '删除事项',
        plans: { before: [beforePlan], after: [afterPlan] },
        items: { before: [beforeItem], after: [afterItem] },
        blogs: { before: [], after: [] },
        affectedPlanIds: [planId],
      });
    },
    [push],
  );

  /** 删除计划。 */
  const deletePlan = useCallback(
    async (planId: ID) => {
      const beforePlan = await capturePlanSnapshot(planId);

      await planRepo.delete(planId);

      const afterPlan = await capturePlanSnapshot(planId);

      push({
        description: '删除计划',
        plans: { before: [beforePlan], after: [afterPlan] },
        items: { before: [], after: [] },
        blogs: { before: [], after: [] },
        affectedPlanIds: [planId],
      });
    },
    [push],
  );

  /** 删除博客。 */
  const deleteBlog = useCallback(
    async (blogId: ID) => {
      const beforeBlog = await captureBlogSnapshot(blogId);

      await blogRepo.delete(blogId);

      const afterBlog = await captureBlogSnapshot(blogId);

      push({
        description: '删除博客',
        plans: { before: [], after: [] },
        items: { before: [], after: [] },
        blogs: { before: [beforeBlog], after: [afterBlog] },
        affectedPlanIds: [],
      });
    },
    [push],
  );

  /** 更新计划（编辑保存）。 */
  const updatePlan = useCallback(
    async (planId: ID, patch: Record<string, unknown>) => {
      const beforePlan = await capturePlanSnapshot(planId);

      const result = await planRepo.update(planId, patch);

      const afterPlan = await capturePlanSnapshot(planId);

      push({
        description: '更新计划',
        plans: { before: [beforePlan], after: [afterPlan] },
        items: { before: [], after: [] },
        blogs: { before: [], after: [] },
        affectedPlanIds: [planId],
      });

      return result;
    },
    [push],
  );

  /** 更新博客（自动保存/手动保存）。 */
  const updateBlog = useCallback(
    async (blogId: ID, patch: Record<string, unknown>) => {
      const beforeBlog = await captureBlogSnapshot(blogId);

      const result = await blogRepo.update(blogId, patch);

      const afterBlog = await captureBlogSnapshot(blogId);

      push({
        description: '更新博客',
        plans: { before: [], after: [] },
        items: { before: [], after: [] },
        blogs: { before: [beforeBlog], after: [afterBlog] },
        affectedPlanIds: [],
      });

      return result;
    },
    [push],
  );

  return {
    toggleItem,
    setItemStatus,
    deleteItem,
    deletePlan,
    deleteBlog,
    updatePlan,
    updateBlog,
  };
}
