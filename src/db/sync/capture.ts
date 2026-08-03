/**
 * M3 同步引擎 — 本地变更捕获（T3.1）
 *
 * 通过 Dexie 表级 Hook 拦截所有写操作（create/update/delete）并自动入 `changeQueue`。
 * 同步引擎自身的合并写入通过 `suppressCapture()` 抑制入队，防止变更回环。
 *
 * 设计要点：
 * - 使用 `table.hook('creating')` / `table.hook('updating')` / `table.hook('deleting')`
 *   拦截，不修改任何 Repository 代码（旁路原则）。
 * - 抑制标志 `_syncCaptureSuppressed` 为全局布尔，同步引擎在执行合并写入前设为 true。
 * - 标志是同步的（非异步锁），因为 JS 单线程，hook 回调与抑制设置在同一微任务/宏任务边界内安全。
 */

import type { PlanoteDB } from '../schema';
import type { SyncableTableName } from './types';
import { enqueueChange } from './changeQueue';

/** 同步引擎写入时抑制捕获的标志。 */
let _syncCaptureSuppressed = false;

/**
 * 设置是否抑制变更捕获。
 *
 * 同步引擎在合并写入前调用 `suppressCapture(true)`，写入后恢复 `suppressCapture(false)`。
 * 业务代码的普通写入不受影响（默认为 false）。
 */
export function suppressCapture(suppressed: boolean): void {
  _syncCaptureSuppressed = suppressed;
}

/**
 * 是否为抑制状态（供测试验证）。
 */
export function isCaptureSuppressed(): boolean {
  return _syncCaptureSuppressed;
}

/** 参与同步的业务表名列表（用于 Hook 循环）。 */
const SYNC_TABLES: SyncableTableName[] = [
  'plans',
  'items',
  'blogs',
  'tags',
  'frameworks',
  'blogTemplates',
  'aiCallLogs',
  'collections',
  'collectionItems',
  'chatSessions',
  'folders',
  'skillFolders',
  'skills',
  'aiPlans',
];

/**
 * 在 PlanoteDB 上注册变更捕获 Hook。
 *
 * 必须在数据库创建后调用一次（通常在 `src/db/index.ts` 导出后立即注册）。
 * 对每张 SyncableTableName 表注册 creating/updating/deleting 三个 Hook。
 *
 * @example
 * ```ts
 * import { registerSyncCapture } from './sync/capture';
 * registerSyncCapture(db);
 * ```
 */
export function registerSyncCapture(db: PlanoteDB): void {
  for (const tableName of SYNC_TABLES) {
    const table = db[tableName] as unknown as { hook: DexieHookAccess };

    // 新增记录
    table.hook('creating').subscribe(function (this: void, _primKey, obj) {
      if (_syncCaptureSuppressed) return;
      const record = obj as { id?: string };
      if (!record.id) return;
      queueMicrotask(() => {
        enqueueChange(db, tableName as SyncableTableName, record.id!, 'put').catch(
          () => {
            /* 静默 */
          },
        );
      });
    });

    // 更新记录
    table.hook('updating').subscribe(function (this: void, _mods, primKey) {
      if (_syncCaptureSuppressed) return;
      queueMicrotask(() => {
        enqueueChange(db, tableName as SyncableTableName, primKey as string, 'put').catch(
          () => {
            /* 静默 */
          },
        );
      });
    });

    // 删除记录
    table.hook('deleting').subscribe(function (this: void, primKey) {
      if (_syncCaptureSuppressed) return;
      queueMicrotask(() => {
        enqueueChange(
          db,
          tableName as SyncableTableName,
          primKey as string,
          'delete',
        ).catch(() => {
          /* 静默 */
        });
      });
    });
  }
}

// ==================== Dexie Hook 类型辅助 ====================

interface CreatingHook {
  subscribe(cb: (primKey: unknown, obj: unknown) => void): void;
}
interface UpdatingHook {
  subscribe(cb: (mods: unknown, primKey: unknown) => void): void;
}
interface DeletingHook {
  subscribe(cb: (primKey: unknown) => void): void;
}
interface DexieHookAccess {
  (name: 'creating'): CreatingHook;
  (name: 'updating'): UpdatingHook;
  (name: 'deleting'): DeletingHook;
}
