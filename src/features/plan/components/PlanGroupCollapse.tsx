/**
 * PlanGroupCollapse - 计划分组视图的单组容器（含折叠展开）
 *
 * 行为（add-plan-list-view/spec.md Requirement: 分组视图折叠展开）：
 * - 折叠时：显示前 `threshold`（默认 5）个 + 「展开剩余 N 个」虚线按钮
 * - 展开时：显示全部 + 「收起」按钮
 * - 折叠状态用 useState 内部维护（不持久化，与 prototype 一致）
 *
 * 视觉：
 * - 标题 h2（与 prototype plans.html section 标题对齐）
 * - 计数 badge：默认 `前 5 / 30`；展开后 `已显示 N / 总数`
 * - 颜色圆点（color 参数）作组标识（短/中/长期对应不同色）
 *
 * 不在本 change 范围：
 * - 折叠状态持久化（design.md §2.4 明确不出范围）
 * - 组级「全部展开 / 全部收起」（v1.1）
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** 组标题（"短期"/"中期"/"长期"） */
  title: string;
  /** 描述（"1-4 周" / "1-6 个月" / "1-3 年"，可省略） */
  subtitle?: string;
  /** 组标识色（圆点 bg-*） */
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'stone';
  /** 组内 plan 总数 */
  count: number;
  /** 实际渲染的 plan 列表（已按智能排序） */
  children: ReactNode[];
  /** 折叠阈值；默认 5 */
  threshold?: number;
  /** 入场动画 delay 索引（按 50ms 递增） */
  delayClass?: string;
}

const COLOR_DOT: Record<Props['color'], string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  stone: 'bg-stone-500',
};

export default function PlanGroupCollapse({
  title,
  subtitle,
  color,
  count,
  children,
  threshold = 5,
  delayClass = '',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  // count === 0：上层不渲染本组件；此函数只处理 count > 0
  const shouldCollapse = count > threshold && !expanded;
  const visible = shouldCollapse ? children.slice(0, threshold) : children;
  const hiddenCount = Math.max(0, count - threshold);

  return (
    <section className={cn('animate-fadeUp', delayClass)}>
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('w-2 h-2 rounded-full', COLOR_DOT[color])} />
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {subtitle && <span className="text-xs text-brand-400">· {subtitle}</span>}
        <span className="text-[10px] text-brand-400 bg-stone-100 px-1.5 py-0.5 rounded">
          {expanded || count <= threshold
            ? `${count} 个`
            : `前 ${threshold} / ${count}`}
        </span>
      </div>

      {/* 列表 */}
      <div className="space-y-3">
        {visible.map((node, i) => (
          <div key={i}>{node}</div>
        ))}
      </div>

      {/* 折叠/展开按钮 */}
      {count > threshold && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full bg-white rounded-2xl border border-dashed border-stone-300 p-4 mt-3 text-center hover:border-brand-400 hover:bg-stone-50 transition cursor-pointer"
        >
          {expanded ? (
            <div className="flex items-center justify-center gap-2 text-sm text-brand-500">
              <ChevronUp size={12} />
              <span>收起</span>
              <span className="text-[10px] text-brand-400">（已显示全部 {count}）</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-brand-500">
              <ChevronDown size={12} />
              <span>
                展开剩余 <span className="font-semibold text-brand-900">{hiddenCount}</span> 个
              </span>
              <span className="text-[10px] text-brand-400">
                （已显示 {threshold} / {count}）
              </span>
            </div>
          )}
        </button>
      )}
    </section>
  );
}
