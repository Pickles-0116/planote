/**
 * TagFilter - tag 多选筛选条（add-framework-drawer 增量）
 *
 * props：
 * - tags: 全量 tag 列表（来自 ALL_PRESET_TAGS）
 * - selected: 当前选中的 tag 集合
 * - onToggle: 切换某个 tag 的选中态
 *
 * 视觉：
 * - 横向 scroll 容器
 * - chip：12px 文本 + 1.5px padding，激活态 brand-900 背景白字，未激活 bg-stone-100
 * - a11y：role="switch" aria-checked + aria-label
 */

import { cn } from '@/lib/utils';

interface Props {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}

export default function TagFilter({ tags, selected, onToggle }: Props): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
      {tags.map((tag) => {
        const isActive = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={`筛选标签 ${tag}`}
            onClick={() => onToggle(tag)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition flex-shrink-0',
              'focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
              isActive
                ? 'bg-brand-900 text-white'
                : 'bg-stone-100 text-brand-500 hover:bg-stone-200',
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
