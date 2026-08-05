/**
 * M3 同步引擎主类（T3.1–T3.3, T3.6–T3.7, T3.9–T3.10）
 *
 * 职责：
 * - 本地变更捕获（通过 Dexie Hook，见 capture.ts）
 * - 防抖推送（pull → merge → upload），冲突时拉取+合并重试（最多 3 次）
 * - 三种时机拉取（启动 / 可见性变化 / 定时轮询）
 * - 首次同步（拉取 → 合并 → 推回）
 * - 离线检测与队列保护
 * - 串行化保护（互斥锁防重入）
 * - 事件回调通知上层
 *
 * 同步引擎不直接修改业务 Repository 或 Store（旁路原则）。
 */

import type { PlanoteDB } from '@/db/schema';
import type { StorageBackend } from './types';
import {
  type SyncStatus,
  type SyncEventCallbacks,
  type SyncResult,
  type SyncableTableName,
  type Tombstone,
} from '@/db/sync/types';
import { getSyncConfig, setSyncConfig } from '@/db/sync/config';
import {
  listPendingChanges,
  countPendingChanges,
  removeChanges,
} from '@/db/sync/changeQueue';
import { listTombstones } from '@/db/sync/tombstones';
import { suppressCapture } from '@/db/sync/capture';
import { serializeSnapshot, deserializeSnapshot } from './snapshot';
import { mergeSnapshots } from './merger';
import { mapToSyncError } from './sync-error';
import { base64ToUtf8 } from './utils';
import {
  splitSnapshotIntoChunks,
  serializeChunk,
  deserializeChunk,
  getSubChunkList,
  type ChunkedManifest,
} from './chunks';
import type { SnapshotData } from './snapshot';
import { getDirtyTracker, _resetDirtyTracker } from '@/db/sync/dirty-tracker';
import { ChunkCache } from './chunk-cache';

/** 一个携带 id 和可选时间戳的记录。 */
interface TimestampedRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * 简单的互斥锁实现（T3.9 串行化保护）。
 */
class Mutex {
  private locked = false;
  private waiters: Array<() => void> = [];

  acquire(): boolean {
    if (!this.locked) {
      this.locked = true;
      return true;
    }
    return false;
  }

  release(): void {
    this.locked = false;
    const next = this.waiters.shift();
    if (next) {
      this.locked = true;
      next();
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }
}

/**
 * 将 SnapshotData.tables 转为 TimestampedRecord 格式。
 */
function toTimestampedTables(
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>,
): Partial<Record<SyncableTableName, TimestampedRecord[]>> {
  const result: Partial<Record<SyncableTableName, TimestampedRecord[]>> = {};
  for (const [key, recs] of Object.entries(tables)) {
    if (recs) {
      result[key as SyncableTableName] = recs as TimestampedRecord[];
    }
  }
  return result;
}

/**
 * 同步引擎主类。
 *
 * @example
 * ```ts
 * const engine = new SyncEngine(db, backend, callbacks);
 * engine.startAutoSync();
 * ```
 */
export class SyncEngine {
  private db: PlanoteDB;
  private backend: StorageBackend;
  private callbacks: SyncEventCallbacks;

  private mutex = new Mutex();
  private _status: SyncStatus = 'disabled';
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _onlineHandler: (() => void) | null = null;
  private _visibilityHandler: (() => void) | null = null;

  /** 获取当前同步状态。 */
  get status(): SyncStatus {
    return this._status;
  }

  constructor(
    db: PlanoteDB,
    backend: StorageBackend,
    callbacks?: SyncEventCallbacks,
  ) {
    this.db = db;
    this.backend = backend;
    this.callbacks = callbacks ?? {};
  }

  // ==================== 状态管理 ====================

  private setStatus(status: SyncStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.callbacks.onSyncStatusChange?.(status);
  }

  private notifyError(error: unknown): void {
    this.callbacks.onSyncError?.(error);
  }

  private notifyComplete(result: SyncResult): void {
    this.callbacks.onSyncComplete?.(result.changedTables);
  }

  private async notifyPendingCount(): Promise<void> {
    const count = await countPendingChanges(this.db);
    this.callbacks.onPendingCountChange?.(count);
  }

  // ==================== T3.9 串行化 ====================

  /**
   * 在互斥锁保护下执行同步操作。
   * 如果已有同步进行中，返回 null（跳过）。
   */
  private async withMutex(
    syncFn: () => Promise<{
      cursor: string;
      syncedAt: string;
      changedTables: SyncableTableName[];
    }>,
  ): Promise<SyncResult | null> {
    if (!this.mutex.acquire()) {
      return null;
    }
    try {
      const inner = await syncFn();
      const result: SyncResult = {
        cursor: inner.cursor,
        syncedAt: inner.syncedAt,
        changedTables: inner.changedTables,
      };
      await setSyncConfig(this.db, {
        cursor: result.cursor,
        lastSyncAt: result.syncedAt,
      });
      this.setStatus('synced');
      this.notifyComplete(result);
      await this.notifyPendingCount();
      return result;
    } catch (error) {
      const syncError = mapToSyncError(error);
      this.setStatus('error');
      this.notifyError(syncError);
      // 网络错误 → 标记离线待发
      if (syncError.type === 'NETWORK_ERROR') {
        const pending = await countPendingChanges(this.db);
        if (pending > 0) {
          this.setStatus('offline_pending');
        }
      }
      throw error;
    } finally {
      this.mutex.release();
    }
  }

  // ==================== T3.6 首次同步 ====================

  /**
   * 执行首次全量同步（AC-1 / AC-6）。
   *
   * 流程：拉取远端 → 与本地合并（不是覆盖）→ 推回合并结果。
   * - 远端为空（404）→ 直接推送本地数据
   * - 本地为空 → 拉取并全量写入
   * - 两端都有数据 → 合并后推回
   */
  async firstSync(): Promise<SyncResult | null> {
    return this.withMutex(async () => {
      this.setStatus('syncing');

      // 1. 尝试拉取远端
      let remoteVersion = '';
      let remoteData: SnapshotData = { tables: {}, tombstones: [] };

      try {
        const versionResult = await this.backend.readVersion();
        remoteVersion = versionResult.version;
      } catch {
        remoteVersion = '';
      }

      if (remoteVersion) {
        const downloadResult = await this.backend.downloadSnapshot();
        if (downloadResult.data) {
          const payload = deserializeSnapshot(downloadResult.data);
          remoteData = {
            tables: payload.tables as SnapshotData['tables'],
            tombstones: payload.tombstones as Tombstone[],
          };
          remoteVersion = downloadResult.version;
        }
      }

      // 2. 读取本地数据
      const localData = await this.readAllLocalData();

      // 3. 合并
      const localTables = toTimestampedTables(localData.tables);
      const remoteTables = toTimestampedTables(remoteData.tables);
      const mergeResult = mergeSnapshots(
        localTables,
        remoteTables,
        remoteData.tombstones,
      );

      // 4. 应用合并结果到本地（抑制捕获）
      suppressCapture(true);
      try {
        await this.applyMergeResult(mergeResult);
      } finally {
        suppressCapture(false);
      }

      // 5. 构建最终快照
      const finalData = await this.readAllLocalData();
      const serialized = serializeSnapshot(finalData);
      // 体积防护在 backend 内部按分片粒度做（assertChunkFits），
      // engine 不再做单文件上限检查（v1.3-CloudSync-Chunked 后单文件已不存在）

      // 6. 推回远端
      const uploadResult = await this.backend.uploadSnapshot(
        serialized,
        remoteVersion || '',
      );

      return {
        cursor: uploadResult.newVersion,
        syncedAt: new Date().toISOString(),
        changedTables: mergeResult.pushChanges.map((c) => c.table),
      };
    });
  }

  // ==================== T3.2 推送流程 ====================

  /**
   * 触发防抖推送。变更捕获时调用此方法。
   * 在防抖窗口内连续调用会重置定时器，只有最后一次才是真正的推送。
   */
  schedulePush(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    getSyncConfig(this.db).then((config) => {
      if (!config.enabled) return;
      this._debounceTimer = setTimeout(() => {
        this.executePush().catch(() => {
          // 错误已在 withMutex 中处理
        });
      }, config.pushDebounceMs);
    });
  }

  /**
   * 立即执行推送（忽略防抖）。
   * 外部可通过此方法实现「立即同步」。
   *
   * @param options.forceFullSync 强制全量推送（忽略脏追踪）
   * @param options.skipDirtyTracking 跳过脏追踪决策（仅测试用）
   */
  async executePush(options: { forceFullSync?: boolean; skipDirtyTracking?: boolean } = {}): Promise<SyncResult | null> {
    return this.withMutex(async () => {
      this.setStatus('syncing');

      // 0. 加载脏追踪器（如未加载）+ 决策走全量还是增量
      const dirtyTracker = getDirtyTracker();
      if (!dirtyTracker.isLoaded()) {
        await dirtyTracker.load(this.db);
      }
      const cache = new ChunkCache();
      if (!cache.isLoaded()) {
        await cache.load(this.db);
      }

      // 决策：是否走增量推送
      // 走全量的条件：首次同步、远端是老格式、强制全量、脏集合为空、缓存为空
      const extVersion = await this.readRemoteExtVersion();
      const isFirstSync = extVersion.version === '';
      const remoteIsChunked = extVersion.chunked;
      const hasLocalChanges = !dirtyTracker.isEmpty();
      const hasCache = !cache.isEmpty();

      const useIncremental =
        !options.forceFullSync &&
        !isFirstSync &&
        remoteIsChunked &&
        hasLocalChanges &&
        hasCache;

      if (useIncremental) {
        return this.dirtySyncPath(dirtyTracker, cache);
      }

      // 1. 拉取远端最新快照（全量路径）
      let remoteVersion: string;
      let remoteData: SnapshotData;

      try {
        const versionResult = await this.backend.readVersion();
        remoteVersion = versionResult.version;
        if (remoteVersion) {
          const downloadResult = await this.backend.downloadSnapshot();
          if (downloadResult.data) {
            const payload = deserializeSnapshot(downloadResult.data);
            remoteData = {
              tables: payload.tables as SnapshotData['tables'],
              tombstones: payload.tombstones as Tombstone[],
            };
            remoteVersion = downloadResult.version;
          } else {
            remoteData = { tables: {}, tombstones: [] };
            remoteVersion = '';
          }
        } else {
          remoteData = { tables: {}, tombstones: [] };
        }
      } catch (error) {
        throw mapToSyncError(error);
      }

      // 2. 读取本地数据
      const localData = await this.readAllLocalData();

      // 3. 合并
      const localTables = toTimestampedTables(localData.tables);
      const remoteTables = toTimestampedTables(remoteData.tables);
      const mergeResult = mergeSnapshots(
        localTables,
        remoteTables,
        remoteData.tombstones,
      );

      // 4. 应用合并结果到本地
      suppressCapture(true);
      try {
        await this.applyMergeResult(mergeResult);
      } finally {
        suppressCapture(false);
      }

      // 5. 构建最终快照
      const finalData = await this.readAllLocalData();
      const serialized = serializeSnapshot(finalData);
      // 体积防护在 backend 内部按分片粒度做（assertChunkFits）

      // 6. 上传，版本冲突时重试（最多 3 次）
      const uploadResult = await this.retryOnConflict(
        serialized,
        remoteVersion,
      );

      // 7. 清空已处理的队列项
      const pending = await listPendingChanges(this.db);
      if (pending.length > 0) {
        await removeChanges(
          this.db,
          pending.map((c) => c.id),
        );
      }

      // 8. 确定哪些表发生了变化
      const changedTables = [
        ...new Set([
          ...mergeResult.pushChanges.map((c) => c.table),
          ...(Object.keys(mergeResult.localWrites) as SyncableTableName[]),
          ...(Object.keys(mergeResult.localDeletions) as SyncableTableName[]),
        ]),
      ];

      return {
        cursor: uploadResult.newVersion,
        syncedAt: new Date().toISOString(),
        changedTables,
      };
    });
  }

  /**
   * 带版本冲突重试的上传（最多 3 次）。
   */
  private async retryOnConflict(
    serialized: string,
    baseVersion: string,
    maxRetries = 3,
    uploadOptions?: { dirtyChunks?: Set<string> },
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.backend.uploadSnapshot(serialized, baseVersion, uploadOptions);
      } catch (error) {
        if (attempt >= maxRetries - 1) {
          lastError = error;
          break;
        }
        const syncError = mapToSyncError(error);
        if (syncError.type === 'VERSION_CONFLICT') {
          // 重新拉取并合并
          try {
            const versionResult = await this.backend.readVersion();
            const newRemoteVersion = versionResult.version;
            if (newRemoteVersion && newRemoteVersion !== baseVersion) {
              const downloadResult = await this.backend.downloadSnapshot();
              if (downloadResult.data) {
                const payload = deserializeSnapshot(downloadResult.data);
                const remoteData: SnapshotData = {
                  tables: payload.tables as SnapshotData['tables'],
                  tombstones: payload.tombstones as Tombstone[],
                };
                const localData = await this.readAllLocalData();
                const localTables = toTimestampedTables(localData.tables);
                const remoteTables = toTimestampedTables(remoteData.tables);
                const mergeResult = mergeSnapshots(
                  localTables,
                  remoteTables,
                  remoteData.tombstones,
                );

                suppressCapture(true);
                try {
                  await this.applyMergeResult(mergeResult);
                } finally {
                  suppressCapture(false);
                }

                const finalData = await this.readAllLocalData();
                const newSerialized = serializeSnapshot(finalData);
                // 体积防护在 backend 内部按分片粒度做（assertChunkFits）
                return await this.backend.uploadSnapshot(
                  newSerialized,
                  newRemoteVersion,
                  uploadOptions,
                );
              }
            }
          } catch {
            // 重试拉取失败，继续下一轮
          }
        }
        lastError = error;
      }
    }
    throw lastError;
  }

  /**
   * 读取远端扩展版本（含分片/单文件标记）。兼容旧 backend：未实现
   * readExtendedVersion 时回退到全量推送（chunked = false）。
   */
  private async readRemoteExtVersion(): Promise<{ version: string; chunked: boolean }> {
    if (this.backend.readExtendedVersion) {
      try {
        return await this.backend.readExtendedVersion();
      } catch {
        // 读取失败兜底
        return { version: '', chunked: false };
      }
    }
    // 旧 backend：只返回 version，假设非分片
    const v = await this.backend.readVersion();
    return { version: v.version, chunked: false };
  }

  /**
   * 增量推送路径（v1.3-CloudSync-DirtyChunk）。
   *
   * 流程：
   * 1. 拉取远端 manifest（不下载子片内容）
   * 2. 校验本地 chunkCache 与远端 SHA 一致（不一致则降级全量）
   * 3. 拉取脏分片
   * 4. 用脏分片内容 + chunkCache 干净分片 → 构建完整 SnapshotData
   * 5. 推：传 dirtyChunks 给 backend
   * 6. 成功：更新 chunkCache + 清空 dirtyTracker + 持久化
   * 7. 失败：自动降级为全量推送
   */
  private async dirtySyncPath(
    dirtyTracker: ReturnType<typeof getDirtyTracker>,
    cache: ChunkCache,
  ): Promise<SyncResult> {
    try {
      // 1. 拉远端 manifest
      const extVersion = await this.readRemoteExtVersion();
      const remoteManifest = await this.fetchRemoteManifest();

      // 2. SHA 一致性校验
      if (remoteManifest) {
        const mismatches = cache.findInconsistencies(remoteManifest);
        if (mismatches.length > 0) {
          // 降级为全量推送
          return this.fallbackToFullSync(
            'cache 校验失败：分片 ' + mismatches.slice(0, 3).join(', ') + ' SHA 不一致',
          );
        }
      }

      // 3. 计算要推的脏分片
      const dirtyChunks = dirtyTracker.getDirtyChunks();
      const ext = extVersion.version;

      // 4. 拉脏分片
      const remoteData = await this.fetchDirtyChunks(remoteManifest, dirtyChunks);

      // 5. 用 chunkCache 补全未脏分片
      const localData = await this.readAllLocalData();
      const localCacheSnapshot = this.buildSnapshotFromCacheAndDirty(cache, remoteData, localData, dirtyChunks);

      // 6. LWW 合并
      const localTables = toTimestampedTables(localCacheSnapshot.tables);
      const remoteTables = toTimestampedTables(remoteData.tables);
      const mergeResult = mergeSnapshots(localTables, remoteTables, remoteData.tombstones);

      // 7. 写入本地
      suppressCapture(true);
      try {
        await this.applyMergeResult(mergeResult);
      } finally {
        suppressCapture(false);
      }

      // 8. 推：传 dirtyChunks options
      const finalData = await this.readAllLocalData();
      const serialized = serializeSnapshot(finalData);
      const uploadResult = await this.retryOnConflict(
        serialized,
        ext,
        3,
        { dirtyChunks },
      );

      // 9. 拉新 manifest（远端可能因脏分片 PUT 后 SHA 变了）
      const newManifest = await this.fetchRemoteManifest();

      // 10. 更新 chunkCache：用本次推送的数据 + 远端新 manifest
      if (newManifest) {
        cache.updateFromManifest(newManifest, this.collectChunkJsonMap(finalData));
        await cache.persist(this.db);
      }

      // 11. 清空脏追踪
      dirtyTracker.markPushed();
      await dirtyTracker.persist(this.db);

      // 12. 通知
      const changedTables: SyncableTableName[] = [
        ...new Set([
          ...mergeResult.pushChanges.map((c) => c.table),
          ...(Object.keys(mergeResult.localWrites) as SyncableTableName[]),
        ]),
      ];
      this.notifyComplete({
        cursor: uploadResult.newVersion,
        syncedAt: new Date().toISOString(),
        changedTables,
      });

      return {
        cursor: uploadResult.newVersion,
        syncedAt: new Date().toISOString(),
        changedTables,
      };
    } catch (error) {
      // 增量推送失败：降级为全量
      return this.fallbackToFullSync(
        '增量推送失败：' + (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /** 降级为全量推送（带诊断信息）。 */
  private async fallbackToFullSync(_reason: string): Promise<SyncResult> {
    // 清空脏追踪（强制全量后状态会重建）
    const dirtyTracker = getDirtyTracker();
    const cache = new ChunkCache();
    dirtyTracker.markPushed();
    await dirtyTracker.persist(this.db);
    cache.clear();
    await cache.persist(this.db);

    // 重新走全量推送：直接调 uploadSnapshot，不传 dirtyChunks
    this.setStatus('syncing');
    const extVersion = await this.readRemoteExtVersion();
    const downloadResult = await this.backend.downloadSnapshot();
    let remoteData: SnapshotData;
    let remoteVersion: string;
    if (extVersion.version && downloadResult.data) {
      const payload = deserializeSnapshot(downloadResult.data);
      remoteData = { tables: payload.tables as SnapshotData['tables'], tombstones: payload.tombstones as Tombstone[] };
      remoteVersion = downloadResult.version;
    } else {
      remoteData = { tables: {}, tombstones: [] };
      remoteVersion = '';
    }

    const localData = await this.readAllLocalData();
    const localTables = toTimestampedTables(localData.tables);
    const remoteTables = toTimestampedTables(remoteData.tables);
    const mergeResult = mergeSnapshots(localTables, remoteTables, remoteData.tombstones);

    suppressCapture(true);
    try {
      await this.applyMergeResult(mergeResult);
    } finally {
      suppressCapture(false);
    }

    const finalData = await this.readAllLocalData();
    const serialized = serializeSnapshot(finalData);
    const uploadResult = await this.retryOnConflict(serialized, remoteVersion);

    // 推送成功后重建 chunkCache
    const newManifest = await this.fetchRemoteManifest();
    if (newManifest) {
      cache.updateFromManifest(newManifest, this.collectChunkJsonMap(finalData));
      await cache.persist(this.db);
    }

    const changedTables: SyncableTableName[] = [
      ...new Set([
        ...mergeResult.pushChanges.map((c) => c.table),
        ...(Object.keys(mergeResult.localWrites) as SyncableTableName[]),
      ]),
    ];

    return {
      cursor: uploadResult.newVersion,
      syncedAt: new Date().toISOString(),
      changedTables,
    };
  }

  /** 拉远端 manifest（用 GitHubBackend 私有方法）。 */
  private async fetchRemoteManifest(): Promise<ChunkedManifest | null> {
    // 通过类型断言访问 GitHubBackend 的扩展方法
    const backend = this.backend as StorageBackend & {
      readRawFile?: (path: string) => Promise<{ content: string; encoding: string } | null>;
    };
    if (!backend.readRawFile) {
      return null;
    }
    try {
      const raw = await backend.readRawFile('chunks/manifest.json');
      if (!raw || !raw.content || raw.encoding !== 'base64') return null;
      const json = base64ToUtf8(raw.content);
      const parsed = JSON.parse(json) as ChunkedManifest;
      if (typeof parsed.formatVersion !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** 拉取指定的脏分片（基于 manifest 的 subChunks）。 */
  private async fetchDirtyChunks(
    manifest: ChunkedManifest | null,
    dirtyChunks: Set<string>,
  ): Promise<SnapshotData> {
    if (!manifest) {
      return { tables: {}, tombstones: [] };
    }
    const subNames: string[] = [];
    for (const [chunkKey, meta] of Object.entries(manifest.chunks)) {
      if (!dirtyChunks.has(chunkKey)) continue;
      const subList = getSubChunkList(meta, chunkKey);
      for (const sub of subList) subNames.push(sub.name);
    }
    // 通过 readRawFile 逐个拉（dirtySyncPath 已用 readRawFile 类型断言）
    const backend = this.backend as StorageBackend & {
      readRawFile?: (path: string) => Promise<{ content: string; encoding: string } | null>;
    };
    if (!backend.readRawFile) {
      return { tables: {}, tombstones: [] };
    }
    const tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
    let tombstones: Tombstone[] = [];
    for (const subName of subNames) {
      try {
        const raw = await backend.readRawFile(`chunks/${subName}.json`);
        if (!raw || !raw.content || raw.encoding !== 'base64') continue;
        const json = base64ToUtf8(raw.content);
        const payload = deserializeChunk(json);
        if ('tables' in payload && payload.tables) {
          for (const [table, rows] of Object.entries(payload.tables)) {
            if (Array.isArray(rows)) {
              (tables[table as SyncableTableName] ??= []).push(...rows);
            }
          }
        } else if ('tombstones' in payload && Array.isArray(payload.tombstones)) {
          tombstones = payload.tombstones;
        }
      } catch {
        // 拉取失败由 caller 决定降级
        throw new Error(`拉取分片 ${subName} 失败`);
      }
    }
    return { tables, tombstones };
  }

  /** 从 cache + 脏分片 + 本地构建完整 SnapshotData。 */
  private buildSnapshotFromCacheAndDirty(
    cache: ChunkCache,
    remoteData: SnapshotData,
    localData: SnapshotData,
    dirtyChunks: Set<string>,
  ): SnapshotData {
    const result: SnapshotData = { tables: { ...localData.tables }, tombstones: [] };
    // 干净分片从 cache 取
    for (const chunkName of cache.keys()) {
      const logicalKey = chunkName.replace(/-[a-z]$/, '');
      if (dirtyChunks.has(logicalKey)) continue;
      const cached = cache.getChunk(chunkName);
      if (cached) {
        try {
          const payload = JSON.parse(cached.json) as { tables?: Partial<Record<SyncableTableName, Record<string, unknown>[]>>; tombstones?: Tombstone[] };
          if (payload.tables) {
            for (const [table, rows] of Object.entries(payload.tables)) {
              if (Array.isArray(rows)) {
                result.tables[table as SyncableTableName] = rows as Record<string, unknown>[];
              }
            }
          }
        } catch {
          // cache 条目损坏，跳过（将由降级逻辑兜底）
        }
      }
    }
    // 脏分片用远端（拉到的）+ 本地覆盖
    for (const [table, rows] of Object.entries(remoteData.tables)) {
      if (rows) {
        result.tables[table as SyncableTableName] = rows as Record<string, unknown>[];
      }
    }
    result.tombstones = remoteData.tombstones ?? [];
    return result;
  }

  /** 收集 finalData → 子片名 → JSON map（用于 cache.updateFromManifest）。 */
  private collectChunkJsonMap(
    finalData: SnapshotData,
  ): Map<string, string> {
    const chunks = splitSnapshotIntoChunks(finalData);
    const map = new Map<string, string>();
    for (const { name, payload } of chunks) {
      map.set(name, serializeChunk(payload));
    }
    return map;
  }

  // ==================== T3.3 拉取流程 ====================

  /**
   * 执行拉取（带版本比对优化）。
   *
   * 拉取前先比 readVersion() 与本地游标：
   * 一致则跳过下载（零成本空转）。
   */
  async pull(): Promise<SyncResult | null> {
    return this.withMutex(async () => {
      this.setStatus('syncing');
      const config = await getSyncConfig(this.db);

      // 版本比对
      const versionResult = await this.backend.readVersion();
      const remoteVersion = versionResult.version;

      if (!remoteVersion) {
        return {
          cursor: config.cursor ?? '',
          syncedAt: new Date().toISOString(),
          changedTables: [],
        };
      }

      if (remoteVersion === config.cursor) {
        // 版本一致 → 零成本跳过
        return {
          cursor: remoteVersion,
          syncedAt: new Date().toISOString(),
          changedTables: [],
        };
      }

      // 版本不一致 → 下载
      const downloadResult = await this.backend.downloadSnapshot();
      if (!downloadResult.data) {
        return {
          cursor: config.cursor ?? '',
          syncedAt: new Date().toISOString(),
          changedTables: [],
        };
      }

      const payload = deserializeSnapshot(downloadResult.data);
      const remoteData: SnapshotData = {
        tables: payload.tables as SnapshotData['tables'],
        tombstones: payload.tombstones as Tombstone[],
      };

      // 读取本地数据
      const localData = await this.readAllLocalData();

      // 合并
      const localTables = toTimestampedTables(localData.tables);
      const remoteTables = toTimestampedTables(remoteData.tables);
      const mergeResult = mergeSnapshots(
        localTables,
        remoteTables,
        remoteData.tombstones,
      );

      // 应用合并结果
      suppressCapture(true);
      try {
        await this.applyMergeResult(mergeResult);
      } finally {
        suppressCapture(false);
      }

      const changedTables = [
        ...new Set([
          ...(Object.keys(mergeResult.localWrites) as SyncableTableName[]),
          ...(Object.keys(mergeResult.localDeletions) as SyncableTableName[]),
        ]),
      ];

      return {
        cursor: downloadResult.version,
        syncedAt: new Date().toISOString(),
        changedTables,
      };
    });
  }

  // ==================== 自动同步管理 ====================

  /**
   * 启动自动同步（T3.2 + T3.3）。
   *
   * - 启动时拉取一次
   * - 监听页面可见性变化 / 窗口 Focus
   * - 启动后台定时轮询
   * - 监听网络状态变化
   */
  startAutoSync(): void {
    getSyncConfig(this.db).then((config) => {
      if (!config.enabled) {
        this.setStatus('disabled');
        return;
      }

      if (!config.repo || !config.token) {
        this.setStatus('pending_config');
        return;
      }

      // 启动时拉取
      this.pull().catch(() => {
        // 错误已在内部处理
      });

      // 定时轮询
      this.startPolling(config.pollIntervalMs);

      // 页面可见性变化 / Focus
      this.setupVisibilityListener();

      // 网络状态变化
      this.setupOnlineListener();
    });
  }

  /**
   * 停止自动同步（关闭同步时调用）。
   */
  stopAutoSync(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._visibilityHandler) {
      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          this._visibilityHandler,
        );
        window.removeEventListener('focus', this._visibilityHandler);
      }
      this._visibilityHandler = null;
    }
    if (this._onlineHandler) {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', this._onlineHandler);
      }
      this._onlineHandler = null;
    }
    this.setStatus('disabled');
  }

  /**
   * 更新远端后端实例（切换存储时使用）。
   */
  setBackend(backend: StorageBackend): void {
    this.backend = backend;
  }

  /**
   * 更新事件回调。
   */
  setCallbacks(callbacks: SyncEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ==================== 定时轮询 ====================

  private startPolling(intervalMs: number): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
    }
    this._pollTimer = setInterval(() => {
      this.pull().catch(() => {
        // 静默
      });
    }, intervalMs);
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const handler = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        this.pull().catch(() => {
          // 静默
        });
      }
    };

    this._visibilityHandler = handler;
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
  }

  // ==================== T3.7 离线检测 ====================

  private setupOnlineListener(): void {
    if (typeof window === 'undefined') return;

    const handler = () => {
      if (navigator.onLine) {
        // 网络恢复 → 自动推送待同步变更
        this.executePush().catch(() => {
          // 静默
        });
      }
    };

    this._onlineHandler = handler;
    window.addEventListener('online', handler);
  }

  // ==================== 本地数据读写 ====================

  /**
   * 读取全部本地数据（所有 SyncableTableName 表 + 墓碑）。
   */
  private async readAllLocalData(): Promise<SnapshotData> {
    const tableNames: SyncableTableName[] = [
      'plans',
      'items',
      'blogs',
      'tags',
      'frameworks',
      'blogTemplates',
      'collections',
      'collectionItems',
      'chatSessions',
      'folders',
      'skillFolders',
      'skills',
    ];

    const tables: SnapshotData['tables'] = {};

    for (const name of tableNames) {
      const table = this.db[name] as unknown as {
        toArray(): Promise<Record<string, unknown>[]>;
      };
      tables[name] = await table.toArray();
    }

    const tombstones = await listTombstones(this.db);

    return { tables, tombstones };
  }

  /**
   * 应用合并结果到本地数据库。
   * 调用前需 suppressCapture(true) 防止回环。
   */
  private async applyMergeResult(
    mergeResult: import('@/db/sync/types').MergeResult,
  ): Promise<void> {
    // 写入记录
    for (const [tableName, records] of Object.entries(
      mergeResult.localWrites,
    )) {
      if (!records || records.length === 0) continue;
      const table = this.db[tableName as SyncableTableName] as unknown as {
        bulkPut(items: Record<string, unknown>[]): Promise<void>;
      };
      await table.bulkPut(records);
    }

    // 删除记录（含写墓碑）
    for (const [tableName, ids] of Object.entries(
      mergeResult.localDeletions,
    )) {
      if (!ids || ids.length === 0) continue;
      const table = this.db[tableName as SyncableTableName] as unknown as {
        bulkDelete(ids: string[]): Promise<void>;
      };
      await table.bulkDelete(ids);
      // 对每个被删除的记录写墓碑
      const { makeTombstone } = await import('@/db/sync/tombstones');
      for (const id of ids) {
        await this.db.tombstones.put(
          makeTombstone(tableName as SyncableTableName, id),
        );
      }
    }
  }
}
