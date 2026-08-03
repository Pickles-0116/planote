/**
 * M2 存储通道 — 快照序列化 / 反序列化
 *
 * 将全部 15 张 SyncableTableName 表 + 墓碑集合序列化为单一的 state.json，
 * 供远端存储上传/下载。反序列化时校验 formatVersion 以防数据结构不兼容。
 */

import type { Tombstone } from '@/db/sync/types';
import type { SyncableTableName } from '@/db/sync/types';

/** 当前快照格式版本号。递增表示 payload 结构发生不兼容变更。 */
export const SNAPSHOT_FORMAT_VERSION = 1;

/** 序列化后的快照载荷结构。 */
export interface SnapshotPayload {
  formatVersion: number;
  generatedAt: string;
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  tombstones: Tombstone[];
}

/** 数据库各表的数据快照（M3 从 IndexedDB 读取后传入）。 */
export interface SnapshotData {
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  tombstones: Tombstone[];
}

/**
 * 将数据库快照序列化为 JSON 字符串。
 */
export function serializeSnapshot(data: SnapshotData): string {
  const payload: SnapshotPayload = {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    generatedAt: new Date().toISOString(),
    tables: data.tables,
    tombstones: data.tombstones,
  };
  return JSON.stringify(payload);
}

/**
 * 将 JSON 字符串反序列化为快照载荷。
 *
 * @throws 当不认识 formatVersion 时抛 Error
 */
export function deserializeSnapshot(json: string): SnapshotPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('快照反序列化失败：无效的 JSON 格式');
  }

  const payload = parsed as SnapshotPayload;

  if (!payload || typeof payload.formatVersion !== 'number') {
    throw new Error('快照反序列化失败：缺少 formatVersion 或类型错误');
  }

  if (payload.formatVersion !== SNAPSHOT_FORMAT_VERSION) {
    throw new Error(
      `不支持的快照格式版本 ${payload.formatVersion}（当前支持版本 ${SNAPSHOT_FORMAT_VERSION}）；` +
      '请升级客户端以兼容此版本',
    );
  }

  if (typeof payload.generatedAt !== 'string') {
    throw new Error('快照反序列化失败：缺少或无效的 generatedAt');
  }

  return payload;
}
