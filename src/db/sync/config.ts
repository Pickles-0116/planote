/**
 * 同步配置访问层（M1 数据层就绪）
 *
 * 同步配置统一存放于本地 `meta` 表（键 `sync:config`），设备私有、不参与同步。
 * 所有连接参数与阈值均为可配置项，无硬编码常量（见 design.md §5）。
 *
 * 安全红线：令牌 `token` 仅存此处（本地 IndexedDB），永不作为同步载荷上传；
 * AI 密钥本就存于浏览器 localStorage，与同步配置互不交叉（见 design.md §7）。
 */

import type { PlanoteDB } from '../schema';
import {
  DEFAULT_SYNC_CONFIG,
  SYNC_CONFIG_KEY,
  type SyncConfig,
} from './types';

/**
 * 读取同步配置。未配置时返回默认值（不写入，避免污染 meta）。
 */
export async function getSyncConfig(db: PlanoteDB): Promise<SyncConfig> {
  const row = await db.meta.get(SYNC_CONFIG_KEY);
  if (!row) return { ...DEFAULT_SYNC_CONFIG };
  const stored = (row.value ?? {}) as Partial<SyncConfig>;
  return { ...DEFAULT_SYNC_CONFIG, ...stored };
}

/**
 * 局部更新同步配置并落库，返回更新后的完整配置。
 *
 * 典型用途：
 * - M4 设置页保存用户填写的连接参数；
 * - M3 同步引擎维护系统字段 `cursor` / `lastSyncAt`。
 */
export async function setSyncConfig(
  db: PlanoteDB,
  patch: Partial<SyncConfig>,
): Promise<SyncConfig> {
  const current = await getSyncConfig(db);
  const next: SyncConfig = { ...current, ...patch };
  await db.meta.put({ key: SYNC_CONFIG_KEY, value: next });
  return next;
}
