/**
 * 脏分片追踪器（DirtyChunkTracker）— v1.3-CloudSync-DirtyChunk
 *
 * 背景：v1.3-CloudSync-Chunked-2 实现"全量分片推送"，但日常小改动时重传所有
 * 分片浪费带宽与时间。本模块追踪"自上次成功同步以来本地发生了变更的逻辑分片"
 * 供推送决策使用。
 *
 * 数据来源：
 * - 触发：db/sync/capture.ts 的 Dexie Hook（creating / updating / deleting）
 * - 持久化：meta 表 `sync:dirty-chunks` 键
 *
 * 与 changeQueue 的关系：
 * - changeQueue 推送成功后会被清空，无法表达"上次推送后还有什么脏"
 * - dirtyTracker 与 changeQueue 独立，专门服务"自上次推送以来的脏状态"
 *
 * 详见 design.md §2.1。
 */

import type { Table } from 'dexie';
import type { SyncableTableName } from './types';
import { TABLE_TO_CHUNK } from '@/sync/chunks';

/** 极简接口：dirty-tracker 只需要一个带 meta 表的 DB。便于测试与未来扩展。 */
interface MetaDB {
  meta: Table<{ key: string; value: unknown }, string>;
}

/** 脏分片追踪器在 meta 表中的键。 */
export const DIRTY_CHUNKS_KEY = 'sync:dirty-chunks';

/** 内部类型：分片名 → 首次变脏的 ISO 时间。 */
type DirtyMap = Map<string, string>;

/**
 * 脏分片追踪器。
 *
 * 使用方式：
 * ```ts
 * const tracker = new DirtyChunkTracker();
 * await tracker.load(db);
 * tracker.markDirty('blogs'); // hook 调用
 * // ... 推送
 * tracker.markPushed(); // 推送成功后清空
 * await tracker.persist(db); // 同步到 meta
 * ```
 */
export class DirtyChunkTracker {
  /** 内存镜像。 */
  private dirty: DirtyMap = new Map();
  /** 是否已加载（防止未 load 就用）。 */
  private loaded = false;
  /** 待持久化的脏集合（debounce 用，避免每次 markDirty 都写 meta 表）。 */
  private pendingPersist = false;

  /**
   * 把表名映射到逻辑分片名，标记该分片为脏。
   *
   * 幂等：同一分片多次 markDirty 不会覆盖已有的时间戳（保留首次脏时间）。
   */
  markDirty(table: SyncableTableName): void {
    const chunkName = TABLE_TO_CHUNK[table];
    if (!chunkName) return;
    if (!this.dirty.has(chunkName)) {
      this.dirty.set(chunkName, new Date().toISOString());
      this.pendingPersist = true;
    }
  }

  /** 当前脏分片集合。 */
  getDirtyChunks(): Set<string> {
    return new Set(this.dirty.keys());
  }

  /** 是否为空。 */
  isEmpty(): boolean {
    return this.dirty.size === 0;
  }

  /** 脏分片数量（用于 UI 展示）。 */
  size(): number {
    return this.dirty.size;
  }

  /** 推送成功后清空。 */
  markPushed(): void {
    this.dirty.clear();
    this.pendingPersist = true;
  }

  /** 强制清空（包括持久化）。用于缓存损坏、降级全量等场景。 */
  reset(): void {
    this.dirty.clear();
    this.pendingPersist = true;
  }

  /**
   * 从 meta 表加载脏集合。
   *
   * 必须在 markDirty / getDirtyChunks 之前调用一次（应用启动时）。
   * 加载失败或键不存在时，内存脏集合保持为空（相当于"没东西脏"，全量推送兜底）。
   */
  async load(db: MetaDB): Promise<void> {
    try {
      const row = await db.meta.get(DIRTY_CHUNKS_KEY);
      if (row && Array.isArray(row.value)) {
        // value: Array<[chunkName, isoDate]>
        this.dirty = new Map(row.value as Array<[string, string]>);
      }
      this.loaded = true;
    } catch {
      // 加载失败（meta 表 corrupt 等）→ 保持空脏集合 → 下次推送全量兜底
      this.dirty.clear();
      this.loaded = true;
    }
  }

  /**
   * 把内存脏集合写回 meta 表。
   *
   * 调用方负责在合适时机调用（推送成功后 / markDirty 一定次数后 / 应用 idle）。
   * 本类不自动 debounce，由调用方决定。
   */
  async persist(db: MetaDB): Promise<void> {
    if (!this.pendingPersist) return;
    try {
      await db.meta.put({
        key: DIRTY_CHUNKS_KEY,
        value: Array.from(this.dirty.entries()),
      });
      this.pendingPersist = false;
    } catch {
      // 写入失败不影响功能（下次推送会再次尝试）
    }
  }

  /** 是否已加载。 */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** 是否有待持久化的变更。用于测试。 */
  hasPendingPersist(): boolean {
    return this.pendingPersist;
  }
}

/**
 * 全局单例。
 *
 * 设计原因：db/sync/capture.ts 的 Hook 在数据库层注册，跨多个模块共享同一份脏
 * 状态。引擎也直接用这一份。简单的 module-level singleton 满足需求，避免引入
 * 依赖注入框架。
 */
let globalTracker: DirtyChunkTracker | null = null;

/** 获取全局脏分片追踪器（首次调用时创建）。 */
export function getDirtyTracker(): DirtyChunkTracker {
  if (!globalTracker) {
    globalTracker = new DirtyChunkTracker();
  }
  return globalTracker;
}

/** 重置全局脏分片追踪器（仅用于测试）。 */
export function _resetDirtyTracker(): void {
  globalTracker = null;
}
