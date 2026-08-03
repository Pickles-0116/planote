/**
 * reconcileTags 单元测试（V1.2 B5 标签治理脚本）
 *
 * 验证：孤儿 ULID 清除、裸字符串解析为 Tag（按名匹配 / 必要时创建）、大小写不敏感、
 * 幂等（二次调用不再修复 / 不重复建 Tag）。
 *
 * 运行：`pnpm test src/db/__tests__/reconcileTags.test.ts`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PlanoteDB } from '../schema';
import { reconcileTags } from '../reconcileTags';
import { newId } from '@/lib/id';
import type { Blog, Plan, Tag, ID } from '@/types/domain';

const now = () => new Date().toISOString();

const TAG_DEFAULTS = {
  name: 'tag',
  color: '#64748B',
  usageCount: 0,
  createdAt: now(),
  updatedAt: now(),
};

function makeTag(over: Partial<Tag> & { id: ID; name: string }): Tag {
  return { ...TAG_DEFAULTS, ...over } as Tag;
}

const PLAN_DEFAULTS = {
  title: '',
  description: '',
  level: 'short' as const,
  timeDim: 'daily' as const,
  status: 'todo' as const,
  progress: 0,
  urgency: 'none' as const,
  tagIds: [] as ID[],
  itemIds: [] as ID[],
  childPlanIds: [] as ID[],
  createdAt: now(),
  updatedAt: now(),
};

function makePlan(over: Partial<Plan> & { id: ID }): Plan {
  return { ...PLAN_DEFAULTS, ...over } as Plan;
}

const BLOG_DEFAULTS = {
  title: 'blog',
  content: { type: 'doc' as const, content: [] as never[] },
  contentText: '',
  excerpt: '',
  tagIds: [] as ID[],
  folderId: 'folder-root',
  attachmentIds: [] as ID[],
  status: 'draft' as const,
  source: 'direct' as const,
  createdAt: now(),
  updatedAt: now(),
};

function makeBlog(over: Partial<Blog> & { id: ID }): Blog {
  return { ...BLOG_DEFAULTS, ...over } as Blog;
}

describe('reconcileTags', () => {
  let db: PlanoteDB;

  beforeEach(async () => {
    db = new PlanoteDB(`test-reconcile-${Math.random().toString(36).slice(2)}`);
    await db.open();
  });

  it('清除孤儿 ULID + 裸字符串建 Tag + 大小写匹配既有 Tag', async () => {
    const react = makeTag({ id: newId(), name: 'React' });
    const vue = makeTag({ id: newId(), name: 'Vue' });
    await db.tags.bulkAdd([react, vue]);

    const orphan = newId(); // 合法 ULID 但无对应 Tag → 孤儿
    const plan = makePlan({ id: 'P1', tagIds: [react.id, orphan, 'BareNewTag'] });
    const blog = makeBlog({ id: 'B1', tagIds: ['react'] }); // 裸字符串，大小写不敏感匹配 React
    await db.plans.add(plan);
    await db.blogs.add(blog);

    const res = await reconcileTags(db);

    // P1: 清掉孤儿，新增 1 个裸字符串 Tag → +1 修复；B1: 裸字符串匹配既有 → +1 修复
    expect(res.plansFixed).toBe(1);
    expect(res.blogsFixed).toBe(1);
    expect(res.tagsCreated).toBe(1);

    const p1After = await db.plans.get('P1');
    // 保留既有 react.id
    expect(p1After!.tagIds).toContain(react.id);
    // 孤儿 ULID 被丢弃
    expect(p1After!.tagIds).not.toContain(orphan);
    // 裸字符串被替换为新 Tag id（且不与 react 重复，因为 'BareNewTag' 与 'React' 不同名）
    expect(p1After!.tagIds.length).toBe(2);
    expect(p1After!.tagIds).not.toContain('BareNewTag');

    const b1After = await db.blogs.get('B1');
    expect(b1After!.tagIds).toEqual([react.id]);

    // 仅新建了 1 个 Tag（BareNewTag），既有 React/Vue 未被复制
    expect(await db.tags.count()).toBe(3);
  });

  it('幂等：二次调用不再修复、不重复建 Tag', async () => {
    const react = makeTag({ id: newId(), name: 'React' });
    await db.tags.add(react);
    const orphan = newId();
    await db.plans.add(makePlan({ id: 'P1', tagIds: [react.id, orphan, 'BareNewTag'] }));
    await db.blogs.add(makeBlog({ id: 'B1', tagIds: ['react'] }));

    const first = await reconcileTags(db);
    expect(first.tagsCreated).toBe(1);
    expect(first.plansFixed).toBe(1);
    expect(first.blogsFixed).toBe(1);

    const second = await reconcileTags(db);
    expect(second.tagsCreated).toBe(0);
    expect(second.plansFixed).toBe(0);
    expect(second.blogsFixed).toBe(0);
    // 标签总数不变（无重复创建）
    expect(await db.tags.count()).toBe(2);
  });

  it('干净的 tagIds 不被改动', async () => {
    const react = makeTag({ id: newId(), name: 'React' });
    await db.tags.add(react);
    await db.plans.add(makePlan({ id: 'P2', tagIds: [react.id] }));

    const res = await reconcileTags(db);
    expect(res.plansFixed).toBe(0);
    const p2 = await db.plans.get('P2');
    expect(p2!.tagIds).toEqual([react.id]);
  });
});
