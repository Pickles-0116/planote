/**
 * dexieClear - 清空 7 张表（事务）
 *
 * 纯函数 + 异步；不依赖 UI 状态。
 */

import { db } from '@/db';

export async function dexieClear(): Promise<void> {
  await db.transaction(
    'rw',
    [db.plans, db.items, db.blogs, db.tags, db.attachments, db.frameworks, db.meta],
    async () => {
      await Promise.all([
        db.plans.clear(),
        db.items.clear(),
        db.blogs.clear(),
        db.tags.clear(),
        db.attachments.clear(),
        db.frameworks.clear(),
        db.meta.clear(),
      ]);
    },
  );
}
