/**
 * PlanFilterPanel - 计划列表多维筛选器
 *
 * v1.4-Organize F3.1：状态/时间维度/标签/日期范围筛选。
 */

import { X } from 'lucide-react';
import type { PlanStatus, PlanTimeDim, ID } from '@/types/domain';
import { cn } from '@/lib/utils';

export interface PlanFilterState {
  statuses: PlanStatus[];
  timeDims: PlanTimeDim[];
  selectedTagIds: ID[];
  dateRange: { start: string; end: string } | null;
}

export const DEFAULT_PLAN_FILTERS: PlanFilterState = {
  statuses: [],
  timeDims: [],
  selectedTagIds: [],
  dateRange: null,
};

const STATUS_OPTIONS: Array<{ value: PlanStatus; label: string }> = [
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'paused', label: '已搁置' },
];

const TIME_DIM_OPTIONS: Array<{ value: PlanTimeDim; label: string }> = [
  { value: 'daily', label: '短期' },
  { value: 'monthly', label: '中期' },
  { value: 'yearly', label: '长期' },
  { value: 'once', label: '一次性' },
];

interface PlanFilterPanelProps {
  filters: PlanFilterState;
  onChange: (filters: PlanFilterState) => void;
  matchCount: number;
}

export default function PlanFilterPanel({ filters, onChange, matchCount }: PlanFilterPanelProps) {
  const hasFilters = filters.statuses.length > 0 || filters.timeDims.length > 0 ||
    filters.selectedTagIds.length > 0 || filters.dateRange !== null;

  const toggleStatus = (status: PlanStatus) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: next });
  };

  const toggleTimeDim = (dim: PlanTimeDim) => {
    const next = filters.timeDims.includes(dim)
      ? filters.timeDims.filter(d => d !== dim)
      : [...filters.timeDims, dim];
    onChange({ ...filters, timeDims: next });
  };

  const clearFilters = () => onChange(DEFAULT_PLAN_FILTERS);

  return (
    <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
      {/* 状态 */}
      <div>
        <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">状态</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg transition',
                filters.statuses.includes(opt.value)
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-stone-700 text-brand-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 时间维度 */}
      <div>
        <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">时间维度</div>
        <div className="flex flex-wrap gap-1.5">
          {TIME_DIM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleTimeDim(opt.value)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg transition',
                filters.timeDims.includes(opt.value)
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-stone-700 text-brand-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 日期范围 */}
      <div>
        <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">日期范围</div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateRange?.start ?? ''}
            onChange={(e) => onChange({
              ...filters,
              dateRange: { start: e.target.value, end: filters.dateRange?.end ?? '' }
            })}
            className="px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg text-brand-900 dark:text-stone-100"
          />
          <span className="text-xs text-brand-500 dark:text-stone-400">~</span>
          <input
            type="date"
            value={filters.dateRange?.end ?? ''}
            onChange={(e) => onChange({
              ...filters,
              dateRange: { start: filters.dateRange?.start ?? '', end: e.target.value }
            })}
            className="px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg text-brand-900 dark:text-stone-100"
          />
        </div>
      </div>

      {/* 底部：匹配计数 + 清除 */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-700">
        <span className="text-xs text-brand-500 dark:text-stone-400">
          找到 {matchCount} 个匹配计划
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
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