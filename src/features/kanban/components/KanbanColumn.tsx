/**
 * KanbanColumn - 单列容器（add-kanban-board 增量）
 *
 * 视觉规范（design.md §2.5 + spec.md Requirement: 看板 4 列固定布局）：
 * - 容器：min-w-[280px] w-80 + bg-stone-50 + rounded-2xl + border
 * - 列头：标题 + 计数 badge（实时）
 * - 列体：flex-1 + overflow-y-auto + min-h-[200px]
 *
 * 拖拽态视觉（spec.md Requirement: 拖拽态视觉）：
 * - onDragOver 加 `ring-2 ring-brand-500`
 * - onDragLeave 移除
 * - 拖出卡 `opacity-50`（KanbanCard 内部 group-active 处理）
 *
 * 空态（spec.md Requirement: 列空态）：
 * - items.length === 0 → 「拖卡到这里」+ 灰色 dashed 边框
 *
 * a11y：role="list" 包裹卡列表
 */

import { useState } from 'react';
import {
  Circle,
  Play,
  AlertOctagon,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import type { DragEvent as ReactDragEvent } from 'react';
import { cn } from '@/lib/utils';
import type { ID, Item, Plan } from '@/types/domain';
import KanbanCard from './KanbanCard';
import type { KanbanColumnKey } from '../hooks/useKanbanData';

const ICONS: Record<KanbanColumnKey, LucideIcon> = {
  todo: Circle,
  doing: Play,
  blocked: AlertOctagon,
  done: CheckCircle2,
};

const COLUMN_COLOR: Record<
  KanbanColumnKey,
  { header: string; count: string }
> = {
  todo: { header: 'text-stone-700', count: 'bg-stone-100 text-stone-600' },
  doing: { header: 'text-blue-700', count: 'bg-blue-50 text-blue-700' },
  blocked: { header: 'text-red-700', count: 'bg-red-50 text-red-700' },
  done: { header: 'text-emerald-700', count: 'bg-emerald-50 text-emerald-700' },
};

interface Props {
  columnKey: KanbanColumnKey;
  title: string;
  items: Item[];
  plansById: Map<ID, Plan>;
  onDragStart: (itemId: ID) => (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (
    columnKey: KanbanColumnKey,
    itemId: ID,
  ) => void;
}

export default function KanbanColumn({
  columnKey,
  title,
  items,
  plansById,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const Icon = ICONS[columnKey];
  const colors = COLUMN_COLOR[columnKey];

  return (
    <div
      className={cn(
        'flex-shrink-0 min-w-[280px] w-80 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col transition',
        isDragOver && 'ring-2 ring-brand-500',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={(e) => {
        setIsDragOver(false);
        onDragLeave(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDrop(columnKey, id);
      }}
    >
      {/* 列头：图标 + 标题 + 计数 badge */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-stone-200">
        <div className={cn('flex items-center gap-2', colors.header)}>
          <Icon size={14} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            colors.count,
          )}
        >
          {items.length}
        </span>
      </div>

      {/* 列体：可滚动 + min-h */}
      <div
        className="flex-1 px-2 py-2 space-y-2 overflow-y-auto min-h-[200px]"
        role="list"
      >
        {items.length === 0 ? (
          <div className="text-center text-xs text-brand-400 py-8 border-2 border-dashed border-stone-200 rounded-xl">
            拖卡到这里
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              plan={plansById.get(item.planId)}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}
