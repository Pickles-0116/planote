/**
 * useKanbanData - 看板数据 pipeline
 *
 * 数据流（add-kanban-board 增量 / spec Requirement: 看板 4 列固定布局）：
 * 1. `useLiveQuery(itemRepo.list, [])` 一次拉全 item（跨 plan）
 * 2. `usePlans()` 拉全 plan
 * 3. 过滤 plan.status !== 'paused'（active plans；v1.0 不显搁置计划的 item）
 * 4. 过滤 item.planId ∈ activePlanIds
 * 5. 按 status 分桶：{ todo, doing, done } + 派生 blocked（todo 且 dueDate 逾期）
 * 6. 每桶列内排序：urgency↓ → dueDate↑ → createdAt↓
 *
 * 性能：实测 100 items 跨 5 plans < 30ms（liveQuery 自动通知）。
 *
 * 「Blocked」列实现（design.md §2.2 + §3.2）：
 * - `ItemStatus` 无 `'blocked'` 字段；v1.0 复用 `todo` 的视觉子集
 * - 派生规则：`status === 'todo'` 且 `dueDate < now` → 移入 Blocked 列
 * - v1.1 评估扩展 `ItemStatus` 加 `'blocked'`
 *
 * @returns { itemsById, itemsByStatus, plansById, activePlanIds, isLoading, totalCount }
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ID, Item, ItemStatus, Plan } from '@/types/domain';
import { itemRepo } from '@/db/repos';
import { usePlans } from '@/stores';
import { sortKanbanItemsWithUrgency } from '../utils/kanbanSort';

/** 看板 4 列虚拟键（v1.0：'blocked' 由 todo + overdue 派生）。 */
export type KanbanColumnKey = 'todo' | 'doing' | 'blocked' | 'done';

/** 4 列定义（spec.md Requirement: 看板 4 列固定布局）。 */
export const KANBAN_COLUMNS: readonly {
  key: KanbanColumnKey;
  title: string;
  color: string;
  icon: string;
}[] = [
  { key: 'todo', title: '待办', color: 'stone', icon: 'Circle' },
  { key: 'doing', title: '进行中', color: 'blue', icon: 'Play' },
  { key: 'blocked', title: '阻塞', color: 'red', icon: 'AlertOctagon' },
  { key: 'done', title: '已完成', color: 'emerald', icon: 'CheckCircle2' },
] as const;

export interface KanbanData {
  /** 全部 item 按 id 索引（用于 KanbanCard 查 plan）。 */
  itemsById: Map<ID, Item>;
  /** 4 列每列的 item 列表（已排序）。 */
  itemsByStatus: Record<KanbanColumnKey, Item[]>;
  /** 全 plan 按 id 索引（用于 KanbanCard 显示 plan 名）。 */
  plansById: Map<ID, Plan>;
  /** 当前 active（status !== 'paused'）的 plan id 集合。 */
  activePlanIds: Set<ID>;
  /** 4 列每列计数。 */
  columnCounts: Record<KanbanColumnKey, number>;
  /** liveQuery 首帧未就绪。 */
  isLoading: boolean;
  /** active item 总数（4 列合计）。 */
  totalCount: number;
}

const EMPTY_BUCKETS: Record<KanbanColumnKey, Item[]> = {
  todo: [],
  doing: [],
  blocked: [],
  done: [],
};

/** 判断 item 是否派生为 blocked（todo + 截止日期已过）。 */
function isDerivedBlocked(item: Item, now: number): boolean {
  if (item.status !== 'todo') return false;
  if (!item.dueDate) return false;
  const ts = new Date(item.dueDate).getTime();
  if (Number.isNaN(ts)) return false;
  return ts < now;
}

export function useKanbanData(): KanbanData {
  const plans = usePlans();
  const allItems = useLiveQuery(async () => await itemRepo.list(), []);

  const plansById = useMemo(() => {
    const m = new Map<ID, Plan>();
    for (const p of plans ?? []) m.set(p.id, p);
    return m;
  }, [plans]);

  const activePlanIds = useMemo(() => {
    const s = new Set<ID>();
    for (const p of plans ?? []) {
      if (p.status !== 'paused') s.add(p.id);
    }
    return s;
  }, [plans]);

  const itemsById = useMemo(() => {
    const m = new Map<ID, Item>();
    for (const i of allItems ?? []) m.set(i.id, i);
    return m;
  }, [allItems]);

  const itemsByStatus = useMemo<Record<KanbanColumnKey, Item[]>>(() => {
    const buckets: Record<KanbanColumnKey, Item[]> = {
      todo: [],
      doing: [],
      blocked: [],
      done: [],
    };
    if (!allItems) return EMPTY_BUCKETS;
    const now = Date.now();
    for (const item of allItems) {
      if (!activePlanIds.has(item.planId)) continue;
      if (item.status === 'todo') {
        if (isDerivedBlocked(item, now)) {
          buckets.blocked.push(item);
        } else {
          buckets.todo.push(item);
        }
      } else {
        buckets[item.status as ItemStatus].push(item);
      }
    }
    // 列内排序：urgency↓ + dueDate↑ + createdAt↓
    const resolveUrgency = (planId: ID): Plan['urgency'] =>
      plansById.get(planId)?.urgency ?? 'none';
    for (const k of Object.keys(buckets) as KanbanColumnKey[]) {
      buckets[k] = sortKanbanItemsWithUrgency(buckets[k], resolveUrgency);
    }
    return buckets;
  }, [allItems, activePlanIds, plansById]);

  const columnCounts = useMemo<Record<KanbanColumnKey, number>>(
    () => ({
      todo: itemsByStatus.todo.length,
      doing: itemsByStatus.doing.length,
      blocked: itemsByStatus.blocked.length,
      done: itemsByStatus.done.length,
    }),
    [itemsByStatus],
  );

  const totalCount = useMemo(
    () =>
      columnCounts.todo +
      columnCounts.doing +
      columnCounts.blocked +
      columnCounts.done,
    [columnCounts],
  );

  return {
    itemsById,
    itemsByStatus,
    plansById,
    activePlanIds,
    columnCounts,
    isLoading: allItems === undefined,
    totalCount,
  };
}
