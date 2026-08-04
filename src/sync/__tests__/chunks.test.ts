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
  getSubChunkList,
  TABLE_TO_CHUNK,
  CHUNK_TO_TABLES,
  CHUNKED_FORMAT_VERSION,
  DATA_CHUNK_NAMES,
  TOMBSTONE_CHUNK_NAME,
  MAX_CHUNK_BASE64_BYTES,
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

    // chunk-2 应只有 tags（frameworks/blogTemplates 为空数组被跳过，符合新"只填存在的表"策略）
    const c2 = chunks.find((c) => c.name === 'chunk-2')!;
    expect(c2.payload.tables.tags).toHaveLength(1);
    expect(c2.payload.tables.frameworks).toBeUndefined();
    expect(c2.payload.tables.blogTemplates).toBeUndefined();
  });

  it('mergeChunksIntoSnapshot 拼回完整数据（无 tombstones）', () => {
    const manifest = buildManifest(
      { 'chunk-0': { tables: ['plans', 'items'], subChunks: [{ name: 'chunk-0', sha: 'a', size: 1 }] } },
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

describe('分片协议 — 子切（按体积再切）', () => {
  it('单表行数很多时按体积贪心切为多子片', () => {
    // 构造 100 条博客，每条约 5KB JSON → 总体积约 500KB → 至少切 3 片
    const blogs = Array.from({ length: 100 }, (_, i) => ({
      id: `b${i}`,
      title: `Blog #${i}`,
      content: 'X'.repeat(5000),
    }));
    const data = { tables: { blogs } };
    const chunks = splitSnapshotIntoChunks(data);

    // chunk-1 应被切为多个子片
    const blogChunks = chunks.filter((c) => c.name.startsWith('chunk-1'));
    expect(blogChunks.length).toBeGreaterThanOrEqual(3);

    // 子片命名约定：chunk-1-a, chunk-1-b, ...
    expect(blogChunks[0]?.name).toBe('chunk-1-a');
    expect(blogChunks[1]?.name).toBe('chunk-1-b');
    expect(blogChunks[2]?.name).toBe('chunk-1-c');

    // 每个子片序列化后 base64 字节数不超过 200KB
    for (const c of blogChunks) {
      const json = serializeChunk(c.payload);
      const base64Bytes = Math.ceil((json.length * 4) / 3);
      expect(base64Bytes).toBeLessThanOrEqual(MAX_CHUNK_BASE64_BYTES);
    }

    // 合并后能拼回所有 100 条
    const allBlogs = blogChunks.flatMap((c) => c.payload.tables.blogs ?? []);
    expect(allBlogs).toHaveLength(100);
  });

  it('小数据量时单子片（无后缀），保持向后兼容', () => {
    const data = {
      tables: {
        plans: [{ id: 'p1', title: 'short plan' }],
        blogs: [{ id: 'b1', title: 'short blog' }],
      },
    };
    const chunks = splitSnapshotIntoChunks(data);
    const planChunks = chunks.filter((c) => c.name.startsWith('chunk-0'));
    const blogChunks = chunks.filter((c) => c.name.startsWith('chunk-1'));
    expect(planChunks).toHaveLength(1);
    expect(planChunks[0]?.name).toBe('chunk-0'); // 单子片无后缀
    expect(blogChunks[0]?.name).toBe('chunk-1');
  });

  it('mergeChunksIntoSnapshot 能从多子片拼回完整表', () => {
    const data = {
      tables: {
        blogs: Array.from({ length: 100 }, (_, i) => ({
          id: `b${i}`,
          title: `Blog ${i}`,
          content: 'X'.repeat(5000),
        })),
      },
    };
    const chunks = splitSnapshotIntoChunks(data);
    const blogChunks = chunks.filter((c) => c.name.startsWith('chunk-1'));
    expect(blogChunks.length).toBeGreaterThan(1);

    const manifest = buildManifest(
      {
        'chunk-1': {
          tables: ['blogs'],
          subChunks: blogChunks.map((c) => ({ name: c.name, sha: 'fake', size: 100 })),
        },
      },
      { sha: 'tomb', size: 10 },
    );
    const merged = mergeChunksIntoSnapshot(manifest, blogChunks, []);
    expect(merged.tables.blogs).toHaveLength(100);
  });

  it('getSubChunkList 兼容老版 manifest 形态（无 subChunks）', () => {
    const legacy = { sha: 'abc', size: 100, tables: ['plans'] as SyncableTableName[] };
    const subs = getSubChunkList(legacy, 'chunk-0');
    expect(subs).toHaveLength(1);
    expect(subs[0]?.name).toBe('chunk-0');
    expect(subs[0]?.sha).toBe('abc');
  });

  it('getSubChunkList 读取新版 manifest.subChunks', () => {
    const modern: { tables: SyncableTableName[]; subChunks: Array<{ name: string; sha: string; size: number }> } = {
      tables: ['blogs'],
      subChunks: [
        { name: 'chunk-1-a', sha: 'a', size: 100 },
        { name: 'chunk-1-b', sha: 'b', size: 200 },
      ],
    };
    const subs = getSubChunkList(modern, 'chunk-1');
    expect(subs).toHaveLength(2);
    expect(subs[0]?.name).toBe('chunk-1-a');
  });
});

describe('分片协议 — manifest', () => {
  it('buildManifest 包含必要字段', () => {
    const m = buildManifest(
      { 'chunk-0': { tables: ['plans'], subChunks: [{ name: 'chunk-0', sha: 'abc', size: 100 }] } },
      { sha: 'tomb-sha', size: 50 },
    );
    expect(m.formatVersion).toBe(CHUNKED_FORMAT_VERSION);
    expect(m.chunks['chunk-0'] && 'subChunks' in m.chunks['chunk-0']
      ? m.chunks['chunk-0'].subChunks[0]?.sha
      : undefined).toBe('abc');
    expect(m.tombstoneChunk).toBe(TOMBSTONE_CHUNK_NAME);
    expect(m.tombstoneSha).toBe('tomb-sha');
  });
});
