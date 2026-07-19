/**
 * FrameworkList - 框架卡片列表容器（add-framework-drawer 增量）
 *
 * props：
 * - items: 过滤后的预置列表
 * - selectedId: 当前选中 id
 * - onSelect: 选择回调
 * - onClearFilters: 清除筛选
 * - hasFilters: 是否处于筛选状态
 * - appliedId: 已应用到当前 Blog 的 id（用于显示「已应用」标记）
 *
 * 空态：
 * - hasFilters → 「没有匹配的框架」 + 清除筛选按钮
 * - 否则 → 「暂无可用框架」（理论上不会发生）
 */

import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import FrameworkCard from './FrameworkCard';
import type { PresetFramework } from '@/features/framework/data/presets';
import type { ID } from '@/types/domain';

interface Props {
  items: PresetFramework[];
  selectedId: ID | null;
  onSelect: (id: ID) => void;
  onClearFilters: () => void;
  hasFilters: boolean;
  appliedId?: ID | null;
}

export default function FrameworkList({
  items,
  selectedId,
  onSelect,
  onClearFilters,
  hasFilters,
  appliedId = null,
}: Props): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-3">
          <Inbox size={20} className="text-brand-400" />
        </div>
        <p className="text-sm text-brand-600 mb-3">
          {hasFilters ? '没有匹配的框架' : '暂无可用框架'}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-xl',
              'bg-brand-900 text-white hover:bg-brand-800 transition',
            )}
          >
            清除筛选
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((fw) => (
        <FrameworkCard
          key={fw.id}
          framework={fw}
          isSelected={selectedId === fw.id}
          onClick={() => onSelect(fw.id)}
          isApplied={appliedId === fw.id}
        />
      ))}
    </div>
  );
}
