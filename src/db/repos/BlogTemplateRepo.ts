/**
 * BlogTemplateRepository 实现
 *
 * - list 默认按 updatedAt 降序
 * - duplicate：name 加"（副本）"
 * - search 子串匹配 name 或 description（不区分大小写）
 */

import type { ID, BlogTemplate, ISODate, TemplateCategory } from '@/types/domain';
import type {
  BlogTemplateRepository,
  BlogTemplateCreateInput,
  QueryOptions,
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
    message: `BlogTemplate not found: ${id}`,
  };
  throw new AppError(payload);
};

const requireTemplate = async (db: PlanoteDB, id: ID): Promise<BlogTemplate> => {
  const tpl = await db.blogTemplates.get(id);
  if (tpl === undefined) throwNotFound(id);
  return tpl as BlogTemplate;
};

export class BlogTemplateRepo implements BlogTemplateRepository {
  constructor(private db: PlanoteDB) {}

  async list(opts?: QueryOptions<BlogTemplate>): Promise<BlogTemplate[]> {
    let rows: BlogTemplate[];
    if (opts?.filter) {
      const filter = opts.filter;
      rows = await this.db.blogTemplates
        .filter((t) => {
          for (const [k, v] of Object.entries(filter)) {
            const actual = (t as unknown as Record<string, unknown>)[k];
            if (v === undefined) continue;
            if (v !== null && typeof v === 'object' && ('$in' in v || '$ne' in v)) {
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
      rows = await this.db.blogTemplates.toArray();
    }

    const sort = opts?.sort;
    if (!sort || sort.length === 0) {
      rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } else {
      rows.sort((a, b) => {
        for (const s of sort) {
          const av = a[s.field as keyof BlogTemplate];
          const bv = b[s.field as keyof BlogTemplate];
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

  async get(id: ID): Promise<BlogTemplate | undefined> {
    return this.db.blogTemplates.get(id);
  }

  async create(input: BlogTemplateCreateInput): Promise<BlogTemplate> {
    const now = nowISO();
    // 名称唯一性校验
    const existing = await this.db.blogTemplates
      .filter((t) => t.name === input.name)
      .first();
    if (existing) {
      throw new AppError({
        code: 'CONFLICT',
        message: `已存在同名模板「${input.name}」，请修改名称`,
      });
    }

    const tpl: BlogTemplate = {
      ...input,
      id: newId(),
      useCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.blogTemplates.add(tpl);
    return tpl;
  }

  async update(id: ID, patch: Partial<BlogTemplate>): Promise<BlogTemplate> {
    const existing = await requireTemplate(this.db, id);
    const now = nowISO();

    // 名称唯一性校验（排除自身）
    if (patch.name !== undefined && patch.name !== existing.name) {
      const dup = await this.db.blogTemplates
        .filter((t) => t.name === patch.name && t.id !== id)
        .first();
      if (dup) {
        throw new AppError({
          code: 'CONFLICT',
          message: `已存在同名模板「${patch.name}」，请修改名称`,
        });
      }
    }

    const merged = { ...existing, ...patch, id, updatedAt: now } as BlogTemplate;
    await this.db.blogTemplates.put(merged);
    return merged;
  }

  async delete(id: ID): Promise<void> {
    await requireTemplate(this.db, id);
    await this.db.transaction(
      'rw',
      this.db.blogTemplates,
      this.db.tombstones,
      async () => {
        await this.db.blogTemplates.delete(id);
        // 物理删除 + 写墓碑
        await this.db.tombstones.put(makeTombstone('blogTemplates', id));
      },
    );
  }

  async duplicate(id: ID): Promise<BlogTemplate> {
    const src = await requireTemplate(this.db, id);
    const now = nowISO();
    const copy: BlogTemplate = {
      ...src,
      id: newId(),
      name: `${src.name}（副本）`,
      useCount: 0,
      lastUsedAt: undefined,
      builtin: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.blogTemplates.add(copy);
    return copy;
  }

  async incrementUseCount(id: ID): Promise<void> {
    const tpl = await this.db.blogTemplates.get(id);
    if (!tpl) return;
    await this.db.blogTemplates.update(id, {
      useCount: (tpl.useCount ?? 0) + 1,
      lastUsedAt: nowISO(),
    });
  }

  async search(q: string): Promise<BlogTemplate[]> {
    const needle = q.toLowerCase();
    const all = await this.db.blogTemplates.toArray();
    return all
      .filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          (t.description ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async listByCategory(category: TemplateCategory): Promise<BlogTemplate[]> {
    return this.db.blogTemplates
      .filter((t) => t.category === category)
      .toArray();
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createBlogTemplateRepo = (database: PlanoteDB = defaultDb): BlogTemplateRepo =>
  new BlogTemplateRepo(database);
