/**
 * 分片协议测试（v1.3-CloudSync-Chunked）
 *
 * 验证：
 * - splitSnapshotIntoChunks 按表分组覆盖所有 SyncableTable
 * - mergeChunksIntoSnapshot 拼回完整 SnapshotData
 * - serialize/deserializeChunk 往返一致
 * - buildManifest 结构正确
 * - tombstones 单独一片
 */

import { describe, it, expect } from 'vitest';
import {
  splitSnapshotIntoChunks,
  mergeChunksIntoSnapshot,
  serializeChunk,
  deserializeChunk,
  buildManifest,
  TABLE_TO_CHUNK,
  CHUNK_TO_TABLES,
  CHUNKED_FORMAT_VERSION,
  DATA_CHUNK_NAMES,
  TOMBSTONE_CHUNK_NAME,
} from '../chunks';
import type { SyncableTableName, Tombstone } from '@/db/sync/types';

describe('分片协议 — 表分组', () => {
  it('TABLE_TO_CHUNK 覆盖全部 SyncableTable', () => {
    // 静态断言：所有可同步表都被分到某一片
    const tables: SyncableTableName[] = [
      'plans', 'items', 'blogs', 'tags', 'frameworks', 'blogTemplates',
      'collections', 'collectionItems', 'folders', 'chatSessions',
      'skillFolders', 'skills', 'attachments',
    ];
    for (const t of tables) {
      expect(TABLE_TO_CHUNK[t]).toBeTruthy();
    }
  });

  it('blogs 单独成片（最重的）', () => {
    expect(TABLE_TO_CHUNK.blogs).toBe('chunk-1');
  });

  it('tombstone 是独立分片名', () => {
    expect(TOMBSTONE_CHUNK_NAME).toBe('chunk-tombstones');
    expect(DATA_CHUNK_NAMES).not.toContain(TOMBSTONE_CHUNK_NAME);
  });

  it('CHUNK_TO_TABLES 与 TABLE_TO_CHUNK 一致', () => {
    for (const [table, chunk] of Object.entries(TABLE_TO_CHUNK) as Array<[SyncableTableName, string]>) {
      expect(CHUNK_TO_TABLES[chunk]).toContain(table);
    }
  });
});

describe('分片协议 — split / merge', () => {
  it('splitSnapshotIntoChunks 把所有表拆分到正确分片', () => {
    const data = {
      tables: {
        plans: [{ id: 'p1', title: 'plan' }],
        items: [{ id: 'i1', title: 'item' }],
        blogs: [{ id: 'b1', title: 'blog' }],
        tags: [{ id: 't1', name: 'tag' }],
        frameworks: [],
        blogTemplates: [],
        collections: [],
        collectionItems: [],
        folders: [],
        chatSessions: [],
        skillFolders: [],
        skills: [],
        attachments: [],
      } as Partial<Record<SyncableTableName, Record<string, unknown>[]>>,
    };

    const chunks = splitSnapshotIntoChunks(data);
    expect(chunks.length).toBe(DATA_CHUNK_NAMES.length);

    // chunk-0 应包含 plans + items
    const c0 = chunks.find((c) => c.name === 'chunk-0')!;
    expect(c0.payload.tables.plans).toHaveLength(1);
    expect(c0.payload.tables.items).toHaveLength(1);

    // chunk-1 应只有 blogs
    const c1 = chunks.find((c) => c.name === 'chunk-1')!;
    expect(c1.payload.tables.blogs).toHaveLength(1);
    expect(Object.keys(c1.payload.tables)).toEqual(['blogs']);

    // chunk-2 应只有 tags / frameworks / blogTemplates
    const c2 = chunks.find((c) => c.name === 'chunk-2')!;
    expect(c2.payload.tables.tags).toHaveLength(1);
    expect(c2.payload.tables.frameworks).toEqual([]);
  });

  it('mergeChunksIntoSnapshot 拼回完整数据（无 tombstones）', () => {
    const manifest = buildManifest(
      { 'chunk-0': { sha: 'a', size: 1, tables: ['plans', 'items'] } },
      { sha: 't', size: 1 },
    );
    const chunks = [
      { name: 'chunk-0', payload: { tables: { plans: [{ id: 'p1' }], items: [{ id: 'i1' }] } } },
    ];
    const merged = mergeChunksIntoSnapshot(manifest, chunks, []);
    expect(merged.tables.plans).toHaveLength(1);
    expect(merged.tables.items).toHaveLength(1);
    expect(merged.tombstones).toEqual([]);
  });

  it('mergeChunksIntoSnapshot tombstones 透传', () => {
    const manifest = buildManifest({}, { sha: 't', size: 1 });
    const tombstones: Tombstone[] = [
      { id: 'ts01', table: 'plans', recordId: 'p-deleted', deletedAt: '2026-08-01' },
    ];
    const merged = mergeChunksIntoSnapshot(manifest, [], tombstones);
    expect(merged.tombstones).toHaveLength(1);
  });
});

describe('分片协议 — serialize / deserialize', () => {
  it('serializeChunk + deserializeChunk 往返一致', () => {
    const payload = { tables: { plans: [{ id: 'p1', title: '测试计划 📚' }] } };
    const json = serializeChunk(payload);
    const parsed = deserializeChunk(json) as { tables: Record<string, unknown[]> };
    expect(parsed.tables.plans).toEqual([{ id: 'p1', title: '测试计划 📚' }]);
  });

  it('serializeChunk 包含中文 + emoji 也能往返', () => {
    const payload = { tombstones: [
      { id: 'ts1', table: 'plans' as const, recordId: 'p1', deletedAt: '2026-08-01T00:00:00Z' },
    ] };
    const json = serializeChunk(payload);
    const parsed = deserializeChunk(json) as { tombstones: Tombstone[] };
    expect(parsed.tombstones).toHaveLength(1);
    expect(parsed.tombstones[0]!.recordId).toBe('p1');
  });

  it('空对象 / 缺字段时按 ChunkPayload 兜底（tables = {}）', () => {
    const json = JSON.stringify({});
    const parsed = deserializeChunk(json) as { tables: Record<string, unknown[]> };
    expect(parsed.tables).toEqual({});
  });

  it('tombstones 非数组时降级为 []', () => {
    const json = JSON.stringify({ tombstones: 'not-array' });
    const parsed = deserializeChunk(json) as { tombstones: Tombstone[] };
    expect(parsed.tombstones).toEqual([]);
  });

  it('payload 不是对象时抛错', () => {
    expect(() => deserializeChunk('null')).toThrow();
    expect(() => deserializeChunk('"string"')).toThrow();
  });
});

describe('分片协议 — manifest', () => {
  it('buildManifest 包含必要字段', () => {
    const m = buildManifest(
      { 'chunk-0': { sha: 'abc', size: 100, tables: ['plans'] } },
      { sha: 'tomb-sha', size: 50 },
    );
    expect(m.formatVersion).toBe(CHUNKED_FORMAT_VERSION);
    expect(m.chunks['chunk-0']?.sha).toBe('abc');
    expect(m.tombstoneChunk).toBe(TOMBSTONE_CHUNK_NAME);
    expect(m.tombstoneSha).toBe('tomb-sha');
  });
});
