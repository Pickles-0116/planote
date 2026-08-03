/**
 * v6 → v7 迁移测试（M1 / T1.1 / T1.5）
 *
 * 验证：旧库（v6）中缺失时间戳的 tags / frameworks 在升级到 v7 时被正确兜底回填，
 * 且墓碑（tombstones）/ 变更队列（changeQueue）两张旁路表被创建。
 *
 * 运行：`pnpm test src/db/sync/__tests__/migration.test.ts`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { PlanoteDB } from '../../schema';
import { newId } from '@/lib/id';
import type { ID, Plan, Item, Blog, Tag, Attachment, Framework, BlogTemplate, AICallLog, Collection, CollectionItem, ChatSession, Folder, SkillFolder, Skill, AIPlan } from '@/types/domain';
import type { MetaRow } from '../../schema';

/**
 * 仅声明到 v6 的最小数据库，用于模拟「升级前」的线上库。
 * 其 v6 store 声明与 schema.ts 的 v6 完全一致，保证升级时 schema 对齐。
 */
class V6DB extends Dexie {
  declare plans: Table<Plan, ID>;
  declare items: Table<Item, ID>;
  declare blogs: Table<Blog, ID>;
  declare tags: Table<Tag, ID>;
  declare attachments: Table<Attachment, ID>;
  declare frameworks: Table<Framework, ID>;
  declare blogTemplates: Table<BlogTemplate, ID>;
  declare aiCallLogs: Table<AICallLog, ID>;
  declare collections: Table<Collection, ID>;
  declare collectionItems: Table<CollectionItem, ID>;
  declare chatSessions: Table<ChatSession, ID>;
  declare folders: Table<Folder, ID>;
  declare skillFolders: Table<SkillFolder, ID>;
  declare skills: Table<Skill, ID>;
  declare aiPlans: Table<AIPlan, ID>;
  declare meta: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(6).stores({
      plans: '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items: '&id, planId, status, dueDate, order, [planId+order]',
      blogs: '&id, status, sourcePlanId, frameworkId, templateId, folderId, updatedAt, *tagIds, *attachmentIds',
      tags: '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks: '&id, category, builtin',
      blogTemplates: '&id, category, builtin, useCount, updatedAt, *tagIds',
      aiCallLogs: '&id, modelProfileId, mode, createdAt',
      collections: '&id, name, sortOrder',
      collectionItems: '&id, collectionId, entityType, entityId, [collectionId+entityType]',
      chatSessions: '&id, updatedAt, createdAt',
      folders: '&id, parentId, type, depth, order, blogCount',
      skillFolders: '&id, parentId, depth, order',
      skills: '&id, type, folderId, builtin, useCount, updatedAt',
      aiPlans: '&id, sourceSessionId, updatedAt',
      meta: '&key',
    });
  }
}

const DB_NAME = `test-migration-${Math.random().toString(36).slice(2)}`;
const LEGACY_TAG_CREATED = '2020-01-01T00:00:00.000Z';
const LEGACY_TAG_UPDATED = '2021-01-01T00:00:00.000Z';

describe('v6 → v7 时间戳回填迁移', () => {
  beforeEach(async () => {
    // 每个用例前用 v6 库重建一份「升级前」数据
    indexedDB.deleteDatabase(DB_NAME);
  });

  it('tags 缺失 updatedAt 时按 createdAt 兜底；已有 updatedAt 则保留', async () => {
    const v6 = new V6DB(DB_NAME);
    await v6.open();
    // 模拟旧数据：tag 无 updatedAt；另一条已有 updatedAt
    await v6.tags.bulkAdd([
      { id: newId(), name: 'legacy-no-updated', usageCount: 0, createdAt: LEGACY_TAG_CREATED } as unknown as Tag,
      { id: newId(), name: 'legacy-has-updated', usageCount: 0, createdAt: LEGACY_TAG_CREATED, updatedAt: LEGACY_TAG_UPDATED } as unknown as Tag,
    ]);
    await v6.close();

    // 用当前 schema 打开 → 触发 v6 → v7 升级
    const db = new PlanoteDB(DB_NAME);
    await db.open();

    const tags = await db.tags.toArray();
    expect(tags.length).toBe(2);

    const noUpdated = tags.find((t) => t.name === 'legacy-no-updated')!;
    // 缺失 updatedAt → 回退到 createdAt
    expect(noUpdated.updatedAt).toBe(LEGACY_TAG_CREATED);

    const hasUpdated = tags.find((t) => t.name === 'legacy-has-updated')!;
    // 已有 updatedAt → 不被覆盖
    expect(hasUpdated.updatedAt).toBe(LEGACY_TAG_UPDATED);

    await db.close();
  });

  it('frameworks 缺失 createdAt/updatedAt 时均兜底为升级时刻（两者相等）', async () => {
    const v6 = new V6DB(DB_NAME);
    await v6.open();
    await v6.frameworks.bulkAdd([
      { id: newId(), name: 'fw-legacy', category: 'cat', builtin: false } as unknown as Framework,
    ]);
    await v6.close();

    const db = new PlanoteDB(DB_NAME);
    await db.open();

    const fws = await db.frameworks.toArray();
    expect(fws.length).toBe(1);
    const fw = fws[0];
    // 两个时间戳都被回填且相等（同一 now 兜底）
    expect(typeof fw.createdAt).toBe('string');
    expect(typeof fw.updatedAt).toBe('string');
    expect(fw.createdAt).toBe(fw.updatedAt);
    expect(() => new Date(fw.createdAt).toISOString()).not.toThrow();

    await db.close();
  });

  it('升级后创建墓碑与变更队列两张旁路表', async () => {
    const v6 = new V6DB(DB_NAME);
    await v6.open();
    await v6.tags.bulkAdd([{ id: newId(), name: 't', usageCount: 0, createdAt: LEGACY_TAG_CREATED } as unknown as Tag]);
    await v6.close();

    const db = new PlanoteDB(DB_NAME);
    await db.open();

    // 表可访问且有索引
    expect(typeof db.tombstones.put).toBe('function');
    expect(typeof db.changeQueue.put).toBe('function');
    // 初始为空
    expect(await db.tombstones.count()).toBe(0);
    expect(await db.changeQueue.count()).toBe(0);

    await db.close();
  });
});
