/**
 * usePlanEditSubmit - 计划编辑提交 hook
 *
 * 设计要点（design.md §2.5）：
 * - create 模式：createPlan + Promise.all(createItem × N) 批量创建事项
 * - edit 模式：updatePlan 仅改 plan 字段（items 修改留给 add-item-crud）
 * - 校验：canSubmit(state) = 至少 1 个非空 title
 * - 成功：清草稿 + 调 onSuccess(planId)
 * - 失败：console.error + 不清草稿 + 不调 onSuccess
 */

import { useCallback, useState } from 'react';
import { usePlanStore, useItemsStore } from '@/stores';
import type { ID } from '@/types/domain';
import type { DraftFormState } from './usePlanEditDraft';

interface SubmitParams {
  mode: 'create' | 'edit';
  planId: ID | null;
  state: DraftFormState;
  /** 提交成功回调（通常在 PlanEdit 内 navigate）。 */
  onSuccess: (planId: ID) => void;
}

/** 校验步骤 3 至少 1 个非空 title。 */
export function canSubmit(state: DraftFormState): boolean {
  return state.items.some((it) => it.title.trim().length > 0);
}

/** 校验步骤 1：标题非空。 */
export function canAdvanceFromStep1(state: DraftFormState): boolean {
  return state.title.trim().length > 0;
}

/** 校验步骤 2：level + timeDim 都已选。 */
export function canAdvanceFromStep2(state: DraftFormState): boolean {
  return state.level !== null && state.timeDim !== null;
}

export function usePlanEditSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async ({ mode, planId, state, onSuccess }: SubmitParams) => {
      if (!canSubmit(state)) {
        setError('请至少添加 1 个有效事项');
        return;
      }

      setSubmitting(true);
      setError(null);

      // 过滤 + 规范化事项
      const validItems = state.items
        .filter((it) => it.title.trim().length > 0)
        .map((it, order) => ({
          title: it.title.trim(),
          dueDate: it.dueDate,
          order,
        }));

      try {
        if (mode === 'create') {
          // 1. 创建 plan
          const plan = await usePlanStore.getState().createPlan({
            title: state.title.trim(),
            description: state.description.trim(),
            level: state.level!,
            timeDim: state.timeDim!,
            status: 'todo',
            tagIds: [],
            itemIds: [],
            blogIds: [],
            childPlanIds: [],
            startDate: state.startDate || undefined,
            endDate: state.endDate || undefined,
            parentPlanId: state.parentPlanId ?? undefined,
          });

          // 2. 批量创建事项
          await Promise.all(
            validItems.map((it) =>
              useItemsStore.getState().createItem(plan.id, {
                ...it,
                status: 'todo',
                checked: false,
              }),
            ),
          );

          onSuccess(plan.id);
        } else {
          // edit 模式：仅更新 plan 字段
          if (!planId) {
            throw new Error('edit mode requires planId');
          }
          const updated = await usePlanStore.getState().updatePlan(planId, {
            title: state.title.trim(),
            description: state.description.trim(),
            level: state.level!,
            timeDim: state.timeDim!,
            startDate: state.startDate || undefined,
            endDate: state.endDate || undefined,
            parentPlanId: state.parentPlanId ?? undefined,
          });

          onSuccess(updated.id);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : '提交失败';
        setError(message);
        console.error('[usePlanEditSubmit] failed:', e);
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return { submit, submitting, error };
}
