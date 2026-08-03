/**
 * M3 同步引擎 — 合并规则实现（T3.4 / T3.5）
 *
 * 实现 design.md §4.3 判定表：
 *
 * | 情况 | 判定 |
 * |------|------|
 * | 仅本地有 | 保留本地（待推送到远端） |
 * | 仅远端有 | 写入本地 |
 * | 两端都有，更新时间不同 | 保留更新时间较晚的一版（LWW） |
 * | 两端都有，更新时间相同 | 视为一致，不动 |
 * | 记录存在但有对应墓碑，且墓碑时间晚于记录更新时间 | 执行删除 |
 * | 记录存在但有对应墓碑，且墓碑时间早于记录更新时间 | 保留记录，墓碑失效 |
 *
 * updatedAt 缺失时用 createdAt 兜底，都缺失则保留本地版并在写入时补齐。
 *
 * 合并在「记录级」进行，逐表逐记录判定。返回包含本地需写入/删除的记录，
 * 以及需要推回远端的变更列表。
 */

import type {
  SyncableTableName,
  Tombstone,
  MergeResult,
} from '@/db/sync/types';

/** 一条记录的最小时间戳字段。 */
interface TimestampedRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * 获取一条记录的有效更新时间：
 * 1. updatedAt（首选）
 * 2. createdAt（兜底）
 * 3. 空字符串（双方都缺失时，保留本地版本）
 */
function getEffectiveTime(rec: TimestampedRecord): string {
  return rec.updatedAt ?? rec.createdAt ?? '';
}

/**
 * 比较两条记录的时间戳，判断哪条更新：
 * - 返回值 > 0 → a 更新
 * - 返回值 < 0 → b 更新
 * - 返回值 = 0 → 时间相等
 */
function compareTimestamps(a: TimestampedRecord, b: TimestampedRecord): number {
  const ta = getEffectiveTime(a);
  const tb = getEffectiveTime(b);
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

/**
 * 墓碑索引：按 table+recordId 快速查询墓碑。
 */
interface TombstoneIndex {
  get(table: SyncableTableName, recordId: string): Tombstone | undefined;
}

function buildTombstoneIndex(tombstones: Tombstone[]): TombstoneIndex {
  const map = new Map<string, Tombstone>();
  for (const ts of tombstones) {
    map.set(`${ts.table}:${ts.recordId}`, ts);
  }
  return {
    get(table: SyncableTableName, recordId: string): Tombstone | undefined {
      return map.get(`${table}:${recordId}`);
    },
  };
}

/**
 * 合并引擎 v1。
 *
 * 对每张 SyncableTableName 表，将本地当前数据与远程快照数据逐记录合并。
 * 合并过程按 §4.3 判定表执行，不产生任何副作用（纯函数）。
 *
 * @param localTables 本地各表的全部记录（key = 表名, value = 记录数组）
 * @param remoteTables 远程快照中的各表记录
 * @param remoteTombstones 远程快照中的墓碑集合
 * @returns 合并结果（本地需写入/删除的记录 + 需要推回远端的变更）
 */
export function mergeSnapshots(
  localTables: Partial<Record<SyncableTableName, TimestampedRecord[]>>,
  remoteTables: Partial<Record<SyncableTableName, TimestampedRecord[]>>,
  remoteTombstones: Tombstone[],
): MergeResult {
  const tsIndex = buildTombstoneIndex(remoteTombstones);

  const localWrites: MergeResult['localWrites'] = {};
  const localDeletions: MergeResult['localDeletions'] = {};
  const pushChanges: MergeResult['pushChanges'] = [];

  // 收集所有涉及的表名（local ∪ remote）
  const allTables = new Set<SyncableTableName>();
  for (const t of Object.keys(localTables) as SyncableTableName[]) {
    allTables.add(t);
  }
  for (const t of Object.keys(remoteTables) as SyncableTableName[]) {
    allTables.add(t);
  }

  for (const table of allTables) {
    const localRecs = localTables[table] ?? [];
    const remoteRecs = remoteTables[table] ?? [];

    // 按 id 建立本地索引
    const localById = new Map<string, TimestampedRecord>();
    for (const rec of localRecs) {
      localById.set(rec.id, rec);
    }

    // 按 id 建立远端索引
    const remoteById = new Map<string, TimestampedRecord>();
    for (const rec of remoteRecs) {
      remoteById.set(rec.id, rec);
    }

    // 收集所有涉及的记录 ID
    const allIds = new Set<string>();
    for (const id of localById.keys()) allIds.add(id);
    for (const id of remoteById.keys()) allIds.add(id);

    const tableWrites: Record<string, unknown>[] = [];
    const tableDeletions: string[] = [];

    for (const id of allIds) {
      const local = localById.get(id);
      const remote = remoteById.get(id);
      const tombstone = tsIndex.get(table, id);

      // 先检查墓碑（可以覆盖情况1/2/3/4）
      if (tombstone && local) {
        // 情况5/6: 存���墓碑
        if (tombstone.deletedAt > getEffectiveTime(local)) {
          // 情况5: 墓碑时间 > 记录时间 → 执行删除
          tableDeletions.push(id);
          continue;
        }
        // 情况6: 墓碑时间 ≤ 记录时间 → 保留记录（fall through 到 LWW）
      }

      if (local && !remote) {
        // 情况1: 仅本地有 → 保留本地，推回远端
        tableWrites.push(local);
        pushChanges.push({ table, recordId: id });
        continue;
      }

      if (!local && remote) {
        // 情况2: 仅远端有 → 写入本地
        tableWrites.push(remote);
        continue;
      }

      // 情况3/4: 两端都有，比较更新时间
      if (local && remote) {
        const localTime = getEffectiveTime(local);

        // 如果本地时间戳完全缺失，保留本地版本（spec：缺失时间戳时保留本地）
        if (!localTime) {
          tableWrites.push(local);
          continue;
        }

        const cmp = compareTimestamps(local, remote);
        if (cmp > 0) {
          // 本地更新 → 保留本地，推回远端
          tableWrites.push(local);
          pushChanges.push({ table, recordId: id });
        } else if (cmp < 0) {
          // 远端更新 → 写入本地，不需要推回
          tableWrites.push(remote);
        } else {
          // 情况4: 更新时间相同 → 视为一致，不动
          tableWrites.push(local);
        }
      }
    }

    if (tableWrites.length > 0) {
      localWrites[table] = tableWrites;
    }
    if (tableDeletions.length > 0) {
      localDeletions[table] = tableDeletions;
    }
  }

  return { localWrites, localDeletions, pushChanges };
}

/**
 * 应用远程墓碑到本地数据（T3.5）。
 *
 * 根据 design.md §4.3 情况5：
 * 本地记录存在 + 远端墓碑且墓碑时间 > 记录时间 → 执行删除
 *
 * @param localTables 本地各表的全部记录
 * @param remoteTombstones 远程快照中的墓碑集合
 * @returns 需要在本地删除的记录（按表分组）
 */
export function applyRemoteTombstones(
  localTables: Partial<Record<SyncableTableName, TimestampedRecord[]>>,
  remoteTombstones: Tombstone[],
): Partial<Record<SyncableTableName, string[]>> {
  const deletions: Partial<Record<SyncableTableName, string[]>> = {};

  for (const tombstone of remoteTombstones) {
    const { table, recordId, deletedAt } = tombstone;
    const localRecs = localTables[table] ?? [];
    const localRec = localRecs.find((r) => r.id === recordId);

    if (!localRec) continue; // 本地已不存在，无需处理

    if (deletedAt > getEffectiveTime(localRec)) {
      // 墓碑时间晚于记录更新 → 删除
      if (!deletions[table]) deletions[table] = [];
      deletions[table]!.push(recordId);
    }
    // 墓碑时间 ≤ 记录更新 → 保留（删除后重建）
  }

  return deletions;
}

/**
 * 清理过期墓碑（T3.5）。
 *
 * 超过保留期的墓碑可安全清理——它们已被所有设备消费，
 * 且已有较新的快照版本覆盖（见 design.md §4.5）。
 *
 * @param tombstones 当前全部墓碑
 * @param retentionMs 保留期（毫秒）
 * @returns 需要保留的墓碑
 */
export function filterExpiredTombstones(
  tombstones: Tombstone[],
  retentionMs: number,
): Tombstone[] {
  const cutoff = Date.now() - retentionMs;
  return tombstones.filter((ts) => {
    const tsTime = new Date(ts.deletedAt).getTime();
    return tsTime > cutoff;
  });
}
