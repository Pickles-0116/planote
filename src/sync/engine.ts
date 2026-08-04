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
import { assertSnapshotFits } from './size-guard';
import type { SnapshotData } from './snapshot';

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
      // 体积防护：避免远端再生成超大 state.json 撞 GitHub 单文件回包边界
      assertSnapshotFits(serialized);

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
   */
  async executePush(): Promise<SyncResult | null> {
    return this.withMutex(async () => {
      this.setStatus('syncing');

      // 1. 拉取远端最新快照
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
      // 体积防护：避免远端再生成超大 state.json 撞 GitHub 单文件回包边界
      assertSnapshotFits(serialized);

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
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.backend.uploadSnapshot(serialized, baseVersion);
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
                // 体积防护：版本冲突重试拉取后仍要校验（避免本地+远端合并后仍超限）
                assertSnapshotFits(newSerialized);
                return await this.backend.uploadSnapshot(
                  newSerialized,
                  newRemoteVersion,
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
