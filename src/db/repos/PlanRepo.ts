/**
 * PlanRepository 实现
 *
 * 关键规则（tasks.md 3.1 + spec.md Requirement: Plan 数据模型）：
 * - list 默认按 createdAt 降序
 * - get 不存在抛 NOT_FOUND（实际返回 undefined，由调用方决定）
 * - create 自动填 id / createdAt / updatedAt / urgency，progress = 0
 * - update 自动刷 updatedAt；改 endDate / status 时刷 urgency
 * - delete 事务内 cascade 删 items；blog.sourcePlanId 置空
 * - bulkUpdate 事务内批量更新
 * - recomputeProgress 重算 progress + urgency 缓存
 */

import type { ID, Plan, ISODate } from '@/types/domain';
import type {
  PlanRepository,
  PlanCreateInput,
  PlanUpdatePatch,
  QueryOptions,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import { computeUrgency } from '@/shared/utils/urgency';
import { computeProgress } from '@/shared/utils/progress';
import type { PlanoteDB } from '../schema';
import { makeTombstone } from '../sync/tombstones';

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Plan not found: ${id}`,
  };
  throw new AppError(payload);
};

/** 类型守卫：把 `Plan | undefined` 收敛为 `Plan`，未通过则抛 NOT_FOUND。 */
const requirePlan = async (
  db: PlanoteDB,
  id: ID,
): Promise<Plan> => {
  const plan = await db.plans.get(id);
  if (plan === undefined) throwNotFound(id);
  return plan as Plan;
};

/** ISO 时间字符串（无毫秒，UTC）。 */
const nowISO = (): ISODate => new Date().toISOString();

export class PlanRepo implements PlanRepository {
  constructor(private db: PlanoteDB) {}

  async list(opts?: QueryOptions<Plan>): Promise<Plan[]> {
    let rows: Plan[];
    if (opts?.filter) {
      // 走 filter API
      const filter = opts.filter;
      rows = await this.db.plans
        .filter((p) => {
          for (const [k, v] of Object.entries(filter)) {
            const actual = (p as unknown as Record<string, unknown>)[k];
            if (v === undefined) continue;
            if (
              v !== null &&
              typeof v === 'object' &&
              ('$in' in v || '$ne' in v)
            ) {
              const ops = v as { $in?: unknown[]; $ne?: unknown };
              if (ops.$in && !ops.$in.includes(actual)) return false;
              if (ops.$ne !== undefined && actual === ops.$ne) return false;
            } else if (actual !== v) {
              return false;
            }
          }
          return true;
        })
        .toArray();
    } else {
      rows = await this.db.plans.toArray();
    }

    // 排序：默认 createdAt desc
    const sort = opts?.sort;
    if (!sort || sort.length === 0) {
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } else {
      rows.sort((a, b) => {
        for (const s of sort) {
          const av = a[s.field];
          const bv = b[s.field];
          if (av === bv) continue;
          const cmp = av! < bv! ? -1 : 1;
          return s.order === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    if (opts?.pagination) {
      const { offset, limit } = opts.pagination;
      rows = rows.slice(offset, offset + limit);
    }
    return rows;
  }

  async get(id: ID): Promise<Plan | undefined> {
    return this.db.plans.get(id);
  }

  async create(input: PlanCreateInput): Promise<Plan> {
    const now = nowISO();
    const plan: Plan = {
      ...input,
      id: newId(),
      // 必填默认
      tagIds: input.tagIds ?? [],
      itemIds: input.itemIds ?? [],
      blogIds: input.blogIds ?? [],
      childPlanIds: input.childPlanIds ?? [],
      // 派生字段
      progress: 0,
      urgency: computeUrgency(
        { endDate: input.endDate, status: input.status },
        new Date(now).getTime(),
      ),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.plans.add(plan);
    return plan;
  }

  async update(id: ID, patch: PlanUpdatePatch): Promise<Plan> {
    const existing = await requirePlan(this.db, id);
    const now = nowISO();
    // patch 是 Partial<Plan>（含可选字段），existing 是完整 Plan；合并后仍是 Plan。
    // 显式断言：patch 只覆盖 existing 已有字段，且 id / updatedAt 由我们补全。
    const merged = { ...existing, ...patch, id, updatedAt: now } as Plan;

    // 修改 endDate / status 时刷 urgency
    if (patch.endDate !== undefined || patch.status !== undefined) {
      merged.urgency = computeUrgency(
        { endDate: merged.endDate, status: merged.status },
        new Date(now).getTime(),
      );
    }
    // status 变 done 填 completedAt
    if (patch.status === 'done' && existing.status !== 'done') {
      merged.completedAt = now;
    }
    // status 离开 done 清 completedAt
    if (patch.status !== undefined && patch.status !== 'done' && existing.status === 'done') {
      merged.completedAt = undefined;
    }

    await this.db.plans.put(merged);
    return merged;
  }

  async delete(id: ID): Promise<void> {
    // 存在性校验（不存在抛 NOT_FOUND）
    await requirePlan(this.db, id);

    // 先收集将被级联删除的 items（用于写墓碑），避免在事务内二次查询
    const cascadedItems = await this.db.items
      .where('planId')
      .equals(id)
      .toArray();

    await this.db.transaction(
      'rw',
      this.db.plans,
      this.db.items,
      this.db.blogs,
      this.db.tombstones,
      async () => {
        // 1. cascade 删 items + 写墓碑
        for (const it of cascadedItems) {
          await this.db.items.delete(it.id);
          await this.db.tombstones.put(makeTombstone('items', it.id));
        }
        // 2. blog.sourcePlanId 置空（保留博客内容，不写墓碑）
        const relatedBlogs = await this.db.blogs
          .where('sourcePlanId')
          .equals(id)
          .toArray();
        for (const b of relatedBlogs) {
          await this.db.blogs.put({ ...b, sourcePlanId: undefined });
        }
        // 3. 删 plan + 写墓碑
        await this.db.plans.delete(id);
        await this.db.tombstones.put(makeTombstone('plans', id));
      },
    );
  }

  async bulkUpdate(ids: ID[], patch: PlanUpdatePatch): Promise<Plan[]> {
    if (ids.length === 0) return [];
    return this.db.transaction('rw', this.db.plans, async () => {
      const now = nowISO();
      const updated: Plan[] = [];
      for (const id of ids) {
        const existing = await this.db.plans.get(id);
        if (!existing) continue;
        const merged: Plan = { ...existing, ...patch, id, updatedAt: now };
        if (patch.endDate !== undefined || patch.status !== undefined) {
          merged.urgency = computeUrgency(
            { endDate: merged.endDate, status: merged.status },
            new Date(now).getTime(),
          );
        }
        await this.db.plans.put(merged);
        updated.push(merged);
      }
      return updated;
    });
  }

  async recomputeProgress(planId: ID): Promise<number> {
    const plan = await requirePlan(this.db, planId);
    const items = await this.db.items.where('planId').equals(planId).toArray();
    const progress = computeProgress(items);
    const now = new Date().toISOString();
    const urgency = computeUrgency(
      { endDate: plan.endDate, status: plan.status },
      new Date(now).getTime(),
    );
    await this.db.plans.put({ ...plan, progress, urgency, updatedAt: now });
    return progress;
  }
}

// 默认工厂：生产代码零参调用
import { db as defaultDb } from '../index';
export const createPlanRepo = (database: PlanoteDB = defaultDb): PlanRepo =>
  new PlanRepo(database);
