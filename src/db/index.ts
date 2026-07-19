/**
 * 数据库单例入口
 *
 * 生产代码统一从此处导入 `db`。
 * Repository 实现通过工厂函数零参调用即可拿到该单例。
 *
 * 不要在 `src/features/**` / `src/pages/**` / `src/stores/**` 直接
 * import 该 db（详见 `src/db/repos/index.ts` 顶部说明）。
 */

import { PlanoteDB } from './schema';

/** 生产用 Dexie 单例（数据库名 `planote`）。 */
export const db = new PlanoteDB();
