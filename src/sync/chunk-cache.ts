/**
 * 分片缓存（ChunkCache）— v1.3-CloudSync-DirtyChunk
 *
 * 背景：增量推送时，未脏分片不重传，但合并逻辑需要这些分片的内容。ChunkCache
 * 持久化"上次推送成功的每个分片内容副本 + 远端 SHA"，供增量推送时获取。
 *
 * 数据：meta 表 `sync:chunk-cache` 键
 * - chunks: Record<chunkName, { json: string; sha: string; size: number }>
 * - lastPushAt: ISO 时间
 *
 * 容量：≈ 全部数据量（用户 1.3MB → 缓存 ~1.3MB），可承受。
 *
 * 校验：启动时与远端 manifest 比对 SHA，不一致则降级为全量推送。
 *
 * 详见 design.md §2.2。
 */

import type { Table } from 'dexie';
import type { ChunkedManifest } from './chunks';

/** 极简接口：chunk-cache 只需要一个带 meta 表的 DB。 */
interface MetaDB {
  meta: Table<{ key: string; value: unknown }, string>;
}

/** 缓存键。 */
export const CHUNK_CACHE_KEY = 'sync:chunk-cache';

/** 单个分片的缓存条目。 */
export interface CachedChunk {
  /** 序列化后的 JSON 字符串。 */
  json: string;
  /** 远端 blob SHA。 */
  sha: string;
  /** 文件字节数。 */
  size: number;
}

/** 缓存结构。 */
export interface ChunkCacheData {
  /** 分片名 → 缓存条目。 */
  chunks: Record<string, CachedChunk>;
  /** 缓存写入时间。 */
  lastPushAt: string;
}

/**
 * 内存中的分片缓存。
 *
 * 使用方式：
 * ```ts
 * const cache = new ChunkCache();
 * await cache.load(db);
 * // 增量推送时取干净分片：
 * const cached = cache.getChunk('chunk-0');
 * // 推送成功后更新：
 * cache.updateFromManifest(manifest, chunkJsonMap);
 * await cache.persist(db);
 * ```
 */
export class ChunkCache {
  private data: ChunkCacheData = { chunks: {}, lastPushAt: '' };
  private loaded = false;
  private pendingPersist = false;

  /** 加载缓存。 */
  async load(db: MetaDB): Promise<void> {
    try {
      const row = await db.meta.get(CHUNK_CACHE_KEY);
      if (row && row.value && typeof row.value === 'object') {
        const val = row.value as Partial<ChunkCacheData>;
        this.data = {
          chunks: (val.chunks ?? {}) as Record<string, CachedChunk>,
          lastPushAt: typeof val.lastPushAt === 'string' ? val.lastPushAt : '',
        };
      }
      this.loaded = true;
    } catch {
      this.data = { chunks: {}, lastPushAt: '' };
      this.loaded = true;
    }
  }

  /** 获取单个分片缓存。 */
  getChunk(chunkName: string): CachedChunk | undefined {
    return this.data.chunks[chunkName];
  }

  /** 获取所有缓存。 */
  getAll(): Record<string, CachedChunk> {
    return { ...this.data.chunks };
  }

  /** 是否有任何缓存。 */
  isEmpty(): boolean {
    return Object.keys(this.data.chunks).length === 0;
  }

  /** 已知分片名集合（用于迭代）。 */
  keys(): string[] {
    return Object.keys(this.data.chunks);
  }

  /**
   * 用新 manifest + 子片内容更新缓存。
   *
   * 通常在推送成功后调用，传入"本次推送后远端 manifest + 各分片序列化 JSON"。
   * 旧缓存条目会被整体替换（不合并），以保证缓存与远端严格一致。
   *
   * @param manifest 远端最新 manifest
   * @param chunkJsonMap 分片名（含子片后缀）→ 序列化 JSON
   */
  updateFromManifest(
    manifest: ChunkedManifest,
    chunkJsonMap: Map<string, string>,
  ): void {
    const newChunks: Record<string, CachedChunk> = {};

    // 遍历 manifest 中所有子片，更新缓存
    for (const [chunkKey, meta] of Object.entries(manifest.chunks)) {
      // 兼容老/新 manifest 形态
      const subList = (() => {
        if ('subChunks' in meta && Array.isArray((meta as { subChunks?: Array<{ name: string; sha: string; size: number }> }).subChunks)) {
          return (meta as { subChunks: Array<{ name: string; sha: string; size: number }> }).subChunks;
        }
        // 老形态：{sha, size, tables} 当作单子片
        const legacy = meta as { sha: string; size: number };
        return [{ name: chunkKey, sha: legacy.sha, size: legacy.size }];
      })();

      for (const sub of subList) {
        const json = chunkJsonMap.get(sub.name);
        if (json !== undefined) {
          newChunks[sub.name] = {
            json,
            sha: sub.sha,
            size: sub.size,
          };
        }
      }
    }

    this.data = {
      chunks: newChunks,
      lastPushAt: new Date().toISOString(),
    };
    this.pendingPersist = true;
  }

  /**
   * 校验本地缓存与远端 manifest 的一致性。
   *
   * @returns 不一致的分片名集合。空集合 = 全部一致。
   */
  findInconsistencies(manifest: ChunkedManifest): string[] {
    const mismatches: string[] = [];
    for (const [chunkKey, meta] of Object.entries(manifest.chunks)) {
      const subList = (() => {
        if ('subChunks' in meta && Array.isArray((meta as { subChunks?: Array<{ name: string; sha: string; size: number }> }).subChunks)) {
          return (meta as { subChunks: Array<{ name: string; sha: string; size: number }> }).subChunks;
        }
        const legacy = meta as { sha: string; size: number };
        return [{ name: chunkKey, sha: legacy.sha, size: legacy.size }];
      })();

      for (const sub of subList) {
        const cached = this.data.chunks[sub.name];
        if (!cached || cached.sha !== sub.sha) {
          mismatches.push(sub.name);
        }
      }
    }
    return mismatches;
  }

  /** 清空缓存（用于降级全量 / 缓存损坏）。 */
  clear(): void {
    this.data = { chunks: {}, lastPushAt: '' };
    this.pendingPersist = true;
  }

  /** 持久化。 */
  async persist(db: MetaDB): Promise<void> {
    if (!this.pendingPersist) return;
    try {
      await db.meta.put({ key: CHUNK_CACHE_KEY, value: this.data });
      this.pendingPersist = false;
    } catch {
      // 写入失败下次再试
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  hasPendingPersist(): boolean {
    return this.pendingPersist;
  }
}
