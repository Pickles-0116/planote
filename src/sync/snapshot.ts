/**
 * M2 存储通道 — 快照序列化 / 反序列化
 *
 * 将全部 SyncableTableName 表 + 墓碑集合序列化为单一的 state.json，
 * 供远端存储上传/下载。反序列化时校验 formatVersion 以防数据结构不兼容。
 *
 * 兼容性（v1.3-CloudSync-Trim）：
 * 反序列化时如果 tables 里出现非 SyncableTableName 的表名（例如旧版曾经同步过的
 * aiCallLogs / aiPlans），打 warn 并剔除，不抛错、不阻断同步。
 * 这样在版本过渡期可以读到历史快照；下一次推送时自然只写白名单内表。
 */

import type { Tombstone } from '@/db/sync/types';
import type { SyncableTableName } from '@/db/sync/types';

/** 当前快照格式版本号。递增表示 payload 结构发生不兼容变更。 */
export const SNAPSHOT_FORMAT_VERSION = 1;

/**
 * 序列化后的快照载荷结构。
 *
 * 注：实际 JSON 中 `tables` 可能是 `Record<string, ...>` 的子集（远端可能残留
 * 历史白名单外的表名），deserialize 时会做白名单过滤。
 */
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
 * 序列化时使用的合法表名集合（运行时白名单，依赖 SyncableTableName 的字面量）。
 * 抽出来便于反序列化过滤逻辑复用。
 */
const SYNCABLE_TABLE_NAMES = new Set<string>([
  'plans',
  'items',
  'blogs',
  'tags',
  'attachments',
  'frameworks',
  'blogTemplates',
  'collections',
  'collectionItems',
  'chatSessions',
  'folders',
  'skillFolders',
  'skills',
]);

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
 * 校验：
 * 1. JSON 合法
 * 2. formatVersion 存在且等于当前支持版本
 * 3. generatedAt 是合法字符串
 * 4. tables 字段若是对象，剔除不在白名单内的表名（打 warn，不阻断）
 *
 * @throws 当 formatVersion 不识别或 payload 结构异常时抛 Error
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

  // 白名单过滤：剔除不在 SyncableTableName 内的表名（兼容历史快照）。
  if (payload.tables && typeof payload.tables === 'object') {
    const raw = payload.tables as Record<string, unknown>;
    const filtered: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
    const dropped: string[] = [];
    for (const [name, rows] of Object.entries(raw)) {
      if (SYNCABLE_TABLE_NAMES.has(name)) {
        if (Array.isArray(rows)) {
          filtered[name as SyncableTableName] = rows as Record<string, unknown>[];
        } else {
          // 表名合法但 rows 不是数组 → 视为空数组
          filtered[name as SyncableTableName] = [];
        }
      } else {
        dropped.push(name);
      }
    }
    if (dropped.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[sync] 快照中忽略非白名单表（已从历史版本同步中剔除）：${dropped.join(', ')}`,
      );
    }
    payload.tables = filtered;
  }

  if (!Array.isArray(payload.tombstones)) {
    // 旧快照可能没有 tombstones 字段，兜底为空数组而非抛错。
    payload.tombstones = [];
  }

  return payload;
}
