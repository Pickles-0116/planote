/**
 * SkillRepository（v1.3 S 模块：技能管理）
 *
 * 与 BlogTemplateRepo 解耦：技能是「对话内可 @ 调用的轻量 prompt 模板」。
 * 所有数据访问都经由此 repo，features/pages 禁止直接 import db。
 */

import type { ID, Skill, SkillType, ISODate } from '@/types/domain';
import type { PlanoteDB } from '../schema';
import { newId } from '@/lib/id';
import { makeTombstone } from '../sync/tombstones';

export const ROOT_SKILL_FOLDER_ID = '__root_skill__';

const now = (): ISODate => new Date().toISOString();

export class SkillRepo {
  constructor(private db: PlanoteDB) {}

  async list(): Promise<Skill[]> {
    const all = await this.db.skills.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'));
  }

  /** 按文件夹过滤（ROOT_SKILL_FOLDER_ID 表示全部）。 */
  async listByFolder(folderId: ID): Promise<Skill[]> {
    const all = await this.list();
    if (folderId === ROOT_SKILL_FOLDER_ID) return all;
    return all.filter((s) => s.folderId === folderId);
  }

  async get(id: ID): Promise<Skill | undefined> {
    return this.db.skills.get(id);
  }

  async create(input: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'useCount'> & Partial<Pick<Skill, 'useCount'>>): Promise<Skill> {
    const ts = now();
    const skill: Skill = {
      id: newId(),
      createdAt: ts,
      updatedAt: ts,
      useCount: input.useCount ?? 0,
      ...input,
    };
    await this.db.skills.put(skill);
    return skill;
  }

  async update(id: ID, patch: Partial<Skill>): Promise<Skill> {
    const existing = await this.db.skills.get(id);
    if (!existing) throw new Error(`Skill not found: ${id}`);
    const updated: Skill = { ...existing, ...patch, id, updatedAt: now() };
    await this.db.skills.put(updated);
    return updated;
  }

  async remove(id: ID): Promise<void> {
    await this.db.transaction('rw', this.db.skills, this.db.tombstones, async () => {
      await this.db.skills.delete(id);
      // 物理删除 + 写墓碑
      await this.db.tombstones.put(makeTombstone('skills', id));
    });
  }

  async incrementUseCount(id: ID): Promise<void> {
    const existing = await this.db.skills.get(id);
    if (!existing) return;
    await this.db.skills.put({ ...existing, useCount: existing.useCount + 1, updatedAt: now() });
  }

  /** 批量导入（覆盖写，id 由调用方决定；用于 JSON 导入）。 */
  async bulkPut(skills: Skill[]): Promise<void> {
    await this.db.skills.bulkPut(skills);
  }

  /** 批量删除（按 id），物理删除 + 写墓碑（跨设备删除传播）。 */
  async bulkRemove(ids: ID[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.transaction('rw', this.db.skills, this.db.tombstones, async () => {
      await this.db.skills.bulkDelete(ids);
      for (const id of ids) {
        await this.db.tombstones.put(makeTombstone('skills', id));
      }
    });
  }
}

import { db as defaultDb } from '../index';
export const createSkillRepo = (database: PlanoteDB = defaultDb): SkillRepo => new SkillRepo(database);

/** 导出时剔除内部字段（与导入互逆）。 */
export function toExportSkill(s: Skill): Record<string, unknown> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, status: _status, rawText: _rawText, ...rest } = s;
  return rest;
}

/** 导入时把外部记录归一化为本地 Skill（重建 id / 时间戳）。 */
export function fromExportSkill(raw: Record<string, unknown>, folderMap: Map<ID, ID>): Skill {
  const ts = now();
  const folderId = typeof raw.folderId === 'string' && folderMap.has(raw.folderId)
    ? (folderMap.get(raw.folderId) as ID)
    : ROOT_SKILL_FOLDER_ID;
  return {
    id: newId(),
    name: String(raw.name ?? '未命名技能'),
    description: raw.description != null ? String(raw.description) : undefined,
    type: (raw.type as SkillType) ?? 'custom',
    folderId,
    builtin: Boolean(raw.builtin ?? false),
    promptTemplate: String(raw.promptTemplate ?? ''),
    params: Array.isArray(raw.params) ? (raw.params as Skill['params']) : [],
    useCount: Number(raw.useCount ?? 0),
    createdAt: ts,
    updatedAt: ts,
  };
}
