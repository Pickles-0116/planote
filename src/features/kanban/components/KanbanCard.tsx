/**
 * KanbanCard - 计划项看板卡
 *
 * 视觉规范（add-kanban-board 增量 / spec Requirement: KanbanCard 计划项卡）：
 * - 容器：bg-white rounded-xl p-3 shadow-soft border border-stone-200
 * - hover：border-brand-300 + shadow-md
 * - 拖拽光标：cursor-grab / active:cursor-grabbing
 * - 拖拽中：opacity-50
 *
 * 内容：
 * - 标题（line-clamp-2）
 * - 所属 plan 名 chip（truncate max-w-[140px]）
 * - 截止日期（相对时间；逾期红色）
 * - 紧急度 chip（plan.urgency === 'none' 不渲染）
 *
 * 交互：
 * - draggable + onDragStart（通过父组件 onDragStart 注入）
 * - onClick → navigate(/plans/{planId}#item-{itemId})
 *
 * a11y：
 * - role="article"
 * - tabIndex=0（键盘可达；不能键盘拖——v1.0 简化）
 */

import { useNavigate } from 'react-router-dom';
import { CalendarDays, Flame } from 'lucide-react';
import type { DragEvent as ReactDragEvent } from 'react';
import { cn } from '@/lib/utils';
import type { ID, Item, Plan } from '@/types/domain';
import { formatRelativeTime } from '@/shared/utils/format';

interface Props {
  item: Item;
  plan?: Plan;
  onDragStart: (itemId: ID) => (e: ReactDragEvent<HTMLDivElement>) => void;
}

const URGENCY_CHIP: Record<
  NonNullable<Plan['urgency']>,
  { label: string; cls: string }
> = {
  red: { label: '紧急', cls: 'bg-red-50 text-red-700 border-red-200' },
  orange: {
    label: '较急',
    cls: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  yellow: {
    label: '留意',
    cls: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  none: { label: '', cls: '' },
};

/** 简单判断截止日期是否已过。 */
function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export default function KanbanCard({ item, plan, onDragStart }: Props) {
  const navigate = useNavigate();
  const overdue = isOverdue(item.dueDate);
  const urgency = plan?.urgency ?? 'none';
  const urgencyChip = URGENCY_CHIP[urgency];

  return (
    <article
      role="article"
      tabIndex={0}
      draggable
      onDragStart={onDragStart(item.id)}
      onClick={() => navigate(`/plans/${item.planId}#item-${item.id}`)}
      className={cn(
        'bg-white rounded-xl p-3 border border-stone-200 shadow-soft',
        'cursor-grab active:cursor-grabbing',
        'hover:border-brand-300 hover:shadow-md',
        'transition group/card',
      )}
    >
      {/* 标题 */}
      <h4 className="text-sm font-semibold leading-snug line-clamp-2 text-brand-900 mb-2 group-active/card:opacity-50">
        {item.title}
      </h4>

      {/* meta 行：plan chip + 截止 + 紧急度 */}
      <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
        {plan && (
          <span
            className="bg-stone-100 text-brand-700 px-1.5 py-0.5 rounded truncate max-w-[140px]"
            title={plan.title}
          >
            {plan.title}
          </span>
        )}
        {item.dueDate && (
          <span
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded',
              overdue
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'text-brand-500',
            )}
          >
            <CalendarDays size={9} />
            {formatRelativeTime(item.dueDate)}
          </span>
        )}
        {urgency !== 'none' && (
          <span
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded border',
              urgencyChip.cls,
            )}
          >
            <Flame size={9} />
            {urgencyChip.label}
          </span>
        )}
      </div>
    </article>
  );
}
