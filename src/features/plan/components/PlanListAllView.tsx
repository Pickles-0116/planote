/**
 * PlanListAllView - 计划「全部」紧凑横排视图
 *
 * 行为（add-plan-list-view/spec.md Requirement: 全部视图紧凑横排）：
 * - 一列紧凑横排：单行 + 进度环 + 标题 + 紧急度 tag + 进度百分比
 * - 100+ plan 启用虚拟滚动：v1.0 实测 100+ 列表原生渲染也流畅；
 *   为避免引入 react-virtuoso 依赖（不在 package.json），采用「加载更多」分页
 *   （design.md §5.6 明确 v1.0 简化分页）。
 *
 * 数据：`plans` 已是智能排序后的数组。
 */

import { useState } from 'react';
import { ArrowDownWideNarrow, ChevronRight } from 'lucide-react';
import PlanCard from './PlanCard';
import type { Plan } from '@/types/domain';

interface Props {
  plans: Plan[];
  /** 每页大小（v1.0 简化为「加载更多」按钮，无独立分页器） */
  pageSize?: number;
}

export default function PlanListAllView({ plans, pageSize = 30 }: Props) {
  const [visible, setVisible] = useState(pageSize);
  const shown = plans.slice(0, visible);
  const hasMore = plans.length > visible;

  return (
    <div className="animate-fadeUp">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-brand-500">
          共 <span className="font-semibold text-brand-900">{plans.length}</span> 项 · 按智能排序
        </span>
        <button
          type="button"
          className="ml-auto text-sm text-brand-500 hover:text-brand-900 flex items-center gap-1.5"
        >
          <ArrowDownWideNarrow size={12} />
          排序
        </button>
      </div>

      <div className="space-y-2">
        {shown.map((p) => (
          <PlanCard key={p.id} plan={p} density="compact" />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-4">
          <div className="text-xs text-brand-500">
            显示 <span className="font-semibold text-brand-900">1-{visible}</span>，共{' '}
            <span className="font-semibold text-brand-900">{plans.length}</span>
          </div>
          <button
            type="button"
            onClick={() => setVisible((v) => v + pageSize)}
            className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-brand-700 text-sm flex items-center gap-1 transition"
          >
            加载更多
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
