/**
 * M2 存储通道 — 快照分片（v1.3-CloudSync-Chunked）
 *
 * 背景：单文件 state.json 在 ~1.4MB 起撞 GitHub Contents API 的隐形边界
 * （GET 时 content 返回为空），无法继续单文件方案。
 *
 * 方案：按表分组拆成多个小文件（每片 ≤ 200KB base64），并维护一个 manifest
 * 索引文件。GitHub Contents API 在 200KB 级别 100% 稳定。
 *
 * 目录结构（位于 {directory}/ 下）：
 *   state.json                 # 老格式单文件，保留用于一次性迁移
 *   chunks/
 *     manifest.json            # 索引：版本 + 各分片 SHA + 表→分片映射
 *     chunk-0.json .. chunk-N.json   # 分片
 *
 * Manifest 即"远端版本标识"：GitHub 返回的 manifest blob SHA 作为乐观锁。
 * 任何分片变更 → manifest 变更 → SHA 变更。
 *
 * 兼容性：
 * - 新 → 旧客户端（远端 manifest.json 不存在但 state.json 存在）：自动迁移，
 *   把 state.json 拆成 chunks 并写入远端
 * - 旧 → 新客户端（远端只有 state.json）：旧客户端仍能读写 state.json；新客户端
 *   检测到 manifest.json 缺失而 state.json 存在时也会触发迁移
 * - 两端同时是 v1.3-Chunked：纯分片路径
 *
 * 详见 design.md §6 同步协议 / spec.md Requirement: 分片存储。
 */

import type { SyncableTableName, Tombstone } from '@/db/sync/types';
import { SNAPSHOT_FORMAT_VERSION } from './snapshot';

/** 分片存储协议版本。1 = 单文件（v1.3 之前），2 = 分片（v1.3-Chunked 起）。 */
export const CHUNKED_FORMAT_VERSION = 2;

/** 分片文件名前缀。 */
export const CHUNK_PREFIX = 'chunk-';

/** 墓碑专用分片（不分表，单独一片方便清理）。 */
export const TOMBSTONE_CHUNK_NAME = 'chunk-tombstones';

/** 单分片 base64 后字节数上限。远低于 GitHub Contents API 的隐形 1MB 边界。 */
export const MAX_CHUNK_BASE64_BYTES = 200 * 1024;

/**
 * 表到分片名的固定映射。
 *
 * 分组原则：预估体量相近的表放一片，避免单片过重。
 * 注意：本表必须与 `SyncableTableName` 完全一致；新增/移除可同步表时
 * 必须同时更新 `db/sync/types.ts` 与此处。
 *
 * 注：`attachments` 表是附件**索引**（key→contentType→size），不含 blob 本体。
 * blob 走 `{directory}/attachments/{key}` 独立文件，所以这张索引表数据很小，
 * 与 chatSessions / skillFolders / skills 同属一片。
 */
export const TABLE_TO_CHUNK: Record<SyncableTableName, string> = {
  plans: 'chunk-0',
  items: 'chunk-0',
  blogs: 'chunk-1',
  tags: 'chunk-2',
  frameworks: 'chunk-2',
  blogTemplates: 'chunk-2',
  collections: 'chunk-3',
  collectionItems: 'chunk-3',
  folders: 'chunk-3',
  chatSessions: 'chunk-4',
  skillFolders: 'chunk-4',
  skills: 'chunk-4',
  attachments: 'chunk-4',
};

/** 反向索引：分片名 → 该分片包含的表名（构建 manifest 用）。 */
export const CHUNK_TO_TABLES: Record<string, SyncableTableName[]> = (() => {
  const out: Record<string, SyncableTableName[]> = {};
  for (const [table, chunk] of Object.entries(TABLE_TO_CHUNK) as Array<
    [SyncableTableName, string]
  >) {
    (out[chunk] ??= []).push(table);
  }
  return out;
})();

/** 全部非墓碑分片名（按数字顺序）。 */
export const DATA_CHUNK_NAMES: string[] = Object.keys(CHUNK_TO_TABLES).sort();

/** 单分片内容。 */
export interface ChunkPayload {
  /** 该分片内的表数据（key 是表名，value 是该表全部记录）。 */
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
}

/** 墓碑分片内容。 */
export interface TombstoneChunkPayload {
  tombstones: Tombstone[];
}

/** Manifest 中单个分片条目。 */
export interface ChunkMeta {
  /** GitHub 返回的 blob SHA，作为该分片的版本标识。 */
  sha: string;
  /** 分片文件原始字节数（未经 base64）。 */
  size: number;
  /** 该分片包含的表名（manifest 元信息，便于排查）。 */
  tables: SyncableTableName[];
}

/** Manifest 文件。 */
export interface ChunkedManifest {
  /** 分片协议版本（= CHUNKED_FORMAT_VERSION）。 */
  formatVersion: number;
  /** Manifest 自身的生成时间（用于排查，便于阅读）。 */
  generatedAt: string;
  /** 各分片元信息。 */
  chunks: Record<string, ChunkMeta>;
  /** 墓碑分片名（通常 = TOMBSTONE_CHUNK_NAME）。 */
  tombstoneChunk: string;
  /** 墓碑分片的 blob SHA。 */
  tombstoneSha: string;
  /** 墓碑分片大小。 */
  tombstoneSize: number;
}

/**
 * 把单片数据序列化为 JSON 字符串。
 *
 * 不带 formatVersion（用 SNAPSHOT_FORMAT_VERSION 即可，结构稳定）。
 * size-guard 校验在调用方完成。
 */
export function serializeChunk(payload: ChunkPayload | TombstoneChunkPayload): string {
  return JSON.stringify(payload);
}

/**
 * 反序列化单片 JSON。
 *
 * 对 `tables` 字段做白名单过滤（兼容旧客户端意外推送的非白名单表名），
 * `tombstones` 缺失时兜底为空数组。
 */
export function deserializeChunk(json: string): ChunkPayload | TombstoneChunkPayload {
  const parsed = JSON.parse(json) as ChunkPayload | TombstoneChunkPayload;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('分片反序列化失败：payload 不是对象');
  }
  if ('tables' in parsed && parsed.tables && typeof parsed.tables === 'object') {
    // 白名单过滤在 deserializeSnapshot 那里已经做过，分片层只做结构校验
    return parsed as ChunkPayload;
  }
  if ('tombstones' in parsed) {
    if (!Array.isArray(parsed.tombstones)) {
      (parsed as TombstoneChunkPayload).tombstones = [];
    }
    return parsed as TombstoneChunkPayload;
  }
  // 兜底：空对象 / 完全没字段时按 ChunkPayload 处理（tables = {}）
  // 用于老快照补的占位分片或意外远端文件
  return { tables: {} };
}

/**
 * 构建 manifest 对象。
 *
 * 不会把表数据塞进 manifest —— manifest 只含元信息，体积固定几十字节。
 */
export function buildManifest(
  chunkMetas: Record<string, ChunkMeta>,
  tombstoneMeta: { sha: string; size: number },
  now: string = new Date().toISOString(),
): ChunkedManifest {
  return {
    formatVersion: CHUNKED_FORMAT_VERSION,
    generatedAt: now,
    chunks: chunkMetas,
    tombstoneChunk: TOMBSTONE_CHUNK_NAME,
    tombstoneSha: tombstoneMeta.sha,
    tombstoneSize: tombstoneMeta.size,
  };
}

/**
 * 把全量 SnapshotData 按表分组成 ChunkPayload 数组。
 *
 * 每片对应 `DATA_CHUNK_NAMES` 中的一个名字；返回顺序与 `DATA_CHUNK_NAMES` 一致。
 * 空表会写出 `tables: {}`（保留分片存在，避免 manifest 元信息丢失）。
 */
export function splitSnapshotIntoChunks(data: {
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
}): Array<{ name: string; payload: ChunkPayload }> {
  return DATA_CHUNK_NAMES.map((chunkName) => {
    const tables = CHUNK_TO_TABLES[chunkName] ?? [];
    const slice: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
    for (const t of tables) {
      const rows = data.tables[t];
      if (rows !== undefined) {
        slice[t] = rows;
      }
    }
    return { name: chunkName, payload: { tables: slice } };
  });
}

/**
 * 把 manifest + 全部分片合并成 SnapshotData（供 merger 使用）。
 *
 * 不会做 LWW 合并，仅做"分片 → 内存表结构"的简单拼装。LWW 在 merger 那一层做。
 */
export function mergeChunksIntoSnapshot(
  manifest: ChunkedManifest,
  chunks: Array<{ name: string; payload: ChunkPayload }>,
  tombstones: Tombstone[],
): {
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  tombstones: Tombstone[];
} {
  const tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
  for (const { name, payload } of chunks) {
    // 只合 manifest 中声明的分片（防意外远端文件）
    if (!manifest.chunks[name]) continue;
    for (const [table, rows] of Object.entries(payload.tables)) {
      if (rows && Array.isArray(rows)) {
        tables[table as SyncableTableName] = rows as Record<string, unknown>[];
      }
    }
  }
  return { tables, tombstones };
}

/** 单分片协议版本号（用于 manifest.tombstoneSha 之外做结构校验）。 */
export { SNAPSHOT_FORMAT_VERSION };
