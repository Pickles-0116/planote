/**
 * Dexie Schema 定义
 *
 * 6 张业务表 + 1 张 meta 表，共 7 张。
 * 索引字符串与 `design.md` §3.1 逐字一致。
 * 构造函数接受 `name` 参数便于测试时换名（`fake-indexeddb` 场景）。
 *
 * 索引含义见 design.md §3.2 / §3.3 / §3.4：
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
} from '@/types/domain';

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
  // 6 张业务表
  declare plans: Table<Plan, ID>;
  declare items: Table<Item, ID>;
  declare blogs: Table<Blog, ID>;
  declare tags: Table<Tag, ID>;
  declare attachments: Table<Attachment, ID>;
  declare frameworks: Table<Framework, ID>;

  // 1 张 meta 表（seed 标记、用户设置、同步游标等）
  declare meta: Table<MetaRow, string>;

  constructor(name: string = 'planote') {
    super(name);
    this.version(1).stores({
      plans: '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items: '&id, planId, status, dueDate, order, [planId+order]',
      blogs: '&id, status, sourcePlanId, frameworkId, updatedAt, *tagIds, *attachmentIds',
      tags: '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks: '&id, category, builtin',
      meta: '&key',
    });
  }
}
