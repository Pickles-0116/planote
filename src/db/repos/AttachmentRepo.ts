/**
 * AttachmentRepository 实现
 *
 * 关键规则（tasks.md 3.6）：
 * - listByBlog 按 uploadedAt 升序
 * - upload 从 File 构造 Attachment 记录（存 Blob）
 * - delete 仅删附件记录，**不动** blog.attachmentIds（由 BlogRepo 维护）
 * - getObjectURL 调用 URL.createObjectURL，**调用方需配对 revoke**
 */

import type { ID, Attachment, ISODate } from '@/types/domain';
import type { AttachmentRepository, AppErrorPayload } from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import type { PlanoteDB } from '../schema';

const nowISO = (): ISODate => new Date().toISOString();

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Attachment not found: ${id}`,
  };
  throw new AppError(payload);
};

export class AttachmentRepo implements AttachmentRepository {
  constructor(private db: PlanoteDB) {}

  async listByBlog(blogId: ID): Promise<Attachment[]> {
    const all = await this.db.attachments.where('blogId').equals(blogId).toArray();
    return all.sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1));
  }

  async upload(blogId: ID, file: File): Promise<Attachment> {
    const now = nowISO();
    const attachment: Attachment = {
      id: newId(),
      blogId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      // 图片尺寸探测（仅当类型为 image/* 时）
      ...(await this.maybeImageDims(file)),
      uploadedAt: now,
    };
    await this.db.attachments.add(attachment);
    return attachment;
  }

  async delete(id: ID): Promise<void> {
    const a = await this.db.attachments.get(id);
    if (!a) throwNotFound(id);
    await this.db.attachments.delete(id);
  }

  async getBlob(id: ID): Promise<Blob> {
    const a = await this.db.attachments.get(id);
    if (a === undefined) throwNotFound(id);
    return (a as Attachment).blob;
  }

  async getObjectURL(id: ID): Promise<string> {
    const blob = await this.getBlob(id);
    return URL.createObjectURL(blob);
  }

  /**
   * 若 file 是图片，探测其宽高（不阻塞主流程；探测失败时静默忽略）。
   * 返回 undefined 时 spread 为 no-op，TS 严格模式友好。
   */
  private async maybeImageDims(
    file: File,
  ): Promise<{ width: number; height: number } | undefined> {
    if (!file.type.startsWith('image/')) return undefined;
    if (typeof createImageBitmap !== 'function') return undefined;
    try {
      const bitmap = await createImageBitmap(file);
      const dims = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dims;
    } catch {
      return undefined;
    }
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createAttachmentRepo = (
  database: PlanoteDB = defaultDb,
): AttachmentRepo => new AttachmentRepo(database);
