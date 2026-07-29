/**
 * BlogRepository 实现
 *
 * 关键规则（tasks.md 3.3 + spec.md Requirement: Blog 数据模型）：
 * - list 默认按 updatedAt 降序
 * - update 改 status 为 'published' 时自动填 publishedAt
 * - duplicate：title 加 (副本)，status='draft'，sourcePlanId/frameworkId/attachmentIds 清空
 * - search 子串匹配 title 或 contentText（不区分大小写）
 */

import type { ID, Blog, ISODate, TiptapJSON } from '@/types/domain';
import type {
  BlogRepository,
  BlogCreateInput,
  QueryOptions,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import { ROOT_FOLDER_ID } from '@/features/folders/constants';
import type { PlanoteDB } from '../schema';

const nowISO = (): ISODate => new Date().toISOString();

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Blog not found: ${id}`,
  };
  throw new AppError(payload);
};

const requireBlog = async (db: PlanoteDB, id: ID): Promise<Blog> => {
  const blog = await db.blogs.get(id);
  if (blog === undefined) throwNotFound(id);
  return blog as Blog;
};

/** 抽取博客的纯文本（用于 contentText 默认值与 search 匹配）。 */
const extractText = (node: TiptapJSON | undefined): string => {
  if (!node) return '';
  const parts: string[] = [];
  const walk = (n: TiptapJSON | { type: string; text?: string; content?: unknown[] }): void => {
    const maybe = n as { text?: string; content?: unknown[] };
    if (typeof maybe.text === 'string') parts.push(maybe.text);
    if (Array.isArray(maybe.content)) {
      for (const child of maybe.content) walk(child as TiptapJSON);
    }
  };
  walk(node);
  return parts.join(' ').trim();
};

export class BlogRepo implements BlogRepository {
  constructor(private db: PlanoteDB) {}

  async list(opts?: QueryOptions<Blog>): Promise<Blog[]> {
    let rows: Blog[];
    if (opts?.filter) {
      const filter = opts.filter;
      rows = await this.db.blogs
        .filter((b) => {
          for (const [k, v] of Object.entries(filter)) {
            const actual = (b as unknown as Record<string, unknown>)[k];
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
      rows = await this.db.blogs.toArray();
    }

    // 默认按 updatedAt desc
    const sort = opts?.sort;
    if (!sort || sort.length === 0) {
      rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
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

  async get(id: ID): Promise<Blog | undefined> {
    return this.db.blogs.get(id);
  }

  async listByIds(ids: ID[]): Promise<Blog[]> {
    if (ids.length === 0) return [];
    // bulkGet 按入参顺序返回，已存在的填 Blog、不存在的填 undefined
    const rows = await this.db.blogs.bulkGet(ids);
    return rows.filter((b): b is Blog => b !== undefined);
  }

  async create(input: BlogCreateInput): Promise<Blog> {
    const now = nowISO();
    // contentText 由调用方提供；若没传则从 content 提取
    const contentText = input.contentText ?? extractText(input.content);
    const blog: Blog = {
      ...input,
      id: newId(),
      // 默认值
      tagIds: input.tagIds ?? [],
      attachmentIds: input.attachmentIds ?? [],
      // folderId 永不为 null，缺省指向根文件夹（未分类）
      folderId: input.folderId ?? ROOT_FOLDER_ID,
      contentText,
      // publishedAt 仅当 status === 'published' 时填
      publishedAt: input.status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.blogs.add(blog);
    return blog;
  }

  async update(id: ID, patch: Partial<Blog>): Promise<Blog> {
    const existing = await requireBlog(this.db, id);
    const now = nowISO();
    const merged = { ...existing, ...patch, id, updatedAt: now } as Blog;

    // status 变 published 填 publishedAt
    if (patch.status === 'published' && existing.status !== 'published') {
      merged.publishedAt = now;
    }
    // 改了 content 同步刷 contentText
    if (patch.content !== undefined) {
      merged.contentText = extractText(patch.content);
    }

    await this.db.blogs.put(merged);
    return merged;
  }

  async delete(id: ID): Promise<void> {
    await requireBlog(this.db, id);
    await this.db.blogs.delete(id);
  }

  async duplicate(id: ID): Promise<Blog> {
    const src = await requireBlog(this.db, id);
    const now = nowISO();
    const copy: Blog = {
      ...src,
      id: newId(),
      title: `${src.title}（副本）`,
      status: 'draft',
      // 不复制来源/框架/附件
      sourcePlanId: undefined,
      frameworkId: undefined,
      attachmentIds: [],
      publishedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.blogs.add(copy);
    return copy;
  }

  async archive(id: ID): Promise<Blog> {
    return this.update(id, { status: 'archived' });
  }

  async search(q: string): Promise<Blog[]> {
    const needle = q.toLowerCase();
    const all = await this.db.blogs.toArray();
    return all
      .filter(
        (b) =>
          b.title.toLowerCase().includes(needle) ||
          (b.contentText ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createBlogRepo = (database: PlanoteDB = defaultDb): BlogRepo =>
  new BlogRepo(database);
