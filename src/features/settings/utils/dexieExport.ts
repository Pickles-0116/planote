/**
 * dexieExport - 导出 7 张表 + 附件 blob → base64 dataURL
 *
 * 纯函数 + 异步；不依赖 UI 状态。
 *
 * 导出 schema（v1）：
 * {
 *   version: 1,
 *   exportedAt: ISO,
 *   plans: Plan[],
 *   items: Item[],
 *   blogs: Blog[],
 *   tags: Tag[],
 *   attachments: AttachmentWithDataURL[],
 *   frameworks: Framework[],
 *   meta: MetaRow[]
 * }
 */

import { db } from '@/db';
import type { Plan, Item, Blog, Tag, Attachment, Framework } from '@/types/domain';
import type { MetaRow } from '@/db/schema';

export const EXPORT_VERSION = 1 as const;

/** attachments 在导出时 blob 字段被替换为 dataURL 字符串。 */
export interface ExportedAttachment extends Omit<Attachment, 'blob'> {
  blob: string; // data URL
}

export interface ExportPayload {
  version: typeof EXPORT_VERSION;
  exportedAt: string; // ISO timestamp
  plans: Plan[];
  items: Item[];
  blogs: Blog[];
  tags: Tag[];
  attachments: ExportedAttachment[];
  frameworks: Framework[];
  meta: MetaRow[];
}

/** Blob → base64 dataURL（异步）。 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('FileReader 读取结果非字符串'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader 错误'));
    reader.readAsDataURL(blob);
  });
}

export async function dexieExport(): Promise<ExportPayload> {
  const [plans, items, blogs, tags, attachments, frameworks, meta] = await Promise.all([
    db.plans.toArray(),
    db.items.toArray(),
    db.blogs.toArray(),
    db.tags.toArray(),
    db.attachments.toArray(),
    db.frameworks.toArray(),
    db.meta.toArray(),
  ]);

  // 附件 blob → dataURL
  const exportedAttachments: ExportedAttachment[] = await Promise.all(
    attachments.map(async (a) => {
      const dataUrl = await blobToDataURL(a.blob);
      // 保留其他字段，把 blob 替换为 dataURL 字符串
      const { blob: _blob, ...rest } = a;
      void _blob;
      const result: ExportedAttachment = {
        ...(rest as Omit<Attachment, 'blob'>),
        blob: dataUrl,
      };
      return result;
    }),
  );

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    plans,
    items,
    blogs,
    tags,
    attachments: exportedAttachments,
    frameworks,
    meta,
  };
}
