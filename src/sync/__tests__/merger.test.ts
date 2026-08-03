/**
 * M3 合并规则单元测试（T3.4 / T3.5）
 *
 * 覆盖 design.md §4.3 判定表全部 6 种情况 + 缺失时间戳兜底 + 墓碑清理。
 */

import { describe, it, expect } from 'vitest';
import {
  mergeSnapshots,
  applyRemoteTombstones,
  filterExpiredTombstones,
} from '../../sync/merger';
import type { SyncableTableName, Tombstone } from '@/db/sync/types';

/** 辅助记录的接口（必须包含 id）。 */
interface TestRecord {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** 辅助：创建一个带时间戳的记录。 */
function rec(id: string, overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    id,
    title: `record-${id}`,
    updatedAt: '2026-07-30T10:00:00Z',
    createdAt: '2026-07-29T10:00:00Z',
    ...overrides,
  };
}

/** 辅助：创建一条墓碑。 */
function ts(
  recordId: string,
  deletedAt: string,
  table: SyncableTableName = 'plans',
): Tombstone {
  return {
    id: `ts-${recordId}`,
    table,
    recordId,
    deletedAt,
  };
}

// ==================== T3.4 六种合并情况 ====================

describe('mergeSnapshots — 合并规则（§4.3 判定表）', () => {
  it('情况1: 仅本地有记录 → 保留本地，推回远端', () => {
    const result = mergeSnapshots(
      { plans: [rec('p1')] },
      { plans: [] },
      [],
    );

    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.id).toBe('p1');
    expect(result.pushChanges).toContainEqual({ table: 'plans', recordId: 'p1' });
    expect(Object.keys(result.localDeletions)).toHaveLength(0);
  });

  it('情况2: 仅远端有记录 → 写入本地', () => {
    const result = mergeSnapshots(
      { plans: [] },
      { plans: [rec('p_remote')] },
      [],
    );

    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.id).toBe('p_remote');
    // 不需要推回
    expect(result.pushChanges).toHaveLength(0);
  });

  it('情况3: 两端都有，本地更新时间更晚 → 保留本地，推回远端', () => {
    const result = mergeSnapshots(
      { plans: [rec('p1', { updatedAt: '2026-07-30T12:00:00Z' })] },
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z' })] },
      [],
    );

    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.id).toBe('p1');
    expect(result.localWrites.plans![0]!.updatedAt).toBe('2026-07-30T12:00:00Z');
    expect(result.pushChanges).toContainEqual({ table: 'plans', recordId: 'p1' });
  });

  it('情况3: 两端都有，远端更新时间更晚 → 写入本地（远端版），不推回', () => {
    const result = mergeSnapshots(
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z' })] },
      { plans: [rec('p1', { updatedAt: '2026-07-30T12:00:00Z' })] },
      [],
    );

    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.id).toBe('p1');
    expect(result.localWrites.plans![0]!.updatedAt).toBe('2026-07-30T12:00:00Z');
    // 远端的版本更新，不需要推回
    expect(result.pushChanges).not.toContainEqual({ table: 'plans', recordId: 'p1' });
  });

  it('情况4: 两端都有，更新时间相同 → 视为一致，不动', () => {
    const result = mergeSnapshots(
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z', title: 'local' })] },
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z', title: 'remote' })] },
      [],
    );

    // 时间相同保留本地版本
    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.title).toBe('local');
    expect(result.pushChanges).not.toContainEqual({ table: 'plans', recordId: 'p1' });
  });

  it('情况5: 记录存在且有对应墓碑，墓碑时间 > 记录更新时间 → 执行删除', () => {
    const result = mergeSnapshots(
      { plans: [rec('p_to_delete', { updatedAt: '2026-07-30T10:00:00Z' })] },
      { plans: [] },
      [ts('p_to_delete', '2026-07-30T12:00:00Z')],
    );

    expect(result.localDeletions.plans).toContain('p_to_delete');
    // 不应出现在写入中
    expect(result.localWrites.plans).toBeUndefined();
  });

  it('情况6: 记录存在且有对应墓碑，墓碑时间 ≤ 记录更新时间 → 保留记录（删除后重建），按 LWW 处理', () => {
    const result = mergeSnapshots(
      { plans: [rec('p_rebuilt', { updatedAt: '2026-07-30T12:00:00Z', title: 'after-delete' })] },
      { plans: [] },
      [ts('p_rebuilt', '2026-07-30T10:00:00Z')], // 墓碑早于记录更新
    );

    // 墓碑时间 ≤ 记录时间，保留记录
    expect(result.localDeletions.plans).toBeUndefined();
    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.id).toBe('p_rebuilt');
    expect(result.pushChanges).toContainEqual({ table: 'plans', recordId: 'p_rebuilt' });
  });
});

// ==================== 缺失时间戳兜底 ====================

describe('mergeSnapshots — 缺失时间戳兜底', () => {
  it('updatedAt 缺失时用 createdAt 兜底', () => {
    const result = mergeSnapshots(
      { plans: [rec('p1', { updatedAt: undefined, createdAt: '2026-07-30T12:00:00Z' })] },
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z' })] },
      [],
    );

    // 本地 createdAt 较晚 → 保留本地
    expect(result.localWrites.plans![0]!.id).toBe('p1');
    expect(result.pushChanges).toContainEqual({ table: 'plans', recordId: 'p1' });
  });

  it('updatedAt 和 createdAt 都缺失 → 保留本地版本', () => {
    const result = mergeSnapshots(
      { plans: [rec('p1', { updatedAt: undefined, createdAt: undefined, title: 'local-title' })] },
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z', title: 'remote-title' })] },
      [],
    );

    // 都缺失时间戳则保留本地
    expect(result.localWrites.plans![0]!.title).toBe('local-title');
  });

  it('缺失时间戳的记录不抛异常', () => {
    expect(() => {
      mergeSnapshots(
        { plans: [rec('no-time', { updatedAt: undefined, createdAt: undefined })] },
        { plans: [] },
        [],
      );
    }).not.toThrow();
  });
});

// ==================== 墓碑应用 T3.5 ====================

describe('applyRemoteTombstones — 墓碑应用', () => {
  it('墓碑时间晚于记录更新时间 → 标记删除', () => {
    const deletions = applyRemoteTombstones(
      { plans: [rec('p1', { updatedAt: '2026-07-30T10:00:00Z' })] },
      [ts('p1', '2026-07-30T12:00:00Z')],
    );

    expect(deletions.plans).toContain('p1');
  });

  it('墓碑时间早于记录更新时间 → 保留', () => {
    const deletions = applyRemoteTombstones(
      { plans: [rec('p1', { updatedAt: '2026-07-30T12:00:00Z' })] },
      [ts('p1', '2026-07-30T10:00:00Z')],
    );

    expect(deletions.plans).toBeUndefined();
  });

  it('本地不存在的记录 → 忽略墓碑', () => {
    const deletions = applyRemoteTombstones(
      { plans: [rec('p_exists')] },
      [ts('p_not_exists', '2026-07-30T12:00:00Z')],
    );

    expect(deletions.plans).toBeUndefined();
  });
});

// ==================== 墓碑清理 T3.5 ====================

describe('filterExpiredTombstones — 墓碑清理', () => {
  it('超过保留期的墓碑被过滤', () => {
    const now = Date.now();
    const recent: Tombstone = {
      id: 'ts-recent',
      table: 'plans',
      recordId: 'recent',
      deletedAt: new Date(now - 1000).toISOString(), // 1 秒前
    };
    const expired: Tombstone = {
      id: 'ts-expired',
      table: 'plans',
      recordId: 'expired',
      deletedAt: new Date(now - 200_000).toISOString(), // 200 秒前
    };

    const retained = filterExpiredTombstones([recent, expired], 60_000); // 60 秒保留期

    expect(retained).toHaveLength(1);
    expect(retained[0]!.id).toBe('ts-recent');
  });

  it('全部未过期时全部保留', () => {
    const now = Date.now();
    const tombstones = [
      { id: 'ts1', table: 'plans' as const, recordId: 'r1', deletedAt: new Date(now - 1000).toISOString() },
      { id: 'ts2', table: 'blogs' as const, recordId: 'r2', deletedAt: new Date(now - 5000).toISOString() },
    ];

    const retained = filterExpiredTombstones(tombstones, 60_000);
    expect(retained).toHaveLength(2);
  });

  it('全部过期时返回空数组', () => {
    const now = Date.now();
    const tombstones = [
      { id: 'ts1', table: 'plans' as const, recordId: 'r1', deletedAt: new Date(now - 200_000).toISOString() },
    ];

    const retained = filterExpiredTombstones(tombstones, 60_000);
    expect(retained).toHaveLength(0);
  });
});

// ==================== 跨表合并 ====================

describe('mergeSnapshots — 跨表合并', () => {
  it('多张表同时合并，各自独立处理', () => {
    const result = mergeSnapshots(
      {
        plans: [rec('p_local')],
        blogs: [],
      },
      {
        plans: [],
        blogs: [rec('b_remote')],
      },
      [],
    );

    expect(result.localWrites.plans).toHaveLength(1);
    expect(result.localWrites.plans![0]!.id).toBe('p_local');
    expect(result.localWrites.blogs).toHaveLength(1);
    expect(result.localWrites.blogs![0]!.id).toBe('b_remote');
  });

  it('空表 + 空墓碑不抛异常', () => {
    const result = mergeSnapshots({}, {}, []);
    expect(result.localWrites).toEqual({});
    expect(result.localDeletions).toEqual({});
    expect(result.pushChanges).toEqual([]);
  });
});
