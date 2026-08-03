/**
 * Dexie Schema 定义
 *
 * v1.4-Unify + v1.4-Organize：10 张业务表 + 1 张 meta 表，共 11 张。
 * 新增 collections（收藏夹）+ collectionItems（关联记录）。
 * blogTemplates 加 *tagIds 多值索引。
 *
 * 索引含义：
 * - `&` 前缀 = unique
 * - `*` 前缀 = multiEntry（数组每个元素分别建索引）
 * - `[a+b]` = 复合索引
 */

import Dexie, { type Table } from 'dexie';
import type {
  ID,
  Plan,
  Item,
  Blog,
  Tag,
  Attachment,
  Framework,
  BlogTemplate,
  AICallLog,
  Collection,
  CollectionItem,
  ChatSession,
  Folder,
  Skill,
  SkillFolder,
  AIPlan,
} from '@/types/domain';
import type { Tombstone, ChangeQueueItem } from './sync/types';

/** Meta 表行结构：键值对（如 `{ key: 'seeded', value: true }`）。 */
export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Planote Dexie 数据库。
 *
 * 默认数据库名 `planote`，可在测试时通过 `new PlanoteDB('test')` 覆盖。
 */
export class PlanoteDB extends Dexie {
  // 10 张业务表
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

  // 同步层（旁路，主链路零感知）
  /** 墓碑：删除意图传播（表名 + 主键 + 删除时间）。见 design.md §4.5。 */
  declare tombstones: Table<Tombstone, ID>;
  /** 变更队列：待推送的本地变更，跨会话保留（设备私有）。见 design.md §4.1。 */
  declare changeQueue: Table<ChangeQueueItem, ID>;

  // 1 张 meta 表（seed 标记、用户设置、同步游标等）
  declare meta: Table<MetaRow, string>;

  constructor(name: string = 'planote') {
    super(name);

    // v1.0 初始 schema
    this.version(1).stores({
      plans: '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items: '&id, planId, status, dueDate, order, [planId+order]',
      blogs: '&id, status, sourcePlanId, frameworkId, updatedAt, *tagIds, *attachmentIds',
      tags: '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks: '&id, category, builtin',
      meta: '&key',
    });

    // v1.3-AI：完整 schema（新增 blogTemplates + aiCallLogs，blogs 加 templateId）
    this.version(2).stores({
      plans: '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items: '&id, planId, status, dueDate, order, [planId+order]',
      blogs: '&id, status, sourcePlanId, frameworkId, templateId, updatedAt, *tagIds, *attachmentIds',
      tags: '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks: '&id, category, builtin',
      blogTemplates: '&id, category, builtin, useCount, updatedAt',
      aiCallLogs: '&id, modelProfileId, mode, createdAt',
      meta: '&key',
    });

    // v1.4-Organize：完整 schema（Dexie 要求每个 version 声明全部表，未列出的表会被删除）
    this.version(3).stores({
      plans: '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items: '&id, planId, status, dueDate, order, [planId+order]',
      blogs: '&id, status, sourcePlanId, frameworkId, templateId, updatedAt, *tagIds, *attachmentIds',
      tags: '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks: '&id, category, builtin',
      blogTemplates: '&id, category, builtin, useCount, updatedAt, *tagIds',
      aiCallLogs: '&id, modelProfileId, mode, createdAt',
      collections: '&id, name, sortOrder',
      collectionItems: '&id, collectionId, entityType, entityId, [collectionId+entityType]',
      meta: '&key',
    });

    // v1.5-AI Chat：新增 chatSessions 表（Dexie 独立版本升级，前向兼容 v3 数据库）。
    // 必须重声明 v3 全部表（Dexie 要求每个 version 列出当前活跃的全部表）。
    // 来源：openspec/changes/ai-chat-foundation
    this.version(4).stores({
      plans: '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items: '&id, planId, status, dueDate, order, [planId+order]',
      blogs: '&id, status, sourcePlanId, frameworkId, templateId, updatedAt, *tagIds, *attachmentIds',
      tags: '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks: '&id, category, builtin',
      blogTemplates: '&id, category, builtin, useCount, updatedAt, *tagIds',
      aiCallLogs: '&id, modelProfileId, mode, createdAt',
      collections: '&id, name, sortOrder',
      collectionItems: '&id, collectionId, entityType, entityId, [collectionId+entityType]',
      chatSessions: '&id, updatedAt, createdAt',
      meta: '&key',
    });

    // v1.2-Folders：新增 folders 表 + blogs 加 folderId 索引。
    // 必须完整重声明 v4 全部表（Dexie 要求每个 version 列出当前活跃的全部表）。
    // 来源：V1.2 design.md §文件夹数据模型。
    this.version(5).stores({
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
      meta: '&key',
    });

    // v1.3-Skills-PlanMode：新增 skillFolders / skills / aiPlans 三张表。
    // 必须完整重声明 v5 全部表（Dexie 要求每个 version 列出当前活跃的全部表）。
    // 来源：docs/v1.3/{skill-design,plan-mode-design}.md
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

    // v1.6-CloudSync (M1 数据层就绪)：新增墓碑 + 变更队列两张旁路表，
    // 并为缺失时间戳的 tags / frameworks 补齐时间字段以支撑 LWW 合并。
    // 必须完整重声明 v6 全部表（Dexie 要求每个 version 列出当前活跃的全部表）。
    // 来源：openspec/changes/2026-07-30-add-cloud-sync (T1.1 / T1.2 / T1.3 / T1.5)。
    this.version(7)
      .stores({
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
        tombstones: '&id, table, recordId, deletedAt, [table+recordId]',
        changeQueue: '&id, table, recordId, op, enqueuedAt',
        meta: '&key',
      })
      .upgrade(async () => {
        const now = new Date().toISOString();

        // T1.1 / T1.5：为 tags 补 updatedAt（缺失时按 createdAt 兜底，再缺失按当前时间）。
        const tags = await this.tags.toArray();
        if (tags.length > 0) {
          await this.tags.bulkPut(
            tags.map((t) => ({
              ...t,
              updatedAt: t.updatedAt ?? t.createdAt ?? now,
            })),
          );
        }

        // T1.1 / T1.5：为 frameworks 补 createdAt + updatedAt（框架此前两字段皆无）。
        const fws = await this.frameworks.toArray();
        if (fws.length > 0) {
          await this.frameworks.bulkPut(
            fws.map((f) => ({
              ...f,
              createdAt: f.createdAt ?? now,
              updatedAt: f.updatedAt ?? now,
            })),
          );
        }
      });
  }
}
