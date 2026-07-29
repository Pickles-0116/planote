/**
 * EntityFilterBar - 统一的多维筛选条（V1.2 B5）
 *
 * 复用于计划列表 / 看板等需要「状态 / 时间维度 / 层级 / 标签 / 日期」筛选的场景。
 * 通过 `showStatus / showTimeDim / showLevel / showDate` 控制显示哪些维度，
 * 避免为每个页面复制一套 toggle 渲染。
 *
 * 状态完全受控：值来自 `EntityFilterState`，改动通过 `onChange` 上抛。
 */

import { X } from 'lucide-react';
import type { Tag } from '@/types/domain';
import { cn } from '@/lib/utils';
import { type EntityFilterState } from '../useEntityFilters';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'paused', label: '已搁置' },
];

const TIME_DIM_OPTIONS: { value: string; label: string }[] = [
  { value: 'daily', label: '短期' },
  { value: 'monthly', label: '中期' },
  { value: 'yearly', label: '长期' },
  { value: 'once', label: '一次性' },
];

const LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'short', label: '短期' },
  { value: 'mid', label: '中期' },
  { value: 'long', label: '长期' },
];

interface Props {
  filters: EntityFilterState;
  onChange: (f: EntityFilterState) => void;
  tags: Tag[];
  /** 匹配计数（展示在底部）。 */
  matchCount?: number;
  showStatus?: boolean;
  showTimeDim?: boolean;
  showLevel?: boolean;
  showDate?: boolean;
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function EntityFilterBar({
  filters,
  onChange,
  tags,
  matchCount,
  showStatus = true,
  showTimeDim = true,
  showLevel = true,
  showDate = false,
}: Props): JSX.Element {
  const hasFilters =
    filters.statuses.length > 0 ||
    filters.timeDims.length > 0 ||
    filters.levels.length > 0 ||
    filters.selectedTagIds.length > 0 ||
    filters.dateRange !== null;

  const chipClass = (active: boolean): string =>
    cn(
      'px-2.5 py-1 text-xs rounded-lg transition',
      active
        ? 'bg-brand-600 text-white'
        : 'bg-white dark:bg-stone-700 text-brand-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600',
    );

  return (
    <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
      {showStatus && (
        <div>
          <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">状态</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, opt.value) })}
                className={chipClass(filters.statuses.includes(opt.value))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showTimeDim && (
        <div>
          <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">时间维度</div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_DIM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...filters, timeDims: toggle(filters.timeDims, opt.value) })}
                className={chipClass(filters.timeDims.includes(opt.value))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLevel && (
        <div>
          <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">层级</div>
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...filters, levels: toggle(filters.levels, opt.value) })}
                className={chipClass(filters.levels.includes(opt.value))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">标签</div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange({ ...filters, selectedTagIds: toggle(filters.selectedTagIds, t.id) })}
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full transition border',
                  filters.selectedTagIds.includes(t.id)
                    ? 'bg-brand-900 text-white border-brand-900'
                    : 'bg-white text-brand-600 border-stone-200 hover:border-brand-300',
                )}
              >
                #{t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showDate && (
        <div>
          <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">日期范围</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.dateRange?.start ?? ''}
              onChange={(e) =>
                onChange({ ...filters, dateRange: { start: e.target.value, end: filters.dateRange?.end ?? '' } })
              }
              className="px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg text-brand-900 dark:text-stone-100"
            />
            <span className="text-xs text-brand-500 dark:text-stone-400">~</span>
            <input
              type="date"
              value={filters.dateRange?.end ?? ''}
              onChange={(e) =>
                onChange({ ...filters, dateRange: { start: filters.dateRange?.start ?? '', end: e.target.value } })
              }
              className="px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg text-brand-900 dark:text-stone-100"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-700">
        <span className="text-xs text-brand-500 dark:text-stone-400">找到 {matchCount ?? 0} 个匹配</span>
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              onChange({ statuses: [], timeDims: [], levels: [], selectedTagIds: [], dateRange: null })
            }
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 dark:hover:text-stone-200 transition"
          >
            <X size={12} />
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}
