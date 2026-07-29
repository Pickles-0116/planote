/**
 * ChatSessionRepository 实现（v1.5-AI Chat）
 *
 * 关键规则（openspec/changes/ai-chat-foundation）：
 * - list 默认按 updatedAt 降序
 * - get 不存在返回 undefined（由调用方决定处理）
 * - create 自动填 id / createdAt / updatedAt
 * - update 自动刷 updatedAt
 * - delete 抛 NOT_FOUND（id 不存在时）
 * - appendMessage / updateContext 包在 db.transaction 内（防并发读-改-写竞态）
 */

import type { ID, ChatSession, ChatMessage, ChatContext, ISODate } from '@/types/domain';
import type {
  ChatSessionRepository,
  ChatSessionCreateInput,
  ChatSessionUpdatePatch,
  QueryOptions,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import type { PlanoteDB } from '../schema';

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `ChatSession not found: ${id}`,
  };
  throw new AppError(payload);
};

const requireSession = async (
  db: PlanoteDB,
  id: ID,
): Promise<ChatSession> => {
  const session = await db.chatSessions.get(id);
  if (session === undefined) throwNotFound(id);
  return session as ChatSession;
};

/** ISO 时间字符串（无毫秒，UTC）。 */
const nowISO = (): ISODate => new Date().toISOString();

export class ChatSessionRepo implements ChatSessionRepository {
  constructor(private db: PlanoteDB) {}

  async list(opts?: QueryOptions<ChatSession>): Promise<ChatSession[]> {
    let rows: ChatSession[];
    if (opts?.filter) {
      const filter = opts.filter;
      rows = await this.db.chatSessions
        .filter((s) => {
          for (const [k, v] of Object.entries(filter)) {
            const actual = (s as unknown as Record<string, unknown>)[k];
            if (v === undefined) continue;
            if (
              v !== null &&
              typeof v === 'object' &&
              ('$in' in v || '$ne' in v)
            ) {
              const ops = v as { $in?: unknown[]; $ne?: unknown };
              if (ops.$in && !ops.$in.includes(actual)) return false;
              if (ops.$ne !== undefined && actual === ops.$ne) return false;
            } else if (actual !== v) {
              return false;
            }
          }
          return true;
        })
        .toArray();
    } else {
      rows = await this.db.chatSessions.toArray();
    }

    const sort = opts?.sort;
    if (!sort || sort.length === 0) {
      // 默认按 updatedAt desc
      rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } else {
      rows.sort((a, b) => {
        for (const s of sort) {
          const av = a[s.field];
          const bv = b[s.field];
          if (av === bv) continue;
          const cmp = av! < bv! ? -1 : 1;
          return s.order === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    if (opts?.pagination) {
      const { offset, limit } = opts.pagination;
      rows = rows.slice(offset, offset + limit);
    }
    return rows;
  }

  async get(id: ID): Promise<ChatSession | undefined> {
    return this.db.chatSessions.get(id);
  }

  async create(input: ChatSessionCreateInput): Promise<ChatSession> {
    const now = nowISO();
    const session: ChatSession = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.chatSessions.add(session);
    return session;
  }

  async update(id: ID, patch: ChatSessionUpdatePatch): Promise<ChatSession> {
    const existing = await requireSession(this.db, id);
    const now = nowISO();
    const merged = { ...existing, ...patch, id, updatedAt: now } as ChatSession;
    await this.db.chatSessions.put(merged);
    return merged;
  }

  async delete(id: ID): Promise<void> {
    await requireSession(this.db, id);
    await this.db.chatSessions.delete(id);
  }

  /**
   * 原子追加消息：事务内读-改-写。
   */
  async appendMessage(sessionId: ID, message: ChatMessage): Promise<ChatSession> {
    return this.db.transaction('rw', this.db.chatSessions, async () => {
      const existing = await requireSession(this.db, sessionId);
      const now = nowISO();
      const merged: ChatSession = {
        ...existing,
        messages: [...existing.messages, message],
        updatedAt: now,
      };
      await this.db.chatSessions.put(merged);
      return merged;
    });
  }

  /**
   * 原子合并 context：事务内读-改-写。
   */
  async updateContext(sessionId: ID, patch: Partial<ChatContext>): Promise<ChatSession> {
    return this.db.transaction('rw', this.db.chatSessions, async () => {
      const existing = await requireSession(this.db, sessionId);
      const now = nowISO();
      const merged: ChatSession = {
        ...existing,
        context: { ...existing.context, ...patch },
        updatedAt: now,
      };
      await this.db.chatSessions.put(merged);
      return merged;
    });
  }
}

// 默认工厂：生产代码零参调用
import { db as defaultDb } from '../index';
export const createChatSessionRepo = (database: PlanoteDB = defaultDb): ChatSessionRepo =>
  new ChatSessionRepo(database);