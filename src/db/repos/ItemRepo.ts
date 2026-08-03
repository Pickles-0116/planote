/**
 * ItemRepository 实现
 *
 * 关键规则（tasks.md 3.2 + spec.md Requirement: Item 数据模型）：
 * - listByPlan 按 `[planId+order]` 复合索引升序
 * - toggle 切换 checked + status + completedAt，**同步**调 PlanRepo.recomputeProgress
 * - create 时 order = max + 1
 * - reorder 事务内重写 order 字段
 * - delete 触发 recomputeProgress（删除未勾选事项 progress 会变）
 */

import type { ID, Item, ISODate, ItemStatus } from '@/types/domain';
import type {
  ItemRepository,
  ItemCreateInput,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import { computeProgress } from '@/shared/utils/progress';
import { computeUrgency } from '@/shared/utils/urgency';
import type { PlanoteDB } from '../schema';
import { makeTombstone } from '../sync/tombstones';
import { createPlanRepo, type PlanRepo } from './PlanRepo';

const nowISO = (): ISODate => new Date().toISOString();

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Item not found: ${id}`,
  };
  throw new AppError(payload);
};

const requireItem = async (db: PlanoteDB, id: ID): Promise<Item> => {
  const item = await db.items.get(id);
  if (item === undefined) throwNotFound(id);
  return item as Item;
};

export class ItemRepo implements ItemRepository {
  constructor(
    private db: PlanoteDB,
    /** PlanRepo 工厂：用于触发 recomputeProgress。默认使用共享 db。 */
    private planRepoFactory: (db: PlanoteDB) => PlanRepo = createPlanRepo,
  ) {}

  async listByPlan(planId: ID): Promise<Item[]> {
    // 走 [planId+order] 复合索引：between 覆盖该 plan 全部 order
    const items = await this.db.items
      .where('[planId+order]')
      .between([planId, -Infinity], [planId, Infinity])
      .toArray();
    return items;
  }

  async list(): Promise<Item[]> {
    // 跨计划全表（add-kanban-board 增量）：看板 / 全局搜索场景
    // 默认按 createdAt desc（最近创建在前）
    const items = await this.db.items.toArray();
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return items;
  }

  async toggle(id: ID): Promise<Item> {
    const item = await requireItem(this.db, id);
    const now = nowISO();
    const willCheck = !item.checked;
    const updated: Item = {
      ...item,
      checked: willCheck,
      status: willCheck ? ('done' as ItemStatus) : ('todo' as ItemStatus),
      completedAt: willCheck ? now : undefined,
      updatedAt: now,
    };
    await this.db.items.put(updated);
    // 同步触发 plan.progress + urgency 重算
    await this.planRepoFactory(this.db).recomputeProgress(item.planId);
    return updated;
  }

  async setStatus(id: ID, status: ItemStatus): Promise<Item> {
    const item = await requireItem(this.db, id);
    const now = nowISO();
    const checked = status === 'done';
    const updated: Item = {
      ...item,
      status,
      checked,
      // 进入 done 时填 completedAt；离开 done 保留历史值（spec Scenario: 从已完成回退）
      completedAt: status === 'done' ? (item.completedAt ?? now) : item.completedAt,
      updatedAt: now,
    };
    await this.db.items.put(updated);
    await this.planRepoFactory(this.db).recomputeProgress(item.planId);
    return updated;
  }

  async create(planId: ID, input: ItemCreateInput): Promise<Item> {
    return this.db.transaction('rw', this.db.items, async () => {
      // order = max + 1
      const maxOrder = await this.db.items
        .where('planId')
        .equals(planId)
        .reverse()
        .sortBy('order');
      const nextOrder = (maxOrder[0]?.order ?? -1) + 1;
      const now = nowISO();
      const item: Item = {
        ...input,
        id: newId(),
        planId,
        order: nextOrder,
        // 默认值
        status: input.status ?? 'todo',
        checked: input.checked ?? false,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.items.add(item);
      return item;
    });
  }

  async reorder(planId: ID, orderedIds: ID[]): Promise<void> {
    await this.db.transaction('rw', this.db.items, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i]!;
        const item = await this.db.items.get(id);
        if (!item || item.planId !== planId) continue;
        await this.db.items.put({ ...item, order: i, updatedAt: nowISO() });
      }
    });
  }

  async delete(id: ID): Promise<void> {
    const item = await requireItem(this.db, id);
    const planId = item.planId;
    // 物理删除 + 写墓碑（同一事务；recomputeProgress 另开事务，避免嵌套）
    await this.db.transaction('rw', this.db.items, this.db.tombstones, async () => {
      await this.db.items.delete(id);
      await this.db.tombstones.put(makeTombstone('items', id));
    });
    // 触发 recomputeProgress（删除后事项 progress 会变化）
    await this.planRepoFactory(this.db).recomputeProgress(planId);
  }

  /**
   * 内部使用：根据 items 列表 + plan 信息刷新缓存。
   * （与 PlanRepo.recomputeProgress 协同，但避免循环 import 时也能调用。）
   */
  async _internalRecomputePlan(planId: ID): Promise<void> {
    const plan = await this.db.plans.get(planId);
    if (!plan) return;
    const items = await this.db.items.where('planId').equals(planId).toArray();
    const progress = computeProgress(items);
    const now = nowISO();
    const urgency = computeUrgency(
      { endDate: plan.endDate, status: plan.status },
      new Date(now).getTime(),
    );
    await this.db.plans.put({ ...plan, progress, urgency, updatedAt: now });
  }
}

// 默认工厂：生产代码零参调用
import { db as defaultDb } from '../index';
export const createItemRepo = (
  database: PlanoteDB = defaultDb,
): ItemRepo => new ItemRepo(database, createPlanRepo);
