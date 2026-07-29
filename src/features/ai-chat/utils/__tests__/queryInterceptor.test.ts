import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PlanoteDB } from '@/db/schema';
import { interceptDataQuery } from '../queryInterceptor';
import { computeAppStats } from '../computeAppStats';
import { generateSuggestions } from '../generateSuggestions';

let db: PlanoteDB;

beforeEach(async () => {
  db = new PlanoteDB(`test-qa-${Math.random().toString(36).slice(2)}`);
  await db.open();
  // 重写 repos 绑定的 db（hack：用真实模块重新指向测试 db）
  // 由于 repos 用模块级单例，本测试仅覆盖纯函数部分；
  // 真实 DB 集成通过 e2e 验证。
});

describe('interceptDataQuery', () => {
  it('get_stats 不需要数据也能返回结构', async () => {
    const r = await interceptDataQuery('get_stats');
    expect(r.tool).toBe('get_stats');
    expect(r.displayRows).toEqual([]);
    expect(r.summary).toBeDefined();
  });

  it('get_plans 接受 filter', async () => {
    // 即使无数据，也应返回结构
    const r = await interceptDataQuery('get_plans', { status: 'doing' });
    expect(r.tool).toBe('get_plans');
    expect(Array.isArray(r.displayRows)).toBe(true);
  });
});

describe('computeAppStats', () => {
  it('空数据时返回全 0', async () => {
    const stats = await computeAppStats();
    expect(stats.planCounts.total).toBe(0);
    expect(stats.blogCounts.total).toBe(0);
    expect(stats.itemCounts.total).toBe(0);
    expect(stats.overallProgress).toBe(0);
  });
});

describe('generateSuggestions', () => {
  it('overdue_plans 空数据返回无过期', async () => {
    const s = await generateSuggestions('overdue_plans');
    expect(s.type).toBe('overdue_plans');
    expect(s.entityIds).toEqual([]);
  });

  it('stale_drafts 空数据返回无草稿', async () => {
    const s = await generateSuggestions('stale_drafts');
    expect(s.type).toBe('stale_drafts');
  });

  it('paused_too_long 空数据返回无搁置', async () => {
    const s = await generateSuggestions('paused_too_long');
    expect(s.type).toBe('paused_too_long');
  });
});