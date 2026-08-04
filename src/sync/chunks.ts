/**
 * M2 存储通道 — 快照分片（v1.3-CloudSync-Chunked）
 *
 * 背景：单文件 state.json 在 ~1.4MB 起撞 GitHub Contents API 的隐形边界
 * （GET 时 content 返回为空），无法继续单文件方案。
 *
 * 方案：按表分组 + 单表内按体积贪心再切，确保单分片 ≤ 200KB base64。
 * GitHub Contents API 在 200KB 级别 100% 稳定。
 *
 * 目录结构（位于 {directory}/ 下）：
 *   state.json                 # 老格式单文件，保留用于一次性迁移
 *   state.json.legacy          # 迁移完成后由新代码写一份备份
 *   chunks/
 *     manifest.json            # 索引：版本 + 各逻辑分片 → 子片数组
 *     chunk-0.json             # plans + items（一般单子片就够）
 *     chunk-1-a.json           # blogs 第一子片（前 N 条）
 *     chunk-1-b.json           # blogs 第二子片
 *     chunk-1-c.json           # blogs 第三子片
 *     chunk-tombstones.json    # 墓碑（不分表，单独一片）
 *
 * 命名约定：
 * - 逻辑分片（按表）= `chunk-N`（N = 0..4）
 * - 子片（按体积再切）= `chunk-N-<letter>`，其中 letter 从 `a` 起递增
 * - 单子片时用 `chunk-N`（无后缀），保持与 v1.3-Chunked 旧版 manifest 兼容
 *
 * Manifest 形式：
 * {
 *   "formatVersion": 2,
 *   "chunks": {
 *     "chunk-0": {
 *       "tables": ["plans", "items"],
 *       "subChunks": [{ "name": "chunk-0", "sha": "...", "size": 1234 }]
 *     },
 *     "chunk-1": {
 *       "tables": ["blogs"],
 *       "subChunks": [
 *         { "name": "chunk-1-a", "sha": "...", "size": 1234 },
 *         { "name": "chunk-1-b", "sha": "...", "size": 1234 }
 *       ]
 *     }
 *   }
 * }
 *
 * 兼容：旧版 manifest（chunks[key] 直接有 sha/size/tables，没有 subChunks）—
 * GitHubBackend 把它当作"单子片，子片名 = chunk key"。
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
  /** 该分片内的表数据（key 是表名，value 是该表在该分片中的部分记录）。 */
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
}

/** 墓碑分片内容。 */
export interface TombstoneChunkPayload {
  tombstones: Tombstone[];
}

/** 子片元信息（在 manifest 中）。 */
export interface SubChunkMeta {
  /** 子片文件名（不含 .json 后缀）。 */
  name: string;
  /** GitHub 返回的 blob SHA。 */
  sha: string;
  /** 子片文件原始字节数。 */
  size: number;
}

/** 逻辑分片元信息（在 manifest 中）。 */
export interface ChunkMeta {
  /** 该分片包含的表名。 */
  tables: SyncableTableName[];
  /** 子片列表（1 个或多个）。单子片时 name == chunk key（向后兼容老 manifest）。 */
  subChunks: SubChunkMeta[];
}

/** 老版 ChunkMeta 形态（v1.3-Chunked 首版，无 subChunks 字段）。 */
interface LegacyChunkMeta {
  sha: string;
  size: number;
  tables: SyncableTableName[];
}

/** Manifest 文件。 */
export interface ChunkedManifest {
  /** 分片协议版本（= CHUNKED_FORMAT_VERSION）。 */
  formatVersion: number;
  /** Manifest 自身的生成时间（用于排查，便于阅读）。 */
  generatedAt: string;
  /** 各逻辑分片元信息。 */
  chunks: Record<string, ChunkMeta | LegacyChunkMeta>;
  /** 墓碑分片名（通常 = TOMBSTONE_CHUNK_NAME）。 */
  tombstoneChunk: string;
  /** 墓碑分片的 blob SHA。 */
  tombstoneSha: string;
  /** 墓碑分片大小。 */
  tombstoneSize: number;
}

/** 序列化后的子片载荷。 */
export function serializeChunk(payload: ChunkPayload | TombstoneChunkPayload): string {
  return JSON.stringify(payload);
}

/** 反序列化单子片 JSON。 */
export function deserializeChunk(json: string): ChunkPayload | TombstoneChunkPayload {
  const parsed = JSON.parse(json) as ChunkPayload | TombstoneChunkPayload;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('分片反序列化失败：payload 不是对象');
  }
  if ('tables' in parsed && parsed.tables && typeof parsed.tables === 'object') {
    return parsed as ChunkPayload;
  }
  if ('tombstones' in parsed) {
    if (!Array.isArray(parsed.tombstones)) {
      (parsed as TombstoneChunkPayload).tombstones = [];
    }
    return parsed as TombstoneChunkPayload;
  }
  return { tables: {} };
}

/** 构造字母后缀：0→a, 1→b, ..., 25→z, 26→aa, ...（理论上不会超过）。 */
function subChunkSuffix(index: number): string {
  // 简单实现：a-z（最多 26 子片）
  return String.fromCharCode(97 + index);
}

/**
 * 估算某个表的所有记录 JSON 序列化后的字节数。
 *
 * 不真的序列化（开销大），用 `JSON.stringify` 的近似公式：每行 ~1 字节（保守）。
 * 返回值用于切分决策。
 */
function estimateTableBytes(rows: Record<string, unknown>[]): number {
  return rows.length * 200; // 保守估计：每行 200 字节
}

/**
 * 把一个表的记录列表按体积贪心切成多片。
 *
 * 策略：按顺序累加记录，累到接近但不超过上限就成一片，开下一片。
 * 返回数组每个元素是该子片包含的记录子集（保持原顺序）。
 *
 * @param rows 待切分的记录列表
 * @param maxBytes 单子片字节数上限（默认 = MAX_CHUNK_BASE64_BYTES）
 */
export function splitTableByBytes(
  rows: Record<string, unknown>[],
  maxBytes: number = MAX_CHUNK_BASE64_BYTES,
): Record<string, unknown>[][] {
  if (rows.length === 0) return [[]];
  const result: Record<string, unknown>[][] = [];
  let current: Record<string, unknown>[] = [];
  let currentBytes = 0;

  for (const row of rows) {
    // 真实估算：JSON.stringify 该行长度 * 4/3 接近 base64 后大小
    const rowBase64Bytes = Math.ceil((JSON.stringify(row).length * 4) / 3);
    if (current.length > 0 && currentBytes + rowBase64Bytes > maxBytes) {
      result.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += rowBase64Bytes;
  }
  if (current.length > 0) result.push(current);
  return result;
}

/**
 * 把单条记录列表（不分表）按体积切成多个 ChunkPayload。
 *
 * 内部按表先分，再按体积子切。返回 [{name, payload}, ...]，
 * 顺序 = DATA_CHUNK_NAMES 顺序，每片内子片按字母序。
 */
export function splitSnapshotIntoChunks(data: {
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
}): Array<{ name: string; payload: ChunkPayload }> {
  const out: Array<{ name: string; payload: ChunkPayload }> = [];
  for (const chunkName of DATA_CHUNK_NAMES) {
    const tableNames = CHUNK_TO_TABLES[chunkName] ?? [];
    // 先按"片内子片"组织：每张表切 N 个子片，所有表的子片交叉合并？
    // 简化策略：每张表独立切子片，子片名 = chunkName-a, chunkName-b...
    // 不同表的子片 index 对齐（如 plans 切 2 片 + items 切 2 片 → 都叫 chunk-0-a/b）
    // 实际方案：把同一逻辑分片内所有表的记录合并后一起切
    const allRows: Array<{ table: SyncableTableName; row: Record<string, unknown> }> = [];
    for (const t of tableNames) {
      const rows = data.tables[t];
      if (rows && rows.length > 0) {
        for (const row of rows) {
          allRows.push({ table: t, row });
        }
      }
    }
    if (allRows.length === 0) {
      // 空表也写一个空子片（保留分片存在）
      out.push({ name: chunkName, payload: { tables: {} } });
      continue;
    }
    // 按顺序贪心切
    const slices = sliceByBytes(allRows, MAX_CHUNK_BASE64_BYTES);
    if (slices.length === 1) {
      // 单子片：name 用 chunkName（无后缀）—— 向后兼容
      const slice = slices[0]!;
      const tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
      for (const { table, row } of slice) {
        (tables[table] ??= []).push(row);
      }
      out.push({ name: chunkName, payload: { tables } });
    } else {
      slices.forEach((slice, i) => {
        const tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
        for (const { table, row } of slice) {
          (tables[table] ??= []).push(row);
        }
        out.push({ name: `${chunkName}-${subChunkSuffix(i)}`, payload: { tables } });
      });
    }
  }
  return out;
}

/** 内部：贪心切分 [{table, row}, ...] 为多片。
 *
 * 关键：评估"加进这一行后是否超限"——而不是加完再判断。避免最后一行挤进
 * 已经接近上限的片后，序列化 JSON 包裹 `{tables: {...}}` 也会增加字节数
 * 导致总片大小实际超过 maxBytes。
 */
function sliceByBytes(
  items: Array<{ table: SyncableTableName; row: Record<string, unknown> }>,
  maxBytes: number,
): Array<Array<{ table: SyncableTableName; row: Record<string, unknown> }>> {
  const out: Array<Array<{ table: SyncableTableName; row: Record<string, unknown> }>> = [];
  let current: typeof items = [];
  let currentBytes = 0;
  for (const item of items) {
    const rowBase64Bytes = Math.ceil((JSON.stringify(item.row).length * 4) / 3);
    // 预估本片"加上这一行 + JSON 包裹开销"后的总大小
    const projectedBytes = currentBytes + rowBase64Bytes + ENVELOPE_OVERHEAD_BYTES;
    if (current.length > 0 && projectedBytes > maxBytes) {
      out.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += rowBase64Bytes;
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** 分片序列化后的 JSON 包裹（`{"tables":{[...]}}`）字节数开销估算。 */
const ENVELOPE_OVERHEAD_BYTES = 30;

/**
 * 构建 manifest 对象。
 *
 * 接收拆分后的"逻辑分片 → 子片列表"映射，组装成完整 manifest。
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
 * 把 manifest + 全部子片合并成 SnapshotData。
 *
 * 兼容两种 manifest 形态：
 * 1. 新版：chunks[key].subChunks 是子片数组
 * 2. 老版：chunks[key] 直接是 {sha, size, tables}（当作单子片）
 */
export function mergeChunksIntoSnapshot(
  manifest: ChunkedManifest,
  subChunks: Array<{ name: string; payload: ChunkPayload }>,
  tombstones: Tombstone[],
): {
  tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>>;
  tombstones: Tombstone[];
} {
  const tables: Partial<Record<SyncableTableName, Record<string, unknown>[]>> = {};
  // 用子片 name → payload 索引
  const byName = new Map<string, ChunkPayload>();
  for (const { name, payload } of subChunks) {
    byName.set(name, payload);
  }
  for (const [chunkKey, meta] of Object.entries(manifest.chunks)) {
    const subList = getSubChunkList(meta, chunkKey);
    for (const sub of subList) {
      const payload = byName.get(sub.name);
      if (!payload) continue;
      for (const [table, rows] of Object.entries(payload.tables)) {
        if (rows && Array.isArray(rows)) {
          (tables[table as SyncableTableName] ??= []).push(
            ...(rows as Record<string, unknown>[]),
          );
        }
      }
    }
  }
  return { tables, tombstones };
}

/**
 * 从 ChunkMeta 提取子片列表（兼容老版 ChunkMeta 形态）。
 */
export function getSubChunkList(
  meta: ChunkMeta | LegacyChunkMeta,
  chunkKey: string,
): SubChunkMeta[] {
  if ('subChunks' in meta && Array.isArray((meta as ChunkMeta).subChunks)) {
    return (meta as ChunkMeta).subChunks;
  }
  // 老版：当作单子片
  const legacy = meta as LegacyChunkMeta;
  return [{ name: chunkKey, sha: legacy.sha, size: legacy.size }];
}

/** 单分片协议版本号。 */
export { SNAPSHOT_FORMAT_VERSION };

// 抑制 unused 警告（estimateTableBytes 暂未使用，预留）
void estimateTableBytes;
