/**
 * dexieImport - 导入 JSON 备份（merge / replace 双模式）
 *
 * 纯函数 + 异步；不依赖 UI 状态。
 *
 * 校验：
 * 1. JSON 解析
 * 2. version === 1
 * 3. 7 张表均为数组
 *
 * 还原：
 * - attachments[].blob (dataURL) → fetch → Blob
 * - 其余字段直接 bulkPut
 *
 * 模式：
 * - 'merge'：直接 bulkPut，id 冲突新数据胜；并撤销被导入 id 上的旧删除意图
 * - 'replace'：先 clear() 7 张业务表 + 墓碑/变更队列，再 bulkPut
 */

import { db } from '@/db';
import type { ID, Plan, Item, Blog, Tag, Attachment, Framework } from '@/types/domain';
import type { SyncableTableName } from '@/db/sync';
import type { MetaRow } from '@/db/schema';
import { EXPORT_VERSION, type ExportPayload } from './dexieExport';

export type ImportMode = 'merge' | 'replace';

const REQUIRED_TABLES = [
  'plans',
  'items',
  'blogs',
  'tags',
  'attachments',
  'frameworks',
  'meta',
] as const;

/** dataURL → Blob */
async function dataURLToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  if (!res.ok) {
    throw new Error('附件数据 URL 解析失败');
  }
  return res.blob();
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ImportSummary {
  clearedTables: number;
  inserted: {
    plans: number;
    items: number;
    blogs: number;
    tags: number;
    attachments: number;
    frameworks: number;
    meta: number;
  };
}

/**
 * 导入数据。
 * @throws ImportError 校验失败 / JSON 解析失败
 */
export async function dexieImport(
  file: File,
  mode: ImportMode,
): Promise<ImportSummary> {
  // 1. 读 + parse
  let raw: unknown;
  try {
    const text = await file.text();
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('JSON 解析失败');
  }

  // 2. 校验
  if (typeof raw !== 'object' || raw === null) {
    throw new ImportError('导出文件格式错误：根节点不是对象');
  }
  const data = raw as Partial<ExportPayload> & Record<string, unknown>;
  if (data.version !== EXPORT_VERSION) {
    throw new ImportError(
      `导出文件版本不匹配（v1.0 仅支持 v${EXPORT_VERSION}）`,
    );
  }
  for (const key of REQUIRED_TABLES) {
    if (!Array.isArray(data[key])) {
      throw new ImportError(`导出文件格式错误：缺少 ${key} 表`);
    }
  }

  // 3. 还原附件 blob
  const exportedAttachments = data.attachments as ExportPayload['attachments'];
  const restoredAttachments: Attachment[] = await Promise.all(
    exportedAttachments.map(async (a) => {
      const blob = await dataURLToBlob(a.blob);
      return {
        ...a,
        blob,
      } as Attachment;
    }),
  );

  // 4. 写入
  const plans = data.plans as Plan[];
  const items = data.items as Item[];
  const blogs = data.blogs as Blog[];
  const tags = data.tags as Tag[];
  const frameworks = data.frameworks as Framework[];
  const meta = data.meta as MetaRow[];

  // 同步边界：被导入的记录若在本地留有「删除意图」（墓碑 / 待推送的 delete 变更），
  // 下次同步会把刚导入的同 id 记录再删一次（跨设备「导入即被回滚」）。
  // replace 模式整表清空即可；merge 模式只按导入的 id 精确撤销删除意图，
  // 以保留其它记录尚未推送的变更（见 design.md §4.5 删除传播）。
  const importedKeys: Array<[SyncableTableName, ID]> = [
    ...plans.map((r): [SyncableTableName, ID] => ['plans', r.id]),
    ...items.map((r): [SyncableTableName, ID] => ['items', r.id]),
    ...blogs.map((r): [SyncableTableName, ID] => ['blogs', r.id]),
    ...tags.map((r): [SyncableTableName, ID] => ['tags', r.id]),
    ...restoredAttachments.map((r): [SyncableTableName, ID] => ['attachments', r.id]),
    ...frameworks.map((r): [SyncableTableName, ID] => ['frameworks', r.id]),
  ];

  let clearedTables = 0;
  await db.transaction(
    'rw',
    [
      db.plans,
      db.items,
      db.blogs,
      db.tags,
      db.attachments,
      db.frameworks,
      db.meta,
      db.tombstones,
      db.changeQueue,
    ],
    async () => {
      if (mode === 'replace') {
        // 一并清空墓碑与变更队列，避免导入后残留旧墓碑误删新导入数据
        await Promise.all([
          db.plans.clear(),
          db.items.clear(),
          db.blogs.clear(),
          db.tags.clear(),
          db.attachments.clear(),
          db.frameworks.clear(),
          db.meta.clear(),
          db.tombstones.clear(),
          db.changeQueue.clear(),
        ]);
        clearedTables = REQUIRED_TABLES.length;
      } else if (importedKeys.length > 0) {
        // merge：撤销被导入 id 上的旧墓碑与待推送删除
        await db.tombstones
          .where('[table+recordId]')
          .anyOf(importedKeys)
          .delete();
        await db.changeQueue
          .where('recordId')
          .anyOf(importedKeys.map(([, id]) => id))
          .filter((c) => c.op === 'delete')
          .delete();
      }
      await Promise.all([
        db.plans.bulkPut(plans),
        db.items.bulkPut(items),
        db.blogs.bulkPut(blogs),
        db.tags.bulkPut(tags),
        db.attachments.bulkPut(restoredAttachments),
        db.frameworks.bulkPut(frameworks),
        db.meta.bulkPut(meta),
      ]);
    },
  );

  return {
    clearedTables,
    inserted: {
      plans: plans.length,
      items: items.length,
      blogs: blogs.length,
      tags: tags.length,
      attachments: restoredAttachments.length,
      frameworks: frameworks.length,
      meta: meta.length,
    },
  };
}
