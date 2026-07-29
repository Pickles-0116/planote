/**
 * usePlanEditSubmit - 计划编辑提交 hook
 *
 * 设计要点（design.md §2.5 + v1.1 fix-item-crud）：
 * - create 模式：createPlan + Promise.all(createItem × N) 批量创建事项
 * - edit 模式：
 *   1. updatePlan 仅改 plan 字段
 *   2. 计算 items diff：
 *      - toCreate : draft 中无 existingId 且 title.trim() !== ''
 *      - toUpdate : draft 中 existingId 存在 + title 变化
 *      - toDelete : planStore 中有，但 draft 中无（被用户从列表删掉）或 draft.title 被清空
 *   3. 串行执行 create → update → delete（避免 ID 引用错乱）
 *   4. 类内 Promise.all
 *   5. 全部包在一个 Dexie transaction 中
 *   6. 最后调 planRepo.recomputeProgress
 *
 * 校验：canSubmit(state) = 至少 1 个非空 title
 * 成功：清草稿 + 调 onSuccess(planId)
 * 失败：console.error + 不清草稿 + 不调 onSuccess
 */

import { useCallback, useState } from 'react';
import { usePlanStore, useItemsStore } from '@/stores';
import { db, planRepo, itemRepo, tagRepo } from '@/db/repos';
import { newId } from '@/lib/id';
import type { ID, Item } from '@/types/domain';
import type { DraftFormState, DraftItem } from './usePlanEditDraft';

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

const nowISO = (): string => new Date().toISOString();

/** diff 阶段：toCreate / toUpdate / toDelete 的索引与 payload。 */
interface ItemsDiff {
  toCreate: Array<{ idx: number; title: string; dueDate?: string }>;
  toUpdate: Array<{ existingId: ID; patch: Partial<Item> }>;
  toDelete: ID[];
}

/** 自动分配标签颜色的调色板。 */
const TAG_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

/** 将表单中的标签名数组解析为 Tag ID 数组（不存在则自动创建）。 */
async function resolveTagIds(tagNames: string[]): Promise<ID[]> {
  const ids: ID[] = [];
  for (let i = 0; i < tagNames.length; i++) {
    const name = tagNames[i]!.trim();
    if (!name) continue;
    let tag = await tagRepo.getByName(name);
    if (!tag) {
      tag = await tagRepo.create({
        name,
        color: TAG_COLORS[i % TAG_COLORS.length]!,
      });
    }
    ids.push(tag.id);
  }
  return ids;
}

/** 暴露给单元测试 / 调试使用。 */
export function computeItemsDiff(
  draftItems: DraftItem[],
  existingItems: Item[],
): ItemsDiff {
  const existingById = new Map<string, Item>();
  for (const it of existingItems) existingById.set(it.id, it);

  const draftIds = new Set<string>();

  const toCreate: ItemsDiff['toCreate'] = [];
  const toUpdate: ItemsDiff['toUpdate'] = [];
  const toDelete: ID[] = [];

  for (let idx = 0; idx < draftItems.length; idx++) {
    const d = draftItems[idx]!;
    const title = d.title.trim();
    if (d.existingId) {
      draftIds.add(d.existingId);
      const existing = existingById.get(d.existingId);
      if (!existing) {
        // 已存在但 store 找不到 → 当成新增
        if (title) {
          toCreate.push({ idx, title, dueDate: d.dueDate });
        }
        continue;
      }
      // 标题清空 → 标记删除
      if (title === '') {
        toDelete.push(d.existingId);
        continue;
      }
      // 字段变化 → update
      const patch: Partial<Item> = {};
      let changed = false;
      if (existing.title !== title) {
        patch.title = title;
        changed = true;
      }
      const newDue = d.dueDate ?? undefined;
      if ((existing.dueDate ?? undefined) !== newDue) {
        patch.dueDate = newDue;
        changed = true;
      }
      if (d.status && d.status !== existing.status) {
        patch.status = d.status;
        if (d.status === 'done' && !existing.checked) patch.checked = true;
        if (d.status !== 'done' && existing.checked) patch.checked = false;
        changed = true;
      }
      if (changed) {
        toUpdate.push({ existingId: d.existingId, patch });
      }
    } else {
      // 新增项：仅当 title 非空时
      if (title) {
        toCreate.push({ idx, title, dueDate: d.dueDate });
      }
    }
  }

  // 列表里彻底消失的 existingId → 删除
  for (const it of existingItems) {
    if (!draftIds.has(it.id)) {
      toDelete.push(it.id);
    }
  }

  return { toCreate, toUpdate, toDelete };
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

      try {
        if (mode === 'create') {
          // 0. 解析标签名为 ID（不存在则自动创建）
          const tagIds = await resolveTagIds(state.tags);

          // 1. 创建 plan
          const plan = await usePlanStore.getState().createPlan({
            title: state.title.trim(),
            description: state.description.trim(),
            level: state.level!,
            timeDim: state.timeDim!,
            status: 'todo',
            tagIds,
            itemIds: [],
            blogIds: [],
            childPlanIds: [],
            startDate: state.startDate || undefined,
            endDate: state.endDate || undefined,
            parentPlanId: state.parentPlanId ?? undefined,
          });

          // 2. 批量创建事项（仅 title 非空）
          const validItems = state.items
            .filter((it) => it.title.trim().length > 0)
            .map((it, order) => ({
              title: it.title.trim(),
              dueDate: it.dueDate,
              order,
            }));

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
          // edit 模式
          if (!planId) {
            throw new Error('edit mode requires planId');
          }
          // 0. 解析标签名为 ID（不存在则自动创建）
          const tagIds = await resolveTagIds(state.tags);

          // 1. 更新 plan 字段
          const updated = await usePlanStore.getState().updatePlan(planId, {
            title: state.title.trim(),
            description: state.description.trim(),
            level: state.level!,
            timeDim: state.timeDim!,
            tagIds,
            startDate: state.startDate || undefined,
            endDate: state.endDate || undefined,
            parentPlanId: state.parentPlanId ?? undefined,
          });

          // 2. 拉取 store 中的 items 用于 diff
          const existing = await itemRepo.listByPlan(planId);

          // 3. 计算 diff
          const diff = computeItemsDiff(state.items, existing);

          // 4. 串行执行：create → update → delete（避免 ID 引用错乱）
          //    类内用 Promise.all；全部包在一个 Dexie transaction 中
          // 5. 最后重算 progress
          await db.transaction('rw', db.items, db.plans, async () => {
            // 5.1 create
            await Promise.all(
              diff.toCreate.map(async (c) => {
                const newItem: Item = {
                  id: newId(),
                  planId,
                  title: c.title,
                  dueDate: c.dueDate,
                  status: 'todo',
                  checked: false,
                  order: 0, // 全部 create 完后再统一 reorder
                  createdAt: nowISO(),
                  updatedAt: nowISO(),
                };
                await db.items.add(newItem);
                // 同步追加到 plan.itemIds
                const plan = await db.plans.get(planId);
                if (plan && !plan.itemIds.includes(newItem.id)) {
                  await db.plans.put({
                    ...plan,
                    itemIds: [...plan.itemIds, newItem.id],
                    updatedAt: nowISO(),
                  });
                }
              }),
            );

            // 5.2 update
            await Promise.all(
              diff.toUpdate.map(async (u) => {
                const cur = await db.items.get(u.existingId);
                if (!cur) return;
                await db.items.put({ ...cur, ...u.patch, updatedAt: nowISO() });
              }),
            );

            // 5.3 delete
            await Promise.all(
              diff.toDelete.map(async (delId) => {
                await db.items.delete(delId);
                // 从 plan.itemIds 移除
                const plan = await db.plans.get(planId);
                if (plan && plan.itemIds.includes(delId)) {
                  await db.plans.put({
                    ...plan,
                    itemIds: plan.itemIds.filter((id) => id !== delId),
                    updatedAt: nowISO(),
                  });
                }
              }),
            );
          });

          // 6. 重算 progress（在 transaction 外，避免长事务）
          await planRepo.recomputeProgress(planId);

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
