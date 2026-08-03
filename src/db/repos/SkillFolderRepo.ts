/**
 * SkillFolderRepository（v1.3 S 模块：技能文件夹）
 *
 * 与博客 FolderRepo 严格隔离：独立表、独立树、独立 repo。
 * 根节点「全部技能」用 ROOT_SKILL_FOLDER_ID 表示（不在表中持久化）。
 */

import type { ID, SkillFolder, ISODate } from '@/types/domain';
import type { PlanoteDB } from '../schema';
import { newId } from '@/lib/id';
import { ROOT_SKILL_FOLDER_ID } from './SkillRepo';
import { makeTombstone } from '../sync/tombstones';

const now = (): ISODate => new Date().toISOString();

export class SkillFolderRepo {
  constructor(private db: PlanoteDB) {}

  /** 列出全部文件夹（不含虚拟根）。 */
  async list(): Promise<SkillFolder[]> {
    return this.db.skillFolders.toArray();
  }

  async get(id: ID): Promise<SkillFolder | undefined> {
    return this.db.skillFolders.get(id);
  }

  async create(name: string, parentId: ID = ROOT_SKILL_FOLDER_ID, depth = 0): Promise<SkillFolder> {
    const ts = now();
    const folder: SkillFolder = {
      id: newId(),
      name,
      parentId,
      depth,
      order: await this.nextOrder(parentId),
      createdAt: ts,
      updatedAt: ts,
    };
    await this.db.skillFolders.put(folder);
    return folder;
  }

  async rename(id: ID, name: string): Promise<void> {
    const existing = await this.db.skillFolders.get(id);
    if (!existing) return;
    await this.db.skillFolders.put({ ...existing, name, updatedAt: now() });
  }

  async remove(id: ID): Promise<void> {
    // 删除文件夹时把其下技能移回根（技能仅改派，不删除，故不写墓碑）
    const children = await this.db.skills.where('folderId').equals(id).toArray();
    await this.db.transaction(
      'rw',
      this.db.skills,
      this.db.skillFolders,
      this.db.tombstones,
      async () => {
        for (const s of children) {
          await this.db.skills.put({ ...s, folderId: ROOT_SKILL_FOLDER_ID, updatedAt: now() });
        }
        await this.db.skillFolders.delete(id);
        // 物理删除 + 写墓碑（仅文件夹本身）
        await this.db.tombstones.put(makeTombstone('skillFolders', id));
      },
    );
  }

  private async nextOrder(parentId: ID): Promise<number> {
    const siblings = await this.db.skillFolders.where('parentId').equals(parentId).toArray();
    return siblings.length;
  }
}

import { db as defaultDb } from '../index';
export const createSkillFolderRepo = (database: PlanoteDB = defaultDb): SkillFolderRepo => new SkillFolderRepo(database);
