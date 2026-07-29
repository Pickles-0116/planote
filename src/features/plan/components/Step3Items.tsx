/**
 * Step3Items - 步骤 3：事项拆解
 *
 * 行为（spec §「事项拆解」）：
 * - 列表：可增删可编辑的事项
 * - 单条 UI：input（title）+ date input（dueDate）+ 上移/下移/删除按钮
 * - 底部虚线「+ 添加事项」按钮
 * - 校验：≥ 1 个非空 title 才能保存
 * - 排序：v1.0 用上下移按钮（拖拽留 add-item-drag-sort）
 *
 * v1.1 修（spec Scenario: 打开已有计划的编辑页）：
 * - draft 携带 `existingId`（来自 useItemsForPlan）
 * - 行左侧显示状态徽章：
 *   - 「已存在」= 既有项（existingId 存在）
 *   - 「新增」= 本次编辑新增项（无 existingId）
 * - 标题清空 + 已存在项 → 在 usePlanEditSubmit 内被识别为「将删除」
 *
 * 视觉（与 prototype plan-edit.html 事项行对齐）：
 * - 行高 p-3，stone-50 背景，hover 变白
 * - 删除按钮 hover 显红
 *
 * Props:
 * - items: DraftItem[]
 * - onAdd / onUpdate / onRemove / onMove
 */

import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraftItem } from '../hooks/usePlanEditDraft';

interface Props {
  items: DraftItem[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<DraftItem>) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
}

export default function Step3Items({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: Props) {
  const hasValid = items.some((it) => it.title.trim().length > 0);

  return (
    <section className="bg-white rounded-2xl border border-stone-200 p-6 mb-6 animate-fadeUp">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-brand-900 text-white text-xs flex items-center justify-center font-bold">
            3
          </span>
          拆解事项
          <span className="text-xs font-normal text-brand-400 ml-2">
            把它变成可执行的具体动作
          </span>
        </h2>
      </div>

      {/* 事项列表 */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-xs text-brand-400 py-6">
            点击下方「+ 添加事项」开始拆解
          </div>
        ) : (
          items.map((item, idx) => (
            <ItemRow
              key={item.existingId ?? item.id ?? `draft-${idx}`}
              item={item}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              isMarkedDelete={
                Boolean(item.existingId) && item.title.trim().length === 0
              }
              onUpdate={(patch) => onUpdate(idx, patch)}
              onRemove={() => onRemove(idx)}
              onMoveUp={() => onMove(idx, -1)}
              onMoveDown={() => onMove(idx, 1)}
            />
          ))
        )}
      </div>

      {/* 添加按钮 */}
      <button
        type="button"
        onClick={onAdd}
        className="w-full mt-3 py-2.5 border border-dashed border-stone-300 text-brand-500 rounded-xl text-sm hover:border-brand-500 hover:text-brand-900 transition flex items-center justify-center gap-2"
      >
        <Plus size={12} />
        添加事项
      </button>

      {/* 校验提示 */}
      {!hasValid && (
        <div className="text-[10px] text-amber-600 mt-2 text-center">
          至少添加 1 个有效事项
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * 单条事项行
 * ============================================================ */
function ItemRow({
  item,
  isFirst,
  isLast,
  isMarkedDelete,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: DraftItem;
  isFirst: boolean;
  isLast: boolean;
  isMarkedDelete: boolean;
  onUpdate: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const isExisting = Boolean(item.existingId);
  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-3 bg-stone-50 rounded-xl hover:bg-white transition',
        isMarkedDelete && 'opacity-60',
      )}
    >
      {/* 拖拽 handle（v1.0 disabled，留 add-item-drag-sort 接管） */}
      <GripVertical
        className="text-stone-300 cursor-not-allowed flex-shrink-0"
        size={14}
        aria-label="拖拽排序（v1.1 启用）"
      />

      {/* 状态徽章：已存在 / 新增 / 将删除 */}
      {isMarkedDelete ? (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 text-red-700 bg-red-50 border border-red-200"
          data-badge="will-delete"
        >
          将删除
        </span>
      ) : isExisting ? (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 text-stone-500 bg-stone-100 border border-stone-200"
          data-badge="existing"
        >
          已存在
        </span>
      ) : (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 text-emerald-700 bg-emerald-50 border border-emerald-200"
          data-badge="new"
        >
          新增
        </span>
      )}

      {/* 标题 */}
      <input
        type="text"
        value={item.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="事项标题（必填）"
        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-brand-300"
      />

      {/* 截止日期 */}
      <input
        type="date"
        value={item.dueDate ?? ''}
        onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
        className="w-36 bg-transparent text-xs text-brand-500 focus:outline-none"
      />

      {/* 上移/下移/删除 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center transition',
            isFirst
              ? 'text-stone-300 cursor-not-allowed'
              : 'text-brand-400 hover:text-brand-900 hover:bg-stone-100',
          )}
          aria-label="上移"
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center transition',
            isLast
              ? 'text-stone-300 cursor-not-allowed'
              : 'text-brand-400 hover:text-brand-900 hover:bg-stone-100',
          )}
          aria-label="下移"
        >
          <ChevronDown size={12} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="w-6 h-6 rounded text-brand-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition"
          aria-label="删除事项"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
