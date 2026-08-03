/**
 * 变更队列存储访问层（M1 数据层就绪）
 *
 * 记录「本地尚未推送成功的变更」，跨会话持久化（设备私有，不入同步载荷）。
 * M3 同步引擎负责入队（监听写操作）与出队（推送成功后清空）。
 *
 * 设计取向（见 design.md §4.1）：队列只存「表 + 主键 + 操作类型」，推送时由
 * M3 直接读本地当前记录（本地是事实来源），从而天然支持离线合批与断点续传。
 */

import type { ID, ISODate } from '@/types/domain';
import type { PlanoteDB } from '../schema';
import { newId } from '@/lib/id';
import type { ChangeOp, ChangeQueueItem, SyncableTableName } from './types';

const nowISO = (): ISODate => new Date().toISOString();

/**
 * 入队一条变更。同一记录短时间内多次变更会各自入队，M3 推送前按记录去重合批。
 */
export async function enqueueChange(
  db: PlanoteDB,
  table: SyncableTableName,
  recordId: ID,
  op: ChangeOp,
): Promise<void> {
  await db.changeQueue.put({
    id: newId(),
    table,
    recordId,
    op,
    enqueuedAt: nowISO(),
  });
}

/**
 * 按入队时间升序返回全部待推送变更（M3 推送前读取）。
 */
export async function listPendingChanges(
  db: PlanoteDB,
): Promise<ChangeQueueItem[]> {
  return db.changeQueue.orderBy('enqueuedAt').toArray();
}

/**
 * 待同步变更项数（用于状态展示「离线 · N 项待同步」）。
 */
export async function countPendingChanges(db: PlanoteDB): Promise<number> {
  return db.changeQueue.count();
}

/**
 * 移除已成功推送的队列项（按主键批量删除）。
 */
export async function removeChanges(
  db: PlanoteDB,
  ids: ID[],
): Promise<void> {
  if (ids.length === 0) return;
  await db.changeQueue.bulkDelete(ids);
}

/**
 * 清空整个变更队列（极端场景下使用）。
 */
export async function clearChangeQueue(db: PlanoteDB): Promise<void> {
  await db.changeQueue.clear();
}
