/**
 * useEntityFilters 纯函数单元测试（V1.2 B5 关键路径：多维筛选）
 *
 * 验证 `applyEntityFilters` 的：空筛选透传、status/timeDim/level 单维过滤、
 * 标签 OR 语义、多维度 AND 组合、dateRange 闭区间、不修改入参；
 * 以及 `hasActiveEntityFilters` 判定。
 *
 * 注意：本文件仅测试纯函数，不渲染 React hook。
 * 运行：`pnpm test src/features/filters/__tests__/useEntityFilters.test.ts`
 */

import { describe, it, expect } from 'vitest';
import {
  applyEntityFilters,
  hasActiveEntityFilters,
  DEFAULT_ENTITY_FILTERS,
  type EntityFilterState,
  type EntityFilterable,
} from '../useEntityFilters';

type Row = EntityFilterable & { id: string };

const mk = (o: Partial<Row> & { id: string }): Row => ({
  tagIds: [],
  status: undefined,
  timeDim: undefined,
  level: undefined,
  startDate: undefined,
  ...o,
});

const f = (o: Partial<EntityFilterState>): EntityFilterState => ({
  ...DEFAULT_ENTITY_FILTERS,
  ...o,
});

describe('applyEntityFilters', () => {
  it('空筛选不过滤（返回原集合）', () => {
    const items = [mk({ id: 'a' }), mk({ id: 'b' })];
    expect(applyEntityFilters(items, DEFAULT_ENTITY_FILTERS)).toEqual(items);
  });

  it('status 维度过滤', () => {
    const items = [
      mk({ id: 'a', status: 'todo' }),
      mk({ id: 'b', status: 'done' }),
      mk({ id: 'c', status: 'todo' }),
    ];
    const r = applyEntityFilters(items, f({ statuses: ['done'] }));
    expect(r.map((i) => i.id)).toEqual(['b']);
  });

  it('timeDim 维度过滤', () => {
    const items = [
      mk({ id: 'a', timeDim: 'daily' }),
      mk({ id: 'b', timeDim: 'monthly' }),
    ];
    const r = applyEntityFilters(items, f({ timeDims: ['monthly'] }));
    expect(r.map((i) => i.id)).toEqual(['b']);
  });

  it('level 维度过滤', () => {
    const items = [
      mk({ id: 'a', level: 'short' }),
      mk({ id: 'b', level: 'long' }),
    ];
    const r = applyEntityFilters(items, f({ levels: ['long'] }));
    expect(r.map((i) => i.id)).toEqual(['b']);
  });

  it('标签为 OR 语义（命中任一即保留）', () => {
    const items = [
      mk({ id: 'a', tagIds: ['t1'] }),
      mk({ id: 'b', tagIds: ['t2'] }),
      mk({ id: 'c', tagIds: ['t1', 't3'] }),
      mk({ id: 'd', tagIds: [] }),
    ];
    const r = applyEntityFilters(items, f({ selectedTagIds: ['t1', 't9'] }));
    expect(r.map((i) => i.id).sort()).toEqual(['a', 'c']);
  });

  it('多维度为 AND 组合', () => {
    const items = [
      mk({ id: 'a', status: 'done', tagIds: ['t1'] }),
      mk({ id: 'b', status: 'todo', tagIds: ['t1'] }),
      mk({ id: 'c', status: 'done', tagIds: ['t2'] }),
    ];
    const r = applyEntityFilters(items, f({ statuses: ['done'], selectedTagIds: ['t1'] }));
    expect(r.map((i) => i.id)).toEqual(['a']);
  });

  it('dateRange 闭区间（含起止端点）', () => {
    const items = [
      mk({ id: 'a', startDate: '2024-01-10' }),
      mk({ id: 'b', startDate: '2024-01-15' }),
      mk({ id: 'c', startDate: '2024-01-20' }),
    ];
    const r = applyEntityFilters(items, f({ dateRange: { start: '2024-01-15', end: '2024-01-15' } }));
    expect(r.map((i) => i.id)).toEqual(['b']);
  });

  it('不修改原数组', () => {
    const items = [mk({ id: 'a', tagIds: ['t1'] })];
    const snapshot = JSON.stringify(items);
    applyEntityFilters(items, f({ selectedTagIds: ['t2'] }));
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});

describe('hasActiveEntityFilters', () => {
  it('默认空筛选为 false', () => {
    expect(hasActiveEntityFilters(DEFAULT_ENTITY_FILTERS)).toBe(false);
  });

  it('任一维度有值即为 true', () => {
    expect(hasActiveEntityFilters(f({ statuses: ['done'] }))).toBe(true);
    expect(hasActiveEntityFilters(f({ timeDims: ['daily'] }))).toBe(true);
    expect(hasActiveEntityFilters(f({ levels: ['short'] }))).toBe(true);
    expect(hasActiveEntityFilters(f({ selectedTagIds: ['t1'] }))).toBe(true);
    expect(hasActiveEntityFilters(f({ dateRange: { start: 'x', end: 'y' } }))).toBe(true);
  });
});
