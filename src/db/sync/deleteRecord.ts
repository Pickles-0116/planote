/**
 * 统一删除入口（旁路式，M1 数据层就绪）
 *
 * 业务读写主链路对同步「零感知」。本文件提供两件事：
 *
 * 1. `deleteRecord(db, table, id)` —— 统一的「物理删除 + 写墓碑」入口。
 *    供 M3 同步引擎在需要程序化删除时使用；它与各 Repository.delete 行为一致，
 *    只是额外补写墓碑，使删除可跨设备传播（design.md §4.5 / spec.md 删除传播）。
 *
 * 2. 各 Repository 的 `delete`/`remove` 也已在本文件之外各自接线：在原有删除逻辑
 *    之后（或同一事务内）补写墓碑，调用方语义完全不变。
 */

import type { ID } from '@/types/domain';
import type { PlanoteDB } from '../schema';
import type { SyncableTableName } from './types';
import { makeTombstone } from './tombstones';

/**
 * 物理删除某表记录并写墓碑，二者在同一事务内完成（原子）。
 *
 * 注意：仅为「同步删除」的语义兜底而存在。绝大多数删除经由各 Repository 的
 * `delete`/`remove` 方法（其内部已接线写墓碑），无需直接调用本函数。
 *
 * @param table 参与同步的业务表名
 * @param id    待删除记录的主键
 */
export async function deleteRecord(
  db: PlanoteDB,
  table: SyncableTableName,
  id: ID,
): Promise<void> {
  const store = db[table] as unknown as { delete(id: ID): Promise<void> };
  await db.transaction(
    'rw',
    db[table] as never,
    db.tombstones as never,
    async () => {
      await store.delete(id);
      await db.tombstones.put(makeTombstone(table, id));
    },
  );
}
