/**
 * TagRepository 实现
 *
 * 关键规则（tasks.md 3.5 + spec.md Requirement: Tag 多对多关联）：
 * - list 按 usageCount 降序
 * - create 唯一 name 冲突抛 CONFLICT
 * - delete 事务内 cascade 从所有 Plan / Blog 的 tagIds 移除
 */

import type { ID, Tag, ISODate } from '@/types/domain';
import type {
  TagRepository,
  TagCreateInput,
  TagUpdatePatch,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import type { PlanoteDB } from '../schema';
import { makeTombstone } from '../sync/tombstones';

const nowISO = (): ISODate => new Date().toISOString();

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Tag not found: ${id}`,
  };
  throw new AppError(payload);
};

const throwConflict = (msg: string): never => {
  const payload: AppErrorPayload = { code: 'CONFLICT', message: msg };
  throw new AppError(payload);
};

export class TagRepo implements TagRepository {
  constructor(private db: PlanoteDB) {}

  async list(): Promise<Tag[]> {
    const all = await this.db.tags.toArray();
    return all.sort((a, b) => b.usageCount - a.usageCount);
  }

  async create(input: TagCreateInput): Promise<Tag> {
    // 唯一 name 校验（`&name` 索引重复会抛 ConstraintError）
    const existing = await this.db.tags.where('name').equals(input.name).first();
    if (existing) {
      throwConflict(`Tag name already exists: ${input.name}`);
    }
    const tag: Tag = {
      ...input,
      id: newId(),
      usageCount: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    try {
      await this.db.tags.add(tag);
    } catch (e) {
      // 兜底：极端并发情况下 Dexie `&name` 唯一索引仍可能抛错
      if (e instanceof Error && /ConstraintError|unique/i.test(e.message)) {
        throwConflict(`Tag name already exists: ${input.name}`);
      }
      throw e;
    }
    return tag;
  }

  async update(id: ID, patch: TagUpdatePatch): Promise<Tag> {
    const tag = await this.db.tags.get(id);
    if (!tag) throwNotFound(id);
    const existing = tag!; // type narrowing after throwNotFound

    // 名称唯一性校验（排除自身）
    if (patch.name !== undefined && patch.name !== existing.name) {
      const dup = await this.db.tags.where('name').equals(patch.name).first();
      if (dup) {
        throwConflict(`Tag name already exists: ${patch.name}`);
      }
    }

    const merged = { ...existing, ...patch, id, updatedAt: nowISO() } as Tag;
    await this.db.tags.put(merged);
    return merged;
  }

  async delete(id: ID): Promise<void> {
    const tag = await this.db.tags.get(id);
    if (!tag) throwNotFound(id);

    await this.db.transaction(
      'rw',
      this.db.tags,
      this.db.plans,
      this.db.blogs,
      this.db.tombstones,
      async () => {
        // 1. 从所有 Plan 的 tagIds 移除
        const relatedPlans = await this.db.plans
          .where('tagIds')
          .equals(id)
          .toArray();
        for (const p of relatedPlans) {
          await this.db.plans.put({
            ...p,
            tagIds: p.tagIds.filter((t) => t !== id),
            updatedAt: nowISO(),
          });
        }

        // 2. 从所有 Blog 的 tagIds 移除
        const relatedBlogs = await this.db.blogs
          .where('tagIds')
          .equals(id)
          .toArray();
        for (const b of relatedBlogs) {
          await this.db.blogs.put({
            ...b,
            tagIds: b.tagIds.filter((t) => t !== id),
            updatedAt: nowISO(),
          });
        }

        // 3. 删 tag + 写墓碑（物理删除 + 墓碑传播，见 design.md §4.5）
        await this.db.tags.delete(id);
        await this.db.tombstones.put(makeTombstone('tags', id));
      },
    );
  }

  async getByName(name: string): Promise<Tag | undefined> {
    return this.db.tags.where('name').equals(name).first();
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createTagRepo = (database: PlanoteDB = defaultDb): TagRepo =>
  new TagRepo(database);
