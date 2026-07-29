/**
 * ItemChecklist - 事项清单容器
 *
 * 行为（spec Requirement: 计划详情页 MUST 支持内联添加 / 编辑 / 删除事项）：
 * - 接收已排序的 items（按 order asc）+ onAdd / onUpdate / onRemove / onToggle / onSetStatus
 * - 渲染标题 + 计数 + ItemRow 列表 + 「添加事项」按钮（v1.1 起 enabled）
 * - 点击「+ 添加事项」→ 展开 inline input（autoFocus）
 *   - 回车提交 → 调 onAdd({ title }) → 保留焦点允许连续添加
 *   - ESC / blur 收起 input
 * - 空态：EmptyState compact
 */

import { useRef, useState, useEffect } from 'react';
import { Plus, ListChecks } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import ItemRow from './ItemRow';
import type { ID, Item, ItemStatus } from '@/types/domain';

interface Props {
  items: Item[];
  onToggle: (id: ID) => void;
  onSetStatus: (id: ID, status: ItemStatus) => void;
  onAdd: (init: { title: string }) => Promise<unknown> | void;
  onUpdate: (id: ID, patch: Partial<Item>) => Promise<void> | void;
  onRemove: (id: ID) => Promise<void> | void;
}

export default function ItemChecklist({
  items,
  onToggle,
  onSetStatus,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const completed = items.filter((i) => i.status === 'done').length;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 展开时聚焦
  useEffect(() => {
    if (adding) {
      inputRef.current?.focus();
    }
  }, [adding]);

  const submit = async (): Promise<void> => {
    const title = draft.trim();
    if (!title) {
      setAdding(false);
      setDraft('');
      return;
    }
    try {
      await onAdd({ title });
      setDraft('');
      // 保留焦点 → ref 仍指向 input，下次直接输入继续添加
      inputRef.current?.focus();
    } catch (e) {
      // 失败保留输入让用户重试
      console.error('[ItemChecklist] add failed:', e);
    }
  };

  const cancel = (): void => {
    setAdding(false);
    setDraft('');
  };

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

      {items.length === 0 && !adding ? (
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
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {/* 「+ 添加事项」v1.1：展开 inline input */}
      {adding ? (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 border border-brand-300 rounded-lg bg-white">
          <Plus size={12} className="text-brand-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            onBlur={() => {
              // 失焦自动提交（空内容则收起）
              if (draft.trim()) {
                void submit();
              } else {
                cancel();
              }
            }}
            placeholder="事项标题（回车提交，ESC 取消）"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-brand-300"
            data-add-item-input
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full mt-3 py-2 border border-dashed border-stone-300 text-brand-500 rounded-lg text-sm flex items-center justify-center gap-1.5 hover:border-brand-500 hover:text-brand-900 transition"
        >
          <Plus size={12} />
          添加事项
        </button>
      )}
    </section>
  );
}
