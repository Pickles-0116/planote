/**
 * PlanViewSwitcher - 计划列表页 3 段视图切换器
 *
 * 视觉（与 prototype plans.html §1 对齐）：
 * - 白底胶囊容器（bg-stone-100 p-1）
 * - 选中态：bg-white shadow-sm text-brand-900
 * - 未选中：text-brand-500 hover:text-brand-900
 *
 * a11y：
 * - 容器 role="tablist"
 * - 按钮 role="tab" + aria-selected
 *
 * 数据约定：
 * - 容器标记 `data-view-switcher`（与 prototype app.js initViewSwitcher 一致）
 * - 每个按钮 `data-view="group|all|table"`
 *
 * 切换由父组件 onChange 回调处理（典型调用：从 useUIStore 读 planListView 并 setPlanListView）。
 */

import { LayoutGrid, List, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanListView } from '@/stores/uiStore';

interface Option {
  value: PlanListView;
  label: string;
  icon: typeof LayoutGrid;
}

const OPTIONS: Option[] = [
  { value: 'group', label: '分组', icon: LayoutGrid },
  { value: 'all', label: '全部', icon: List },
  { value: 'table', label: '表格', icon: Table2 },
];

interface Props {
  value: PlanListView;
  onChange: (next: PlanListView) => void;
}

export default function PlanViewSwitcher({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="计划列表视图"
      data-view-switcher
      className="flex p-1 bg-stone-100 rounded-xl"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-view={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition',
              active
                ? 'bg-white text-brand-900 shadow-sm'
                : 'text-brand-500 hover:text-brand-900',
            )}
          >
            <Icon size={12} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
