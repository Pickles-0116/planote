/**
 * PlanFilterPanel - 计划列表多维筛选器
 *
 * v1.4-Organize F3.1：状态/时间维度/标签/日期范围筛选。
 * V1.2 B5：标签 UI 落地（此前 apply 已支持但无入口）+ 新增层级维度，
 *          统一使用 `EntityFilterState`（来自 useEntityFilters）。
 */

import { X } from 'lucide-react';
import type { PlanStatus, PlanTimeDim, PlanLevel, Tag } from '@/types/domain';
import { cn } from '@/lib/utils';
import {
  type EntityFilterState,
  DEFAULT_ENTITY_FILTERS,
} from '@/features/filters/useEntityFilters';

/** 兼容旧导出的别名（PlanList 仍 import 这两个名字）。 */
export type PlanFilterState = EntityFilterState;
export const DEFAULT_PLAN_FILTERS: PlanFilterState = DEFAULT_ENTITY_FILTERS;

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

const LEVEL_OPTIONS: Array<{ value: PlanLevel; label: string }> = [
  { value: 'short', label: '短期' },
  { value: 'mid', label: '中期' },
  { value: 'long', label: '长期' },
];

interface PlanFilterPanelProps {
  filters: PlanFilterState;
  onChange: (filters: PlanFilterState) => void;
  matchCount: number;
  /** 可选标签数据源（无则不渲染标签区）。 */
  tags?: Tag[];
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function PlanFilterPanel({ filters, onChange, matchCount, tags }: PlanFilterPanelProps) {
  const hasFilters =
    filters.statuses.length > 0 ||
    filters.timeDims.length > 0 ||
    filters.levels.length > 0 ||
    filters.selectedTagIds.length > 0 ||
    filters.dateRange !== null;

  const clearFilters = () => onChange(DEFAULT_PLAN_FILTERS);

  return (
    <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 space-y-3">
      {/* 状态 */}
      <div>
        <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">状态</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, opt.value) })}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg transition',
                filters.statuses.includes(opt.value)
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-stone-700 text-brand-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600',
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
          {TIME_DIM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filters, timeDims: toggle(filters.timeDims, opt.value) })}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg transition',
                filters.timeDims.includes(opt.value)
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-stone-700 text-brand-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 层级（V1.2 B5） */}
      <div>
        <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">层级</div>
        <div className="flex flex-wrap gap-1.5">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filters, levels: toggle(filters.levels, opt.value) })}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg transition',
                filters.levels.includes(opt.value)
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-stone-700 text-brand-700 dark:text-stone-300 border border-stone-200 dark:border-stone-600',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 标签（V1.2 B5：此前 apply 已支持但缺 UI 入口） */}
      {tags && tags.length > 0 && (
        <div>
          <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">标签</div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {tags.map((t) => {
              const active = filters.selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange({ ...filters, selectedTagIds: toggle(filters.selectedTagIds, t.id) })}
                  className={cn(
                    'px-2 py-0.5 text-xs rounded-full transition border',
                    active
                      ? 'bg-brand-900 text-white border-brand-900'
                      : 'bg-white text-brand-600 border-stone-200 hover:border-brand-300',
                  )}
                >
                  #{t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 日期范围 */}
      <div>
        <div className="text-xs font-medium text-brand-500 dark:text-stone-400 mb-1.5">日期范围</div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateRange?.start ?? ''}
            onChange={(e) => onChange({ ...filters, dateRange: { start: e.target.value, end: filters.dateRange?.end ?? '' } })}
            className="px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg text-brand-900 dark:text-stone-100"
          />
          <span className="text-xs text-brand-500 dark:text-stone-400">~</span>
          <input
            type="date"
            value={filters.dateRange?.end ?? ''}
            onChange={(e) => onChange({ ...filters, dateRange: { start: filters.dateRange?.start ?? '', end: e.target.value } })}
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
