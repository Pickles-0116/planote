/**
 * 分片缓存测试（v1.3-CloudSync-DirtyChunk）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { ChunkCache, CHUNK_CACHE_KEY } from '../chunk-cache';
import { buildManifest, type ChunkedManifest } from '../chunks';

interface MetaRow {
  key: string;
  value: unknown;
}

class TestMetaDB extends Dexie {
  meta!: Table<MetaRow, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ meta: '&key' });
  }
}

describe('ChunkCache', () => {
  let db: TestMetaDB;
  let cache: ChunkCache;

  beforeEach(async () => {
    db = new TestMetaDB(`test-cache-${Math.random().toString(36).slice(2)}`);
    cache = new ChunkCache();
  });

  it('空状态：isEmpty true', () => {
    expect(cache.isEmpty()).toBe(true);
  });

  it('load 空 meta → 空缓存', async () => {
    await cache.load(db);
    expect(cache.isEmpty()).toBe(true);
  });

  it('load 时 value 损坏 → 空缓存', async () => {
    await db.meta.put({ key: CHUNK_CACHE_KEY, value: 'corrupt' });
    await cache.load(db);
    expect(cache.isEmpty()).toBe(true);
  });

  it('updateFromManifest 写入 + persist + load 往返', async () => {
    const manifest: ChunkedManifest = buildManifest(
      {
        'chunk-0': {
          tables: ['plans', 'items'],
          subChunks: [{ name: 'chunk-0', sha: 'sha-chunk-0', size: 100 }],
        },
        'chunk-1': {
          tables: ['blogs'],
          subChunks: [
            { name: 'chunk-1-a', sha: 'sha-chunk-1-a', size: 50 },
            { name: 'chunk-1-b', sha: 'sha-chunk-1-b', size: 60 },
          ],
        },
      },
      { sha: 'tomb-sha', size: 10 },
    );
    const chunkJsonMap = new Map<string, string>([
      ['chunk-0', '{"tables":{"plans":[],"items":[]}}'],
      ['chunk-1-a', '{"tables":{"blogs":[{"id":"b1"}]}}'],
      ['chunk-1-b', '{"tables":{"blogs":[{"id":"b2"}]}}'],
    ]);
    cache.updateFromManifest(manifest, chunkJsonMap);
    expect(cache.isEmpty()).toBe(false);
    expect(cache.getChunk('chunk-0')?.sha).toBe('sha-chunk-0');
    expect(cache.getChunk('chunk-1-a')?.sha).toBe('sha-chunk-1-a');
    expect(cache.getChunk('chunk-1-b')?.sha).toBe('sha-chunk-1-b');
    expect(cache.keys()).toHaveLength(3);

    await cache.persist(db);

    const fresh = new ChunkCache();
    await fresh.load(db);
    expect(fresh.getChunk('chunk-0')?.sha).toBe('sha-chunk-0');
    expect(fresh.getChunk('chunk-1-b')?.json).toContain('b2');
  });

  it('findInconsistencies：远端 SHA 与缓存不匹配 → 返回不一致分片名', async () => {
    const manifest: ChunkedManifest = buildManifest(
      {
        'chunk-0': {
          tables: ['plans'],
          subChunks: [{ name: 'chunk-0', sha: 'remote-sha-0', size: 100 }],
        },
        'chunk-1': {
          tables: ['blogs'],
          subChunks: [{ name: 'chunk-1', sha: 'remote-sha-1', size: 200 }],
        },
      },
      { sha: 't', size: 1 },
    );
    cache.updateFromManifest(
      manifest,
      new Map<string, string>([
        ['chunk-0', '{}'],
        ['chunk-1', '{}'],
      ]),
    );

    // 模拟远端 chunk-0 SHA 变了
    const newerManifest: ChunkedManifest = buildManifest(
      {
        'chunk-0': {
          tables: ['plans'],
          subChunks: [{ name: 'chunk-0', sha: 'remote-sha-0-NEW', size: 100 }],
        },
        'chunk-1': {
          tables: ['blogs'],
          subChunks: [{ name: 'chunk-1', sha: 'remote-sha-1', size: 200 }],
        },
      },
      { sha: 't', size: 1 },
    );
    const mismatches = cache.findInconsistencies(newerManifest);
    expect(mismatches).toEqual(['chunk-0']);
  });

  it('clear 后 isEmpty true', () => {
    cache.clear();
    expect(cache.isEmpty()).toBe(true);
  });
});
