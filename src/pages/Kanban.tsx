/**
 * Kanban - 计划项看板页（/kanban）
 *
 * 装配（add-kanban-board 增量 / spec.md Requirement: 看板 4 列固定布局）：
 * 1. useKanbanData 拉数据 + 4 列分桶 + 排序
 * 2. useDragDrop 抽象 HTML5 drag/drop
 * 3. 4 列 flex + overflow-x-auto
 * 4. 顶部筛选条（按 plan 过滤）
 *
 * 跨计划（spec.md Requirement: 跨计划拖拽）：
 * - drop 只改 status，保留 planId
 * - 同 status 拖回 → 早返回
 *
 * 加载 / 空态：
 * - 加载中：4 列 Skeleton
 * - 全空：EmptyState illustration + 「还没有计划项」+ 引导
 * - 单列空：「拖卡到这里」
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Columns, Plus, Filter } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import Skeleton from '@/components/shell/Skeleton';
import { useItemsStore, useToastStore } from '@/stores';
import {
  useKanbanData,
  useDragDrop,
  KANBAN_COLUMNS,
  type KanbanColumnKey,
} from '@/features/kanban';
import KanbanColumn from '@/features/kanban/components/KanbanColumn';
import { cn } from '@/lib/utils';
import type { ID, Item, ItemStatus, Plan } from '@/types/domain';

/** 4 列虚拟键 → 实际 ItemStatus 映射（blocked 是 todo 的派生子集）。 */
const COLUMN_TO_STATUS: Record<KanbanColumnKey, ItemStatus> = {
  todo: 'todo',
  doing: 'doing',
  blocked: 'todo',
  done: 'done',
};

function toItemStatus(key: KanbanColumnKey): ItemStatus {
  return COLUMN_TO_STATUS[key];
}

function KanbanSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((c) => (
          <div
            key={c.key}
            className="flex-shrink-0 min-w-[280px] w-80 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-3"
          >
            <Skeleton className="h-6 w-20 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  total: number;
  filterPlanId: ID | 'all';
  plans: Plan[];
  onFilterChange: (id: ID | 'all') => void;
}

function PageHeader({
  total,
  filterPlanId,
  plans,
  onFilterChange,
}: PageHeaderProps): JSX.Element {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-900 dark:text-stone-100">看板</h1>
        <span className="text-xs text-brand-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-700 px-2 py-1 rounded-md font-medium">
          共 {total} 个计划项
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Filter
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 dark:text-stone-500 pointer-events-none"
          />
          <select
            value={filterPlanId}
            onChange={(e) => onFilterChange(e.target.value as ID | 'all')}
            className={cn(
              'pl-7 pr-3 py-1.5 rounded-lg text-xs border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-brand-700 dark:text-stone-200',
              'hover:border-brand-300 dark:hover:border-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-500',
            )}
            aria-label="按计划筛选"
          >
            <option value="all">全部计划</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => navigate('/plans/new')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm"
        >
          <Plus size={12} />
          新建计划
        </button>
      </div>
    </div>
  );
}

export default function Kanban(): JSX.Element {
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const [filterPlanId, setFilterPlanId] = useState<ID | 'all'>('all');
  const {
    itemsById,
    itemsByStatus,
    plansById,
    isLoading,
    totalCount,
  } = useKanbanData();

  const activePlans = useMemo(
    () => Array.from(plansById.values()).filter((p) => p.status !== 'paused'),
    [plansById],
  );

  const handleColumnDrop = useCallback(
    (columnKey: KanbanColumnKey, itemId: ID) => {
      const newStatus = toItemStatus(columnKey);
      const item: Item | undefined = itemsById.get(itemId);
      if (!item) return;
      // 同列拖回：status 没变 → 早返回（避免无意义 IO）
      if (item.status === newStatus) return;
      void useItemsStore
        .getState()
        .setItemStatus(itemId, newStatus)
        .catch(() => {
          pushToast('error', '状态更新失败');
        });
    },
    [itemsById, pushToast],
  );

  const {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
  } = useDragDrop();

  // 按 plan 过滤（必须在所有 early return 之前调用 hook）
  const filtered = useMemo<Record<KanbanColumnKey, Item[]>>(() => {
    if (filterPlanId === 'all') return itemsByStatus;
    return {
      todo: itemsByStatus.todo.filter((i) => i.planId === filterPlanId),
      doing: itemsByStatus.doing.filter((i) => i.planId === filterPlanId),
      blocked: itemsByStatus.blocked.filter((i) => i.planId === filterPlanId),
      done: itemsByStatus.done.filter((i) => i.planId === filterPlanId),
    };
  }, [filterPlanId, itemsByStatus]);

  // 加载中
  if (isLoading) {
    return <KanbanSkeleton />;
  }

  // 整页空态
  if (totalCount === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          total={0}
          filterPlanId={filterPlanId}
          plans={activePlans}
          onFilterChange={setFilterPlanId}
        />
        <EmptyState
          icon={Columns}
          title="还没有计划项"
          description="先创建计划并添加事项，再来按状态浏览所有计划项。"
          action={{
            label: '新建计划',
            onClick: () => navigate('/plans/new'),
            variant: 'primary',
          }}
          variant="illustration"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        total={totalCount}
        filterPlanId={filterPlanId}
        plans={activePlans}
        onFilterChange={setFilterPlanId}
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            columnKey={col.key}
            title={col.title}
            items={filtered[col.key]}
            plansById={plansById}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleColumnDrop}
          />
        ))}
      </div>
    </div>
  );
}
