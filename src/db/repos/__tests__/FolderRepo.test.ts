/**
 * FolderRepo 单元测试（V1.2 F1 关键路径 1：删除 re-parent + bumpBlogCount）
 *
 * 使用 vitest + fake-indexeddb 模拟 Dexie。
 * 重点验证：删主文件夹时子文件夹上移、博客 folderId 改派父级（父为 root 即未分类）、
 * 不丢数据、blogCount 正确维护；以及 bumpBlogCount 的增/减/钳制/容错。
 *
 * 运行：`pnpm test src/db/repos/__tests__/FolderRepo.test.ts`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PlanoteDB } from '../../schema';
import { FolderRepo } from '../FolderRepo';
import { AppError } from '../types';
import { ROOT_FOLDER_ID } from '@/features/folders/constants';
import type { Blog, Folder, ID } from '@/types/domain';

const FOLDER_DEFAULTS = {
  name: 'folder',
  type: 'main' as const,
  parentId: '',
  depth: 0,
  order: 0,
  blogCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeFolder(over: Partial<Folder> & { id: ID }): Folder {
  return { ...FOLDER_DEFAULTS, ...over } as Folder;
}

const BLOG_DEFAULTS = {
  title: 'blog',
  content: { type: 'doc' as const, content: [] as never[] },
  contentText: '',
  excerpt: '',
  tagIds: [] as ID[],
  folderId: ROOT_FOLDER_ID,
  attachmentIds: [] as ID[],
  status: 'draft' as const,
  source: 'direct' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeBlog(over: Partial<Blog> & { id: ID }): Blog {
  return { ...BLOG_DEFAULTS, ...over } as Blog;
}

describe('FolderRepo', () => {
  let db: PlanoteDB;
  let repo: FolderRepo;

  beforeEach(async () => {
    db = new PlanoteDB(`test-folders-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new FolderRepo(db);
    // 预置根文件夹（未分类）
    await db.folders.add(
      makeFolder({ id: ROOT_FOLDER_ID, name: '未分类', type: 'root', parentId: '', depth: 0, blogCount: 0 }),
    );
  });

  describe('bumpBlogCount', () => {
    it('正数累加', async () => {
      await repo.bumpBlogCount(ROOT_FOLDER_ID, 3);
      expect((await repo.get(ROOT_FOLDER_ID))!.blogCount).toBe(3);
      await repo.bumpBlogCount(ROOT_FOLDER_ID, 2);
      expect((await repo.get(ROOT_FOLDER_ID))!.blogCount).toBe(5);
    });

    it('负数钳制到 0（不允许负计数）', async () => {
      await repo.bumpBlogCount(ROOT_FOLDER_ID, 5);
      await repo.bumpBlogCount(ROOT_FOLDER_ID, -100);
      expect((await repo.get(ROOT_FOLDER_ID))!.blogCount).toBe(0);
    });

    it('delta=0 为 no-op（不改变计数）', async () => {
      await repo.bumpBlogCount(ROOT_FOLDER_ID, 4);
      await repo.bumpBlogCount(ROOT_FOLDER_ID, 0);
      expect((await repo.get(ROOT_FOLDER_ID))!.blogCount).toBe(4);
    });

    it('目标文件夹不存在时容错不抛错', async () => {
      await expect(repo.bumpBlogCount('no-such-folder', 5)).resolves.toBeUndefined();
    });
  });

  describe('delete 级联 re-parent', () => {
    it('删主文件夹：子日期文件夹上移一层、博客不丢、blogCount 不变', async () => {
      const main = makeFolder({ id: 'F', type: 'main', parentId: ROOT_FOLDER_ID, depth: 1 });
      const d1 = makeFolder({ id: 'D1', type: 'date', parentId: 'F', depth: 2 });
      const d2 = makeFolder({ id: 'D2', type: 'date', parentId: 'F', depth: 2 });
      await db.folders.bulkAdd([main, d1, d2]);

      // 博客都在日期子文件夹里（规范树：root→主→日期）
      const b1 = makeBlog({ id: 'B1', folderId: 'D1' });
      const b2 = makeBlog({ id: 'B2', folderId: 'D1' });
      const b3 = makeBlog({ id: 'B3', folderId: 'D2' });
      await db.blogs.bulkAdd([b1, b2, b3]);

      const rootBefore = (await repo.get(ROOT_FOLDER_ID))!.blogCount;
      await repo.delete('F');

      // 子文件夹上移一层：parentId → root，depth → 1
      const d1After = await repo.get('D1');
      expect(d1After!.parentId).toBe(ROOT_FOLDER_ID);
      expect(d1After!.depth).toBe(1);
      const d2After = await repo.get('D2');
      expect(d2After!.parentId).toBe(ROOT_FOLDER_ID);
      expect(d2After!.depth).toBe(1);

      // 博客不丢，folderId 保持不变（仍在各自日期文件夹内）
      expect(await db.blogs.count()).toBe(3);
      expect((await db.blogs.get('B1'))!.folderId).toBe('D1');
      expect((await db.blogs.get('B2'))!.folderId).toBe('D1');
      expect((await db.blogs.get('B3'))!.folderId).toBe('D2');

      // 被删文件夹已移除
      expect(await repo.get('F')).toBeUndefined();

      // 子树博客未物理迁移 → root.blogCount 不变
      const rootAfter = (await repo.get(ROOT_FOLDER_ID))!.blogCount;
      expect(rootAfter).toBe(rootBefore);
    });

    it('删日期文件夹：其博客改派父主文件夹并维护 blogCount', async () => {
      const main = makeFolder({ id: 'F', type: 'main', parentId: ROOT_FOLDER_ID, depth: 1, blogCount: 0 });
      const d = makeFolder({ id: 'D', type: 'date', parentId: 'F', depth: 2, blogCount: 0 });
      await db.folders.bulkAdd([main, d]);

      const b1 = makeBlog({ id: 'B1', folderId: 'D' });
      const b2 = makeBlog({ id: 'B2', folderId: 'D' });
      await db.blogs.bulkAdd([b1, b2]);

      await repo.delete('D');

      // 日期文件夹已删除
      expect(await repo.get('D')).toBeUndefined();
      // 博客改派到父主文件夹
      expect((await db.blogs.get('B1'))!.folderId).toBe('F');
      expect((await db.blogs.get('B2'))!.folderId).toBe('F');
      // 主文件夹 blogCount +2
      expect((await repo.get('F'))!.blogCount).toBe(2);
      // 无数据丢失
      expect(await db.blogs.count()).toBe(2);
    });

    it('删主文件夹并显式 reparentTo：子目录与直接博客改派到目标主文件夹', async () => {
      const f = makeFolder({ id: 'F', type: 'main', parentId: ROOT_FOLDER_ID, depth: 1, blogCount: 0 });
      const g = makeFolder({ id: 'G', type: 'main', parentId: ROOT_FOLDER_ID, depth: 1, blogCount: 0 });
      const d = makeFolder({ id: 'D', type: 'date', parentId: 'F', depth: 2, blogCount: 0 });
      await db.folders.bulkAdd([f, g, d]);

      const directBlog = makeBlog({ id: 'BD', folderId: 'F' });
      const childBlog = makeBlog({ id: 'DC', folderId: 'D' });
      await db.blogs.bulkAdd([directBlog, childBlog]);

      await repo.delete('F', { reparentTo: 'G' });

      // 子文件夹改派 G，depth 保持 2（≤ 限制）
      const dAfter = await repo.get('D');
      expect(dAfter!.parentId).toBe('G');
      expect(dAfter!.depth).toBe(2);

      // F 的直接博客改派 G；D 内博客仍在 D（D 现在挂在 G 下）
      expect((await db.blogs.get('BD'))!.folderId).toBe('G');
      expect((await db.blogs.get('DC'))!.folderId).toBe('D');

      // G 接收直接迁移的 1 篇 → blogCount=1
      expect((await repo.get('G'))!.blogCount).toBe(1);
      // 无数据丢失
      expect(await db.blogs.count()).toBe(2);
      expect(await repo.get('F')).toBeUndefined();
    });
  });

  describe('delete 边界', () => {
    it('禁止删除根文件夹（抛 VALIDATION）', async () => {
      await expect(repo.delete(ROOT_FOLDER_ID)).rejects.toThrowError(AppError);
      try {
        await repo.delete(ROOT_FOLDER_ID);
      } catch (e) {
        expect((e as AppError).error.code).toBe('VALIDATION');
      }
    });

    it('删除不存在的文件夹抛 NOT_FOUND', async () => {
      await expect(repo.delete('ghost-id')).rejects.toThrowError(AppError);
      try {
        await repo.delete('ghost-id');
      } catch (e) {
        expect((e as AppError).error.code).toBe('NOT_FOUND');
      }
    });
  });
});
