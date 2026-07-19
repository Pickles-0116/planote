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
 * - 'merge'：直接 bulkPut，id 冲突新数据胜
 * - 'replace'：先 clear() 7 张表，再 bulkPut
 */

import { db } from '@/db';
import type { Plan, Item, Blog, Tag, Attachment, Framework } from '@/types/domain';
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

  let clearedTables = 0;
  await db.transaction(
    'rw',
    [db.plans, db.items, db.blogs, db.tags, db.attachments, db.frameworks, db.meta],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.plans.clear(),
          db.items.clear(),
          db.blogs.clear(),
          db.tags.clear(),
          db.attachments.clear(),
          db.frameworks.clear(),
          db.meta.clear(),
        ]);
        clearedTables = REQUIRED_TABLES.length;
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
