/**
 * ChatSessionRepo 单元测试
 *
 * 使用 vitest + fake-indexeddb 模拟 Dexie。
 * 运行：`pnpm add -D vitest fake-indexeddb && pnpm test src/db/repos/__tests__/ChatSessionRepo.test.ts`
 *
 * 来源：openspec/changes/ai-chat-foundation tasks §4.1-4.2。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PlanoteDB } from '../../schema';
import { ChatSessionRepo } from '../ChatSessionRepo';
import { AppError } from '../types';
import type { ChatMessage } from '@/types/domain';

let db: PlanoteDB;
let repo: ChatSessionRepo;

beforeEach(async () => {
  // 每个测试用独立 DB 名隔离
  db = new PlanoteDB(`test-${Math.random().toString(36).slice(2)}`);
  await db.open();
  repo = new ChatSessionRepo(db);
});

describe('ChatSessionRepo', () => {
  describe('create', () => {
    it('自动填 id / createdAt / updatedAt', async () => {
      const before = Date.now();
      const session = await repo.create({
        title: '新对话',
        messages: [],
        context: {},
      });
      const after = Date.now();

      expect(session.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(new Date(session.createdAt).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(session.createdAt).getTime()).toBeLessThanOrEqual(after);
      expect(session.updatedAt).toBe(session.createdAt);
      expect(session.title).toBe('新对话');
      expect(session.messages).toEqual([]);
    });
  });

  describe('get', () => {
    it('未找到返回 undefined', async () => {
      const found = await repo.get('01HZZZZZZZZZZZZZZZZZZZZZZZ');
      expect(found).toBeUndefined();
    });

    it('已存在返回完整 session', async () => {
      const created = await repo.create({ title: 'x', messages: [], context: {} });
      const fetched = await repo.get(created.id);
      expect(fetched).toEqual(created);
    });
  });

  describe('update', () => {
    it('刷 updatedAt', async () => {
      const created = await repo.create({ title: 'old', messages: [], context: {} });
      // 等 1ms 确保时间戳不同
      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.update(created.id, { title: 'new' });
      expect(updated.title).toBe('new');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.updatedAt).getTime(),
      );
    });
  });

  describe('delete', () => {
    it('不存在 id 抛 NOT_FOUND', async () => {
      await expect(repo.delete('nonexistent')).rejects.toThrowError(AppError);
      try {
        await repo.delete('nonexistent');
      } catch (e) {
        expect((e as AppError).error.code).toBe('NOT_FOUND');
      }
    });

    it('存在 id 静默删除', async () => {
      const s = await repo.create({ title: 'x', messages: [], context: {} });
      await repo.delete(s.id);
      const found = await repo.get(s.id);
      expect(found).toBeUndefined();
    });
  });

  describe('list', () => {
    it('默认按 updatedAt desc', async () => {
      const s1 = await repo.create({ title: 'a', messages: [], context: {} });
      await new Promise((r) => setTimeout(r, 5));
      const s2 = await repo.create({ title: 'b', messages: [], context: {} });
      await new Promise((r) => setTimeout(r, 5));
      const s3 = await repo.create({ title: 'c', messages: [], context: {} });

      const all = await repo.list();
      expect(all.map((s) => s.id)).toEqual([s3.id, s2.id, s1.id]);
    });
  });

  describe('appendMessage', () => {
    it('保持消息顺序', async () => {
      const s = await repo.create({ title: 'x', messages: [], context: {} });
      const m1: ChatMessage = {
        id: 'm1',
        role: 'user',
        content: 'hi',
        timestamp: Date.now(),
      };
      const m2: ChatMessage = {
        id: 'm2',
        role: 'assistant',
        content: 'hello',
        timestamp: Date.now(),
      };
      await repo.appendMessage(s.id, m1);
      await repo.appendMessage(s.id, m2);

      const after = await repo.get(s.id);
      expect(after?.messages.length).toBe(2);
      expect(after?.messages[0]).toEqual(m1);
      expect(after?.messages[1]).toEqual(m2);
    });

    it('刷 updatedAt', async () => {
      const s = await repo.create({ title: 'x', messages: [], context: {} });
      await new Promise((r) => setTimeout(r, 5));
      await repo.appendMessage(s.id, {
        id: 'm',
        role: 'user',
        content: 'x',
        timestamp: Date.now(),
      });
      const after = await repo.get(s.id);
      expect(new Date(after!.updatedAt).getTime()).toBeGreaterThan(
        new Date(s.updatedAt).getTime(),
      );
    });

    it('原子事务：不存在 id 抛错且不入数据', async () => {
      await expect(
        repo.appendMessage('nonexistent', {
          id: 'm',
          role: 'user',
          content: 'x',
          timestamp: Date.now(),
        }),
      ).rejects.toThrowError(AppError);
    });
  });

  describe('updateContext', () => {
    it('部分合并 context', async () => {
      const s = await repo.create({
        title: 'x',
        messages: [],
        context: { mode: 'guided' },
      });
      const updated = await repo.updateContext(s.id, {
        currentIntent: 'create_plan',
      });
      expect(updated.context.mode).toBe('guided');
      expect(updated.context.currentIntent).toBe('create_plan');
    });

    it('原子事务：不存在 id 抛错', async () => {
      await expect(
        repo.updateContext('nonexistent', { mode: 'free' }),
      ).rejects.toThrowError(AppError);
    });
  });
});