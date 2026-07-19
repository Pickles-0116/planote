/**
 * ItemChecklist - 事项清单容器
 *
 * 行为（spec Requirement: 事项勾选与进度联动）：
 * - 接收已排序的 items（按 order asc）+ onToggle + onSetStatus
 * - 渲染标题 + 计数 + ItemRow 列表 + 「添加事项」虚线按钮
 * - 空态：EmptyState compact
 *
 * 「添加事项」按钮 v1.0 仅占位（add-item-crud 接手）。
 */

import { Plus, ListChecks } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import ItemRow from './ItemRow';
import type { ID, Item, ItemStatus } from '@/types/domain';

interface Props {
  items: Item[];
  onToggle: (id: ID) => void;
  onSetStatus: (id: ID, status: ItemStatus) => void;
}

export default function ItemChecklist({ items, onToggle, onSetStatus }: Props) {
  const completed = items.filter((i) => i.status === 'done').length;

  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-6 animate-fadeUp">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ListChecks size={16} className="text-brand-500" />
          事项清单
        </h2>
        <div className="flex items-center gap-2 text-xs text-brand-500">
          <span className="font-semibold text-emerald-600" data-progress-count>
            {completed}
          </span>
          <span>/</span>
          <span data-progress-count-total>{items.length}</span>
          <span>已完成</span>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="该计划还没有事项"
          description="添加第一个事项，开始推进计划"
          variant="compact"
        />
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin pr-2 -mr-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onSetStatus={onSetStatus}
            />
          ))}
        </div>
      )}

      {/* 「添加事项」v1.0 占位：add-item-crud 接手 */}
      <button
        type="button"
        disabled
        className="w-full mt-3 py-2 border border-dashed border-stone-300 text-brand-400 rounded-lg text-sm flex items-center justify-center gap-1.5 cursor-not-allowed"
        title="事项增删由 add-item-crud 接手"
      >
        <Plus size={12} />
        添加事项
      </button>
    </section>
  );
}
