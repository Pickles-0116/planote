/**
 * 脏分片追踪器测试（v1.3-CloudSync-DirtyChunk）
 *
 * 不依赖 PlanoteDB 完整 schema（避免 fake-indexeddb + jsdom 下 Dexie close 的
 * CustomEvent 问题），只用 fake-indexeddb 单独构造一个带 meta 表的极简 DB。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { DirtyChunkTracker, _resetDirtyTracker, DIRTY_CHUNKS_KEY } from '../dirty-tracker';

interface MetaRow {
  key: string;
  value: unknown;
}

/** 极简测试 DB：只含 meta 表（dirty-tracker 唯一需要的表）。 */
class TestMetaDB extends Dexie {
  meta!: Table<MetaRow, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ meta: '&key' });
  }
}

describe('DirtyChunkTracker（内存 API）', () => {
  let tracker: DirtyChunkTracker;

  beforeEach(() => {
    tracker = new DirtyChunkTracker();
  });

  afterEach(() => {
    _resetDirtyTracker();
  });

  it('markDirty 把表名映射到逻辑分片', () => {
    tracker.markDirty('blogs'); // → chunk-1
    tracker.markDirty('plans'); // → chunk-0
    tracker.markDirty('items'); // → chunk-0（同 chunk）
    const dirty = tracker.getDirtyChunks();
    expect(dirty).toEqual(new Set(['chunk-0', 'chunk-1']));
  });

  it('同分片多次 markDirty 不会覆盖首次时间戳', () => {
    tracker.markDirty('blogs');
    const first = (tracker as unknown as { dirty: Map<string, string> }).dirty.get('chunk-1');
    tracker.markDirty('blogs');
    tracker.markDirty('blogs');
    const after = (tracker as unknown as { dirty: Map<string, string> }).dirty.get('chunk-1');
    expect(after).toBe(first);
    expect(tracker.size()).toBe(1); // 只 chunk-1 一次
  });

  it('markPushed 清空脏集合', () => {
    tracker.markDirty('blogs');
    tracker.markPushed();
    expect(tracker.isEmpty()).toBe(true);
  });

  it('reset 强制清空', () => {
    tracker.markDirty('blogs');
    tracker.reset();
    expect(tracker.isEmpty()).toBe(true);
  });

  it('hasPendingPersist 在 markDirty 后变 true，persist 后变 false', async () => {
    const db = new TestMetaDB(`test-meta-${Math.random().toString(36).slice(2)}`);
    // 注：不调 db.close()（fake-indexeddb + jsdom 下 Dexie._close 路径有 CustomEvent 兼容问题）
    expect(tracker.hasPendingPersist()).toBe(false);
    tracker.markDirty('blogs');
    expect(tracker.hasPendingPersist()).toBe(true);
    await tracker.persist(db);
    expect(tracker.hasPendingPersist()).toBe(false);
  });
});

describe('DirtyChunkTracker（持久化往返）', () => {
  let db: TestMetaDB;

  beforeEach(async () => {
    db = new TestMetaDB(`test-meta-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    _resetDirtyTracker();
  });

  it('persist + load 完整往返', async () => {
    const t1 = new DirtyChunkTracker();
    t1.markDirty('blogs');
    t1.markDirty('plans');
    await t1.persist(db);

    const t2 = new DirtyChunkTracker();
    await t2.load(db);
    expect(t2.getDirtyChunks()).toEqual(new Set(['chunk-0', 'chunk-1']));
  });

  it('load 失败 / meta 损坏 → 保持空集合', async () => {
    await db.meta.put({ key: DIRTY_CHUNKS_KEY, value: 'corrupt-not-array' });
    const t = new DirtyChunkTracker();
    await t.load(db);
    expect(t.isEmpty()).toBe(true);
  });

  it('load 时 meta 不存在 → 空集合', async () => {
    const t = new DirtyChunkTracker();
    await t.load(db);
    expect(t.isEmpty()).toBe(true);
  });

  it('markPushed 后 persist + load 验证空', async () => {
    const t1 = new DirtyChunkTracker();
    t1.markDirty('blogs');
    t1.markPushed();
    await t1.persist(db);

    const t2 = new DirtyChunkTracker();
    await t2.load(db);
    expect(t2.isEmpty()).toBe(true);
  });
});
