/**
 * ItemRow - 单条事项行
 *
 * 视觉（与 prototype plan-detail.html 事项行 + ux-guidelines §2 Flow A Step 3 对齐）：
 * - 左：自定义 checkbox 18px 圆角 emerald
 * - 中：标题（line-clamp 1）+ 截止日期小字
 * - 右：hover 时显示「标记进行中/待办」切换按钮（spec Requirement: 事项状态切换）
 * - doing 状态：左侧 2px 蓝边 + 「进行中」badge
 * - done 状态：标题 line-through + 灰色
 * - a11y：aria-label + role="listitem"
 *
 * 状态视觉由 props 传入的 item.status 决定，**不**自己算——上层 useItemsForPlan 推送最新数据。
 */

import { useState } from 'react';
import { Check, Play, RotateCcw, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ID, Item, ItemStatus } from '@/types/domain';
import { formatRelativeTime } from '@/shared/utils/format';

interface Props {
  item: Item;
  onToggle: (id: ID) => void;
  onSetStatus: (id: ID, status: ItemStatus) => void;
}

const STATUS_BADGE: Record<
  ItemStatus,
  { label: string; cls: string; leftBorder: string }
> = {
  todo: {
    label: '待办',
    cls: 'text-stone-500 bg-stone-100',
    leftBorder: '',
  },
  doing: {
    label: '进行中',
    cls: 'text-blue-700 bg-blue-50 border border-blue-200',
    leftBorder: 'border-l-2 border-l-blue-500',
  },
  done: {
    label: '已完成',
    cls: 'text-emerald-700 bg-emerald-50',
    leftBorder: '',
  },
};

export default function ItemRow({ item, onToggle, onSetStatus }: Props) {
  const [hover, setHover] = useState(false);
  const isDone = item.status === 'done';
  const isDoing = item.status === 'doing';
  const badge = STATUS_BADGE[item.status];

  return (
    <div
      role="listitem"
      data-item-id={item.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl transition relative bg-white',
        'hover:bg-stone-50',
        badge.leftBorder,
        badge.leftBorder && 'pl-[14px]', // 抵消 border-l-2 的偏移
      )}
    >
      {/* checkbox */}
      <label
        className="flex items-center cursor-pointer flex-shrink-0"
        aria-label={`勾选事项：${item.title}`}
      >
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggle(item.id)}
          className="sr-only"
        />
        <span
          className={cn(
            'w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition',
            isDone
              ? 'bg-emerald-500 border-emerald-500'
              : isDoing
                ? 'border-blue-500'
                : 'border-stone-300 group-hover:border-brand-400',
          )}
        >
          {isDone && <Check className="text-white" size={12} strokeWidth={3} />}
          {isDoing && (
            <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden />
          )}
        </span>
      </label>

      {/* 标题 + meta */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm',
            isDone ? 'line-through text-brand-400' : 'text-brand-900',
          )}
        >
          {item.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-brand-400">
          {item.dueDate && (
            <span className="flex items-center gap-0.5">
              <CalendarDays size={9} />
              {item.dueDate.slice(0, 10)}
            </span>
          )}
          {item.completedAt && (
            <span>完成于 {formatRelativeTime(item.completedAt)}</span>
          )}
        </div>
      </div>

      {/* 状态 badge（非 hover 可见） */}
      {(isDoing || isDone) && (
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
            badge.cls,
          )}
        >
          {badge.label}
        </span>
      )}

      {/* hover 时显示状态切换按钮 */}
      {hover && !isDone && (
        <button
          type="button"
          onClick={() => onSetStatus(item.id, isDoing ? 'todo' : 'doing')}
          className={cn(
            'flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition',
            isDoing
              ? 'bg-stone-100 hover:bg-stone-200 text-brand-700'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700',
          )}
          aria-label={isDoing ? '标记待办' : '标记进行中'}
        >
          {isDoing ? (
            <>
              <RotateCcw size={10} />
              待办
            </>
          ) : (
            <>
              <Play size={10} />
              进行中
            </>
          )}
        </button>
      )}

      {/* hover 时 done 状态下显示「撤销」按钮 */}
      {hover && isDone && (
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-stone-100 hover:bg-stone-200 text-brand-700 transition"
          aria-label="撤销完成"
        >
          <RotateCcw size={10} />
          撤销
        </button>
      )}
    </div>
  );
}
