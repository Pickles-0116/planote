/**
 * 墓碑存储访问层（M1 数据层就绪）
 *
 * 提供墓碑的构造与读写 helper。墓碑由同步删除路径（见 `deleteRecord` 与各
 * Repository.delete）写入，由 M3 同步引擎读取并传播、清理。
 *
 * 安全：墓碑只含「表名 + 主键 + 删除时间」，不含任何业务内容或密钥。
 */

import type { ID, ISODate } from '@/types/domain';
import type { PlanoteDB } from '../schema';
import { newId } from '@/lib/id';
import type { SyncableTableName, Tombstone } from './types';

const nowISO = (): ISODate => new Date().toISOString();

/**
 * 生成一条墓碑（纯函数，不落库）。
 *
 * 供 Repository 删除路径在自身事务内 `db.tombstones.put(makeTombstone(...))` 使用，
 * 也供 `deleteRecord` 统一入口使用。
 */
export function makeTombstone(
  table: SyncableTableName,
  recordId: ID,
): Tombstone {
  return {
    id: newId(),
    table,
    recordId,
    deletedAt: nowISO(),
  };
}

/**
 * 写墓碑（独立事务，供旁路/非事务上下文调用）。
 */
export async function writeTombstone(
  db: PlanoteDB,
  table: SyncableTableName,
  recordId: ID,
): Promise<void> {
  await db.tombstones.put(makeTombstone(table, recordId));
}

/**
 * 按「表名 + 主键」精确查询某条记录的墓碑（用于合并时判断是否存在删除意图）。
 */
export async function getTombstone(
  db: PlanoteDB,
  table: SyncableTableName,
  recordId: ID,
): Promise<Tombstone | undefined> {
  return db.tombstones
    .where('[table+recordId]')
    .equals([table, recordId])
    .first();
}

/**
 * 按删除时间升序列出全部墓碑（用于遍历 / 清理）。
 */
export async function listTombstones(db: PlanoteDB): Promise<Tombstone[]> {
  return db.tombstones.orderBy('deletedAt').toArray();
}

/**
 * 删除指定墓碑（清理或合并后移除）。
 */
export async function deleteTombstone(
  db: PlanoteDB,
  id: ID,
): Promise<void> {
  await db.tombstones.delete(id);
}

/**
 * 清空全部墓碑（极端场景下使用，正常情况下按保留期逐条清理）。
 */
export async function clearTombstones(db: PlanoteDB): Promise<void> {
  await db.tombstones.clear();
}
