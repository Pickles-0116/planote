/**
 * useItemCRUD - 统一的事项 CRUD hook
 *
 * 行为（spec Requirement: useItemCRUD hook MUST 提供统一 API）：
 * - 提供 6 个方法：add / update / remove / setStatus / toggle / reorder
 * - 所有写操作包 Dexie transaction（rw, items + plans）
 * - 写完成后自动调 `planRepo.recomputeProgress(planId)`
 * - 失败抛 Error（不静默吞）
 *
 * 职责分层：
 * - 本 hook 只负责「从 planId 派生 + 重算 progress」这些跨表操作
 * - 单表细节（字段归一化、order 分配）仍走 `itemRepo`
 *
 * 与 useToggleItem 的关系：
 * - useToggleItem 走 store + debounce 路径（高频勾选用）
 * - useItemCRUD 走直接 repo 路径（详情页手动操作）
 *   两者功能有重叠但使用场景不同；本 hook 不替代 useToggleItem
 */

import { useCallback } from 'react';
import { db, planRepo, itemRepo } from '@/db/repos';
import { deleteRecord } from '@/db/sync';
import type { ID, Item, ItemStatus } from '@/types/domain';
import type { ItemCreateInput } from '@/db/repos/types';
import { newId } from '@/lib/id';

export interface DraftItemInit {
  title?: string;
  description?: string;
  status?: ItemStatus;
  dueDate?: string;
  order?: number;
  checked?: boolean;
}

export interface UseItemCRUDResult {
  /** 新增事项：推 item + 同步 plan.itemIds + recomputeProgress。 */
  add: (init?: DraftItemInit) => Promise<Item>;
  /** 仅 patch 字段（id / planId / createdAt / 时间戳不会被覆盖）。 */
  update: (itemId: ID, patch: Partial<Item>) => Promise<void>;
  /** 删 item + 从 plan.itemIds 移除 + recomputeProgress。 */
  remove: (itemId: ID) => Promise<void>;
  /** 设置状态：todo / doing / done（同步触发 recompute）。 */
  setStatus: (itemId: ID, status: ItemStatus) => Promise<void>;
  /** 切换 done ⇄ todo（保留 useToggleItem 兼容语义）。 */
  toggle: (itemId: ID) => Promise<void>;
  /** 拖拽后批量回写 order。 */
  reorder: (orderedIds: ID[]) => Promise<void>;
}

const nowISO = (): string => new Date().toISOString();

/**
 * 把 item 同步追加到 plan.itemIds。
 * 用单独 put 即可：plan.itemIds 是数组字段，覆盖式 put 不影响其它字段。
 */
const appendItemIdToPlan = async (planId: ID, itemId: ID): Promise<void> => {
  const plan = await db.plans.get(planId);
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }
  if (plan.itemIds.includes(itemId)) return;
  const next = [...plan.itemIds, itemId];
  await db.plans.put({ ...plan, itemIds: next, updatedAt: nowISO() });
};

const removeItemIdFromPlan = async (planId: ID, itemId: ID): Promise<void> => {
  const plan = await db.plans.get(planId);
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }
  if (!plan.itemIds.includes(itemId)) return;
  const next = plan.itemIds.filter((id) => id !== itemId);
  await db.plans.put({ ...plan, itemIds: next, updatedAt: nowISO() });
};

/**
 * useItemCRUD(planId) - 返回 6 个方法。
 *
 * @param planId 计划 ID（空串或 undefined 时所有方法变成 noop + 抛错）
 */
export function useItemCRUD(planId: ID | null | undefined): UseItemCRUDResult {
  const safePlanId = planId ?? '';

  /** 校验 planId 合法；用于每个写方法的入口检查。 */
  const ensurePlan = useCallback((): ID => {
    if (!safePlanId) {
      throw new Error('useItemCRUD: planId is required');
    }
    return safePlanId;
  }, [safePlanId]);

  const add = useCallback(
    async (init: DraftItemInit = {}): Promise<Item> => {
      const pid = ensurePlan();
      // 1. 算 order：plan.itemIds.length 即可（按追加顺序）
      const plan = await db.plans.get(pid);
      if (!plan) {
        throw new Error(`Plan not found: ${pid}`);
      }
      const order = init.order ?? plan.itemIds.length;
      const now = nowISO();
      const item: Item = {
        id: newId(),
        planId: pid,
        title: init.title ?? '',
        description: init.description,
        status: init.status ?? 'todo',
        checked: init.checked ?? (init.status === 'done'),
        dueDate: init.dueDate,
        order,
        createdAt: now,
        updatedAt: now,
        completedAt: init.status === 'done' ? now : undefined,
      };
      // 单事务：写 item + 同步 plan.itemIds
      await db.transaction('rw', db.items, db.plans, async () => {
        await db.items.add(item);
        await appendItemIdToPlan(pid, item.id);
      });
      // 重算 progress
      await planRepo.recomputeProgress(pid);
      return item;
    },
    [ensurePlan],
  );

  const update = useCallback(
    async (itemId: ID, patch: Partial<Item>): Promise<void> => {
      const pid = ensurePlan();
      const existing = await db.items.get(itemId);
      if (!existing) {
        throw new Error(`Item not found: ${itemId}`);
      }
      if (existing.planId !== pid) {
        throw new Error(`Item ${itemId} does not belong to plan ${pid}`);
      }
      // 禁止改 planId / createdAt；其余字段允许
      const sanitized: Partial<Item> = { ...patch };
      delete (sanitized as Partial<Item> & { planId?: ID }).planId;
      delete (sanitized as Partial<Item> & { createdAt?: string }).createdAt;
      const merged: Item = { ...existing, ...sanitized, id: itemId, updatedAt: nowISO() };
      await db.items.put(merged);
      // progress 可能在 status/done 变化时改变，统一重算
      if (
        patch.status !== undefined ||
        patch.checked !== undefined ||
        patch.title !== undefined
      ) {
        await planRepo.recomputeProgress(pid);
      }
    },
    [ensurePlan],
  );

  const remove = useCallback(
    async (itemId: ID): Promise<void> => {
      const pid = ensurePlan();
      const existing = await db.items.get(itemId);
      if (!existing) {
        // 已删除视为幂等成功
        return;
      }
      if (existing.planId !== pid) {
        throw new Error(`Item ${itemId} does not belong to plan ${pid}`);
      }
      // 单事务：删 item + 同步 plan.itemIds
      await db.transaction('rw', db.items, db.plans, db.tombstones, async () => {
        await deleteRecord(db, 'items', itemId);
        await removeItemIdFromPlan(pid, itemId);
      });
      // 重算 progress（删除可能改变比例）
      await planRepo.recomputeProgress(pid);
    },
    [ensurePlan],
  );

  const setStatus = useCallback(
    async (itemId: ID, status: ItemStatus): Promise<void> => {
      const pid = ensurePlan();
      // 复用 itemRepo.setStatus（已实现事务 + recompute）
      await itemRepo.setStatus(itemId, status);
      // 静默确保 planId 一致；不一致抛错
      const item = await db.items.get(itemId);
      if (item && item.planId !== pid) {
        throw new Error(`Item ${itemId} does not belong to plan ${pid}`);
      }
    },
    [ensurePlan],
  );

  const toggle = useCallback(
    async (itemId: ID): Promise<void> => {
      const pid = ensurePlan();
      await itemRepo.toggle(itemId);
      const item = await db.items.get(itemId);
      if (item && item.planId !== pid) {
        throw new Error(`Item ${itemId} does not belong to plan ${pid}`);
      }
    },
    [ensurePlan],
  );

  const reorder = useCallback(
    async (orderedIds: ID[]): Promise<void> => {
      const pid = ensurePlan();
      await itemRepo.reorder(pid, orderedIds);
    },
    [ensurePlan],
  );

  return { add, update, remove, setStatus, toggle, reorder };
}

// 同时暴露类型，便于外部复用
export type { ItemCreateInput };
