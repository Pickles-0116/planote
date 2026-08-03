/**
 * M2 存储通道 — 附件独立缓存与读写
 *
 * 附件在快照中只记录元数据（id / blogId / filename / mimeType / size），
 * blob 内容按主键 key 单独存放，首次引用时按需下载（不随快照全量下）。
 *
 * 本地缓存使用内存 Map（基于 Blob URL），退出会话即释放。
 * M3 同步引擎也可在此基础上实现 IndexedDB Blob store 持久化。
 */

import type { StorageBackend } from './types';

/** 本地附件缓存（内存，会话级）。key = 附件 id，value = Blob。 */
const localCache = new Map<string, Blob>();

/**
 * 附件管理器：包装 StorageBackend，提供本地缓存层。
 *
 * 上传时写入本地缓存并同步到远端；
 * 下载时优先读本地缓存，未命中则从远端拉取并缓存。
 */
export class AttachmentManager {
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
  }

  /**
   * 上传附件，同时写入本地缓存。
   *
   * @param key - 附件主键（对应 Attachment.id）
   * @param blob - 附件二进制内容
   */
  async upload(key: string, blob: Blob): Promise<void> {
    localCache.set(key, blob);
    await this.backend.uploadAttachment(key, blob);
  }

  /**
   * 下载附件，优先从本地缓存读取。
   *
   * @param key - 附件主键
   * @returns Blob
   */
  async download(key: string): Promise<Blob> {
    const cached = localCache.get(key);
    if (cached) return cached;

    const blob = await this.backend.downloadAttachment(key);
    localCache.set(key, blob);
    return blob;
  }

  /**
   * 检查本地是否已缓存指定附件。
   */
  hasLocal(key: string): boolean {
    return localCache.has(key);
  }

  /**
   * 从本地缓存中移除指定附件。
   */
  evict(key: string): void {
    localCache.delete(key);
  }

  /**
   * 清空全部本地缓存。
   */
  clearCache(): void {
    localCache.clear();
  }
}
