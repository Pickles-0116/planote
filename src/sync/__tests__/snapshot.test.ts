/**
 * 快照序列化往返测试
 *
 * 验证：
 * - serialize→deserialize 后字段一致
 * - formatVersion / generatedAt 正确
 * - 不认识 formatVersion 时抛错
 */

import { describe, it, expect } from 'vitest';
import { serializeSnapshot, deserializeSnapshot, SNAPSHOT_FORMAT_VERSION } from '../snapshot';
import type { SnapshotData } from '../snapshot';

describe('snapshot 序列化 / 反序列化', () => {
  it('多表记录 + 墓碑的样例数据 serialize→deserialize 后字段一致', () => {
    const data: SnapshotData = {
      tables: {
        plans: [
          { id: 'plan01', title: '测试计划', status: 'doing', updatedAt: '2026-07-30T10:00:00Z' },
        ],
        items: [
          { id: 'item01', planId: 'plan01', title: '事项1', checked: false, order: 1 },
          { id: 'item02', planId: 'plan01', title: '事项2', checked: true, order: 2 },
        ],
        tags: [
          { id: 'tag01', name: '测试标签', color: '#3B82F6', usageCount: 2 },
        ],
        blogs: [
          { id: 'blog01', title: '测试博客', status: 'draft', tagIds: ['tag01'] },
        ],
      },
      tombstones: [
        { id: 'ts01', table: 'items' as const, recordId: 'deleted-item-01', deletedAt: '2026-07-29T08:00:00Z' },
        { id: 'ts02', table: 'tags' as const, recordId: 'deleted-tag-01', deletedAt: '2026-07-28T12:00:00Z' },
      ],
    };

    const json = serializeSnapshot(data);
    const parsed = deserializeSnapshot(json);

    expect(parsed.formatVersion).toBe(SNAPSHOT_FORMAT_VERSION);
    expect(parsed.generatedAt).toBeTruthy();
    expect(() => new Date(parsed.generatedAt).toISOString()).not.toThrow();

    // 校验 plans 表
    const plans = parsed.tables.plans!;
    expect(plans).toHaveLength(1);
    expect(plans[0]!.id).toBe('plan01');
    expect(plans[0]!.title).toBe('测试计划');

    // 校验 items 表
    const items = parsed.tables.items!;
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe('事项1');
    expect(items[1]!.title).toBe('事项2');

    // 校验 tags 表
    const tags = parsed.tables.tags!;
    expect(tags).toHaveLength(1);
    expect(tags[0]!.name).toBe('测试标签');

    // 校验 blogs 表
    const blogs = parsed.tables.blogs!;
    expect(blogs).toHaveLength(1);
    expect(blogs[0]!.title).toBe('测试博客');

    // 校验墓碑
    expect(parsed.tombstones).toHaveLength(2);
    expect(parsed.tombstones[0]!.recordId).toBe('deleted-item-01');
    expect(parsed.tombstones[1]!.recordId).toBe('deleted-tag-01');
  });

  it('空表 + 空墓碑也能正确往返', () => {
    const data: SnapshotData = {
      tables: {},
      tombstones: [],
    };

    const json = serializeSnapshot(data);
    const parsed = deserializeSnapshot(json);

    expect(parsed.formatVersion).toBe(SNAPSHOT_FORMAT_VERSION);
    expect(parsed.tables).toEqual({});
    expect(parsed.tombstones).toEqual([]);
  });

  it('generatedAt 为 ISO 8601 格式', () => {
    const data: SnapshotData = { tables: {}, tombstones: [] };
    const json = serializeSnapshot(data);
    const parsed = deserializeSnapshot(json);

    // ISO 8601 with timezone Z
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('不认识 formatVersion 时抛错', () => {
    const badPayload = JSON.stringify({
      formatVersion: 999,
      generatedAt: '2026-07-30T10:00:00Z',
      tables: {},
      tombstones: [],
    });

    expect(() => deserializeSnapshot(badPayload)).toThrow('不支持的快照格式版本 999');
  });

  it('formatVersion 缺失时抛错', () => {
    const badPayload = JSON.stringify({
      generatedAt: '2026-07-30T10:00:00Z',
      tables: {},
      tombstones: [],
    });

    expect(() => deserializeSnapshot(badPayload)).toThrow('缺少 formatVersion');
  });

  it('无效 JSON 字符串时抛错', () => {
    expect(() => deserializeSnapshot('这不是 JSON')).toThrow('无效的 JSON 格式');
  });
});
