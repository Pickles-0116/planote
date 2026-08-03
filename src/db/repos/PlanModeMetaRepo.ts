/**
 * PlanModeMetaRepository（v1.3-fix F3 · D2 sessionsAB 持久化）
 *
 * 复用 `meta` 键值表（schema.ts:71 `meta: '&key'`，行结构 `MetaRow { key, value }`），
 * 键名 `planModeState`，值结构见 `PlanModeStateMeta`。
 *
 * 为什么复用 meta 而非新表：
 * - 不触发 Dexie version 升级与完整重声明（规避迁移风险）
 * - meta 是本地键值，天然适配「会话映射」语义，不参与同步/tombstones
 * - 只存 planA/planB/activeTab 三个 sessionId 映射，不迁移既有 ChatSession 数据
 *
 * 页面/组件禁止直接 `db.meta`，统一经本 Repo 读写。
 */

import type { ID, ISODate } from '@/types/domain';
import type { PlanoteDB } from '../schema';

/** PlanMode 双会话映射（规划 A / 执行 B）。 */
export interface PlanModeStateMeta {
  /** 规划会话 session id（A）。 */
  planA?: ID;
  /** 执行会话 session id（B）。 */
  planB?: ID;
  /** 当前 tab。 */
  activeTab?: 'A' | 'B';
  /** 最后更新时间。 */
  updatedAt: ISODate;
}

export class PlanModeMetaRepo {
  constructor(private db: PlanoteDB) {}

  /** 读取 PlanMode 状态（不存在时返回 undefined）。 */
  async getState(): Promise<PlanModeStateMeta | undefined> {
    const row = await this.db.meta.get('planModeState');
    return row?.value as PlanModeStateMeta | undefined;
  }

  /** 写入 PlanMode 状态（覆盖写）。 */
  async setState(s: PlanModeStateMeta): Promise<void> {
    await this.db.meta.put({ key: 'planModeState', value: s });
  }
}

import { db as defaultDb } from '../index';
export const createPlanModeMetaRepo = (database: PlanoteDB = defaultDb): PlanModeMetaRepo =>
  new PlanModeMetaRepo(database);
