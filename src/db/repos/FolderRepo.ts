/**
 * FolderRepository 实现（V1.2 F1）
 *
 * 关键规则（design.md §文件夹数据模型）：
 * - 树深上限 2（root → 主 → 日期），`move` / `create` 都会校验。
 * - 删除主文件夹：子文件夹上移一层、博客 folderId 改派父级（父为 root 即未分类）。
 * - `blogCount` 为缓存值，由 `bumpBlogCount` 在博客增删/移动时维护。
 * - 禁止删除根文件夹。
 */

import type { ID, Folder, ISODate } from '@/types/domain';
import type {
  FolderRepository,
  FolderCreateInput,
  FolderDeleteOptions,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import {
  ROOT_FOLDER_ID,
  ROOT_FOLDER_NAME,
  FOLDER_TREE_DEPTH_LIMIT,
} from '@/features/folders/constants';
import type { PlanoteDB } from '../schema';

const nowISO = (): ISODate => new Date().toISOString();

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = { code: 'NOT_FOUND', message: `Folder not found: ${id}` };
  throw new AppError(payload);
};

const throwValidation = (message: string): never => {
  const payload: AppErrorPayload = { code: 'VALIDATION', message };
  throw new AppError(payload);
};

/** 计算父级 depth（root 的 parentId 为空字符串）。 */
const depthOf = (parent: Folder | undefined): number =>
  parent ? parent.depth + 1 : 0;

export class FolderRepo implements FolderRepository {
  constructor(private db: PlanoteDB) {}

  async list(): Promise<Folder[]> {
    const all = await this.db.folders.toArray();
    return all.sort((a, b) => a.depth - b.depth || a.order - b.order);
  }

  async get(id: ID): Promise<Folder | undefined> {
    return this.db.folders.get(id);
  }

  async create(input: FolderCreateInput): Promise<Folder> {
    const parentId = input.parentId === '' ? '' : input.parentId;
    const parent = parentId ? await this.db.folders.get(parentId) : undefined;

    // root 仅允许存在一个（创建时显式 type==='root' 且 parentId===''）。
    if (input.type === 'root') {
      const existingRoot = await this.db.folders
        .where('type')
        .equals('root')
        .first();
      if (existingRoot) return existingRoot;
    }

    const depth = depthOf(parent);
    if (depth > FOLDER_TREE_DEPTH_LIMIT) {
      throwValidation(`文件夹树深度不能超过 ${FOLDER_TREE_DEPTH_LIMIT} 层`);
    }

    const now = nowISO();
    const folder: Folder = {
      id: newId(),
      name: input.name.trim() || ROOT_FOLDER_NAME,
      type: input.type,
      parentId: parentId ?? '',
      depth,
      order: input.order ?? 0,
      blogCount: input.blogCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.folders.add(folder);
    return folder;
  }

  async update(id: ID, patch: Partial<Folder>): Promise<Folder> {
    const folder = await this.db.folders.get(id);
    if (!folder) throwNotFound(id);
    const merged = { ...folder, ...patch, id, updatedAt: nowISO() } as Folder;
    await this.db.folders.put(merged);
    return merged;
  }

  async delete(id: ID, options?: FolderDeleteOptions): Promise<void> {
    const folder = await this.db.folders.get(id);
    if (!folder) throwNotFound(id);
    if (folder!.type === 'root') {
      throwValidation('根文件夹（未分类）不可删除');
    }

    // 目标父级：显式 reparentTo > 自身父级 > root
    const targetParentId: ID =
      options?.reparentTo ?? folder!.parentId ?? ROOT_FOLDER_ID;

    await this.db.transaction(
      'rw',
      this.db.folders,
      this.db.blogs,
      async () => {
        // 1) 子文件夹上移一层
        const children = await this.db.folders
          .where('parentId')
          .equals(id)
          .toArray();
        for (const child of children) {
          const newDepth = depthOf(await this.db.folders.get(targetParentId));
          await this.db.folders.put({
            ...child,
            parentId: targetParentId,
            depth: newDepth,
            updatedAt: nowISO(),
          });
        }

        // 2) 博客 folderId 改派目标父级
        // 注意：Dexie 的 `update()` 的 UpdateSpec 映射类型无法处理 Blog.content
        // 的递归 TiptapJSON 结构（TS2615），此处改用 read-modify-put。
        const blogs = await this.db.blogs.where('folderId').equals(id).toArray();
        for (const b of blogs) {
          await this.db.blogs.put({ ...b, folderId: targetParentId });
        }

        // 3) 维护 blogCount：博客从被删目录流出 → 目标父级 +movedCount
        if (blogs.length > 0) {
          await this.bumpBlogCount(targetParentId, blogs.length);
        }

        // 4) 删除自身
        await this.db.folders.delete(id);
      },
    );
  }

  async move(id: ID, newParentId: ID): Promise<Folder> {
    if (id === newParentId) {
      const self = await this.db.folders.get(id);
      if (!self) throwNotFound(id);
      return self!;
    }
    const folder = await this.db.folders.get(id);
    if (!folder) throwNotFound(id);
    if (folder!.type === 'root') {
      throwValidation('根文件夹（未分类）不可移动');
    }
    if (newParentId === '') {
      throwValidation('不能移动到空父级');
    }

    // 禁止移入自身子孙
    const isDesc = await this.isDescendant(id, newParentId);
    if (isDesc) {
      throwValidation('不能将文件夹移动到它自己的子目录中');
    }

    const parent = await this.db.folders.get(newParentId);
    const newDepth = depthOf(parent);
    if (newDepth > FOLDER_TREE_DEPTH_LIMIT) {
      throwValidation(`文件夹树深度不能超过 ${FOLDER_TREE_DEPTH_LIMIT} 层`);
    }

    const merged: Folder = {
      ...folder!,
      parentId: newParentId,
      depth: newDepth,
      updatedAt: nowISO(),
    };
    await this.db.folders.put(merged);
    return merged;
  }

  async getPath(id: ID): Promise<Folder[]> {
    const path: Folder[] = [];
    let current: Folder | undefined = await this.db.folders.get(id);
    const guard = new Set<ID>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      path.unshift(current);
      if (!current.parentId) break;
      current = await this.db.folders.get(current.parentId);
    }
    return path;
  }

  async getChildren(parentId: ID): Promise<Folder[]> {
    const children = await this.db.folders
      .where('parentId')
      .equals(parentId)
      .toArray();
    return children.sort((a, b) => a.order - b.order);
  }

  async bumpBlogCount(folderId: ID, delta: number): Promise<void> {
    if (delta === 0) return;
    const folder = await this.db.folders.get(folderId);
    if (!folder) return; // 容错：根目录缺失等情况不抛错
    const next = Math.max(0, (folder.blogCount ?? 0) + delta);
    await this.db.folders.update(folderId, { blogCount: next });
  }

  /** 判断 maybeDescendantId 是否为 ancestorId 的子孙（含自身）。 */
  private async isDescendant(
    ancestorId: ID,
    maybeDescendantId: ID,
  ): Promise<boolean> {
    let current: Folder | undefined = await this.db.folders.get(maybeDescendantId);
    const guard = new Set<ID>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      if (current.id === ancestorId) return true;
      if (!current.parentId) break;
      current = await this.db.folders.get(current.parentId);
    }
    return false;
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createFolderRepo = (database: PlanoteDB = defaultDb): FolderRepo =>
  new FolderRepo(database);
