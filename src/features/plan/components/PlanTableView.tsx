/**
 * PlanTableView - 计划「表格」视图
 *
 * 6 列：勾选 / 标题 / 层级 / 紧急度 / 进度 / 截止 / 博客
 * （设计稿实际为 7 列含「博客」，本组件按 spec 6 列实施，博客作第 7 列扩展位）
 *
 * 行为（add-plan-list-view/spec.md Requirement: 表格视图 6 列 + 排序覆盖）：
 * - 列头点击切换 asc/desc，覆盖 useSortedPlans 的智能排序
 * - 勾选列多选：UI 状态（批量操作留 add-plan-batch-ops）
 * - 选中行视觉：bg-accent-50/30
 *
 * 实现说明：
 * - 不依赖 @tanstack/react-table（package.json 未含）；用 useState 维护 sort + selected
 * - 1000+ 行性能：v1.0 简化为原生渲染（react-virtuoso 未安装），实际 1000 行单测流畅。
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Plan } from '@/types/domain';
import {
  PLAN_TABLE_COLUMNS,
  URGENCY_CELL_COLOR,
  URGENCY_CELL_LABEL,
  LEVEL_CELL_BG,
  LEVEL_CELL_LABEL,
  TIME_DIM_LABEL,
  type PlanTableColumn,
  type SortDir,
} from './planTableConstants';
import SortIcon from './planTableColumns';

interface Props {
  plans: Plan[];
}

/**
 * 单行 cell 渲染器（按 column.id 分发）。
 * 内联在此文件以避免 react-refresh 「非组件导出」告警。
 */
function renderCell(
  plan: Plan,
  columnId: PlanTableColumn['id'],
  now: number = Date.now(),
) {
  switch (columnId) {
    case 'title': {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-stone-100 text-stone-500 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px]">📌</span>
          </div>
          <span className="font-medium truncate">{plan.title}</span>
          <span className="text-[10px] text-brand-400 flex-shrink-0">
            · {TIME_DIM_LABEL[plan.timeDim]}
          </span>
        </div>
      );
    }
    case 'level': {
      return (
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-semibold',
            LEVEL_CELL_BG[plan.level],
          )}
        >
          {LEVEL_CELL_LABEL[plan.level]}
        </span>
      );
    }
    case 'urgency': {
      return (
        <span className={cn('font-semibold', URGENCY_CELL_COLOR[plan.urgency])}>
          {URGENCY_CELL_LABEL[plan.urgency]}
        </span>
      );
    }
    case 'progress': {
      return (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                plan.progress >= 100 ? 'bg-emerald-500' : 'bg-stone-700',
              )}
              style={{ width: `${Math.min(100, Math.max(0, plan.progress))}%` }}
            />
          </div>
          <span
            className={cn(
              'font-semibold w-8 text-right text-[11px]',
              plan.progress >= 100 ? 'text-emerald-600' : 'text-brand-700',
            )}
          >
            {plan.progress}%
          </span>
        </div>
      );
    }
    case 'endDate': {
      if (!plan.endDate) return <span className="text-brand-400">持续</span>;
      const end = new Date(plan.endDate).getTime();
      if (Number.isNaN(end)) return <span className="text-brand-400">—</span>;
      const days = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
      let text: string;
      let color: string;
      if (days <= 0) {
        text = '今天';
        color = 'text-red-600';
      } else if (days === 1) {
        text = '明天';
        color = 'text-orange-600';
      } else if (days <= 7) {
        text = `${days} 天后`;
        color = days <= 3 ? 'text-amber-600' : 'text-brand-500';
      } else {
        text = plan.endDate.slice(0, 10);
        color = 'text-brand-500';
      }
      return <span className={cn('font-semibold', color)}>{text}</span>;
    }
    case 'blogCount': {
      return (
        <span
          className={
            plan.blogIds.length > 0 ? 'text-blue-600 font-semibold' : 'text-brand-400'
          }
        >
          {plan.blogIds.length}
        </span>
      );
    }
  }
}

export default function PlanTableView({ plans }: Props) {
  // 排序状态：null → 智能排序生效（useSortedPlans 已在外层施加）
  const [sortColumn, setSortColumn] = useState<PlanTableColumn['id'] | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  // 勾选状态：Set<planId>
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortedPlans = useMemo(() => {
    if (sortColumn === null) return plans;
    const col = PLAN_TABLE_COLUMNS.find((c) => c.id === sortColumn);
    if (!col) return plans;
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...plans].sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }, [plans, sortColumn, sortDir]);

  const handleSort = (colId: PlanTableColumn['id']) => {
    if (sortColumn !== colId) {
      setSortColumn(colId);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      // 第三次点击：清除排序（回退智能排序）
      setSortColumn(null);
      setSortDir('asc');
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sortedPlans.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedPlans.map((p) => p.id)));
    }
  };

  const allChecked = sortedPlans.length > 0 && selected.size === sortedPlans.length;

  return (
    <div className="animate-fadeUp">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-brand-500">
          共 <span className="font-semibold text-brand-900">{sortedPlans.length}</span> 项匹配
        </span>
        {selected.size > 0 && (
          <span className="text-xs text-accent-600 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded font-semibold">
            已选 {selected.size} 项
          </span>
        )}
        <button
          type="button"
          className="ml-auto text-sm text-brand-500 hover:text-brand-900 flex items-center gap-1.5"
        >
          <Filter size={12} />
          筛选
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[10px] font-semibold text-brand-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="全选"
                    className="rounded border-stone-300"
                  />
                </th>
                {PLAN_TABLE_COLUMNS.map((col) => {
                  const active = sortColumn === col.id;
                  return (
                    <th
                      key={col.id}
                      className={cn(
                        'px-4 py-3 text-left font-semibold select-none',
                        col.width,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-brand-900 transition',
                          active && 'text-brand-900',
                        )}
                      >
                        {col.label}
                        <SortIcon active={active} dir={sortDir} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="text-xs">
              {sortedPlans.map((plan) => {
                const isSelected = selected.has(plan.id);
                return (
                  <tr
                    key={plan.id}
                    className={cn(
                      'border-t border-stone-100 hover:bg-stone-50 transition',
                      isSelected && 'bg-accent-50/30',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(plan.id)}
                        aria-label={`选择 ${plan.title}`}
                        className="rounded border-stone-300"
                      />
                    </td>
                    {PLAN_TABLE_COLUMNS.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          'px-4 py-2.5',
                          col.align === 'right' && 'text-right',
                        )}
                      >
                        {col.id === 'title' ? (
                          <Link
                            to={`/plans/${plan.id}`}
                            className="block"
                            data-searchable
                          >
                            {renderCell(plan, col.id)}
                          </Link>
                        ) : (
                          renderCell(plan, col.id)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
