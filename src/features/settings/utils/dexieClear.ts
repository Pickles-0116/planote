/**
 * dexieClear - 清空 7 张业务表 + 墓碑/变更队列（事务）
 *
 * 纯函数 + 异步；不依赖 UI 状态。
 *
 * 同步辅助表必须随业务数据一并清空：残留墓碑会在下次同步时误删同 id 的新记录，
 * 残留变更队列会推送已不存在的记录（见 design.md §4.5）。
 */

import { db } from '@/db';

export async function dexieClear(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.plans,
      db.items,
      db.blogs,
      db.tags,
      db.attachments,
      db.frameworks,
      db.meta,
      db.tombstones,
      db.changeQueue,
    ],
    async () => {
      await Promise.all([
        db.plans.clear(),
        db.items.clear(),
        db.blogs.clear(),
        db.tags.clear(),
        db.attachments.clear(),
        db.frameworks.clear(),
        db.meta.clear(),
        db.tombstones.clear(),
        db.changeQueue.clear(),
      ]);
    },
  );
}
