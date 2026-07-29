/**
 * undoStore - 撤销/重做栈
 *
 * 基于快照的 undo/redo 实现（最近 20 步）。
 * 每次写操作前捕获「操作前状态」，操作后捕获「操作后状态」。
 * undo 时恢复「操作前状态」，redo 时恢复「操作后状态」。
 *
 * 支持的操作域：Plan / Item / Blog
 *
 * 架构决策：
 * - 使用 Dexie 直接读写而非 store action，避免循环触发
 * - undo/redo 操作本身不入栈（通过 isUndoRedoing 标志位跳过）
 * - 栈最大 20 项，超出时丢弃最早的
 */

import { create } from 'zustand';
import { db } from '@/db';

const MAX_STACK = 20;

// ========== 快照类型 ==========

interface PlanSnapshot {
  id: string;
  data: Record<string, unknown> | null; // null = 不存在
}

interface ItemSnapshot {
  id: string;
  data: Record<string, unknown> | null;
}

interface BlogSnapshot {
  id: string;
  data: Record<string, unknown> | null;
}

/** 操作涉及的实体快照（before/after）。 */
interface UndoEntry {
  id: string;
  description: string;
  timestamp: number;
  plans: { before: PlanSnapshot[]; after: PlanSnapshot[] };
  items: { before: ItemSnapshot[]; after: ItemSnapshot[] };
  blogs: { before: BlogSnapshot[]; after: BlogSnapshot[] };
  /** 操作后关联的 planId 列表（用于重算 progress）。 */
  affectedPlanIds: string[];
}

// ========== Store 接口 ==========

interface UndoStoreState {
  stack: UndoEntry[];
  redoStack: UndoEntry[];
  isUndoRedoing: boolean;

  /** 推入一条撤销记录。 */
  push: (entry: Omit<UndoEntry, 'id' | 'timestamp'>) => void;
  /** 撤销最近一步。 */
  undo: () => Promise<void>;
  /** 重做最近撤销的一步。 */
  redo: () => Promise<void>;
  /** 清空所有栈。 */
  clear: () => void;
}

// ========== 快照恢复工具 ==========

async function restoreSnapshot(
  table: string,
  before: Array<{ id: string; data: Record<string, unknown> | null }>,
  after: Array<{ id: string; data: Record<string, unknown> | null }>,
  target: 'before' | 'after',
): Promise<string[]> {
  const tbl = db.table(table);
  const affectedPlanIds = new Set<string>();

  // 目标状态：undo 用 before，redo 用 after
  const targets = target === 'before' ? before : after;
  // 对照状态：用于判断是否需要删除
  const opposites = target === 'before' ? after : before;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const o = opposites[i];
    if (!t) continue;

    if (t.data === null) {
      // before 为 null 表示操作前不存在（create 操作），undo 需删除
      // after 为 null 表示操作后不存在（delete 操作），redo 需删除
      await tbl.delete(t.id);
    } else {
      // 恢复数据
      await tbl.put({ ...t.data, id: t.id });
      // 记录 planId 用于 progress 重算
      if (table === 'items' && t.data.planId) {
        affectedPlanIds.add(t.data.planId as string);
      }
    }

    // 处理对照侧有但目标侧没有的项
    if (o && o.data !== null && t.data === null) {
      // 对照侧存在但目标侧为 null → 需要删除
      await tbl.delete(o.id);
    }
  }

  return [...affectedPlanIds];
}

export const useUndoStore = create<UndoStoreState>((set, get) => ({
  stack: [],
  redoStack: [],
  isUndoRedoing: false,

  push: (entry) => {
    const state = get();
    if (state.isUndoRedoing) return;

    const newEntry: UndoEntry = {
      ...entry,
      id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    const stack = [...state.stack, newEntry].slice(-MAX_STACK);
    set({ stack, redoStack: [] }); // 新操作清空 redo 栈
  },

  undo: async () => {
    const state = get();
    if (state.stack.length === 0 || state.isUndoRedoing) return;

    const entry = state.stack[state.stack.length - 1];
    set({ isUndoRedoing: true });

    try {
      await db.transaction('rw', [db.plans, db.items, db.blogs], async () => {
        await restoreSnapshot('plans', entry.plans.before, entry.plans.after, 'before');
        await restoreSnapshot('items', entry.items.before, entry.items.after, 'before');
        await restoreSnapshot('blogs', entry.blogs.before, entry.blogs.after, 'before');
      });

      // 重算受影响的 plan progress
      for (const planId of entry.affectedPlanIds) {
        try {
          await db.transaction('rw', [db.plans, db.items], async () => {
            const items = await db.items.where('planId').equals(planId).toArray();
            const total = items.length;
            const done = items.filter((i) => i.checked === true).length;
            const progress = total === 0 ? 0 : Math.round((done / total) * 100);
            await db.plans.update(planId, { progress });
          });
        } catch {
          // 计划可能已被删除，忽略
        }
      }

      set((s) => ({
        stack: s.stack.slice(0, -1),
        redoStack: [...s.redoStack, entry],
        isUndoRedoing: false,
      }));
    } catch (e) {
      console.error('[undoStore.undo] failed:', e);
      set({ isUndoRedoing: false });
    }
  },

  redo: async () => {
    const state = get();
    if (state.redoStack.length === 0 || state.isUndoRedoing) return;

    const entry = state.redoStack[state.redoStack.length - 1];
    set({ isUndoRedoing: true });

    try {
      await db.transaction('rw', [db.plans, db.items, db.blogs], async () => {
        await restoreSnapshot('plans', entry.plans.before, entry.plans.after, 'after');
        await restoreSnapshot('items', entry.items.before, entry.items.after, 'after');
        await restoreSnapshot('blogs', entry.blogs.before, entry.blogs.after, 'after');
      });

      // 重算受影响的 plan progress
      for (const planId of entry.affectedPlanIds) {
        try {
          await db.transaction('rw', [db.plans, db.items], async () => {
            const items = await db.items.where('planId').equals(planId).toArray();
            const total = items.length;
            const done = items.filter((i) => i.checked === true).length;
            const progress = total === 0 ? 0 : Math.round((done / total) * 100);
            await db.plans.update(planId, { progress });
          });
        } catch {
          // ignore
        }
      }

      set((s) => ({
        stack: [...s.stack, entry],
        redoStack: s.redoStack.slice(0, -1),
        isUndoRedoing: false,
      }));
    } catch (e) {
      console.error('[undoStore.redo] failed:', e);
      set({ isUndoRedoing: false });
    }
  },

  clear: () => set({ stack: [], redoStack: [] }),
}));

// ========== 快照捕获工具（供外部 hook 使用）==========

/** 捕获 Plan 快照（当前状态）。 */
export async function capturePlanSnapshot(id: string): Promise<PlanSnapshot> {
  const data = await db.plans.get(id);
  return { id, data: data ? { ...data } : null };
}

/** 捕获 Item 快照。 */
export async function captureItemSnapshot(id: string): Promise<ItemSnapshot> {
  const data = await db.items.get(id);
  return { id, data: data ? { ...data } : null };
}

/** 捕获 Blog 快照。 */
export async function captureBlogSnapshot(id: string): Promise<BlogSnapshot> {
  const data = await db.blogs.get(id);
  return { id, data: data ? { ...data } : null };
}
