/**
 * PlanSortDropdown - 计划列表页排序方案下拉切换器（add-smart-sort）
 *
 * 视觉（与 PlanViewSwitcher 同色系）：
 * - 触发按钮：白底 + 圆角 + border-stone-200 + ChevronDown 图标
 * - 展开面板：绝对定位 + 白底 + shadow-lg + 圆角
 * - 选中态：左侧 2px brand-900 边 + 浅色背景（bg-brand-50）
 * - hover：bg-stone-50
 *
 * a11y：
 * - 触发按钮：aria-haspopup="listbox" + aria-expanded
 * - 选项列表：role="listbox"
 * - 选项：role="option" + aria-selected
 *
 * 行为：
 * - 点击触发器 → 展开/收起
 * - 点击外部 → 关闭
 * - Esc 键 → 关闭（保持当前 value）
 * - 点击选项 → onChange + 立即关闭
 *
 * 排序预设来源：`@/shared/sort` 的 SORT_OPTIONS（单一来源，新增预设只改 presets.ts）。
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SORT_OPTIONS, findSortOption } from '@/shared/sort';
import type { SortKey } from '@/shared/sort';

interface Props {
  value: SortKey;
  onChange: (next: SortKey) => void;
}

export default function PlanSortDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = findSortOption(value);

  return (
    <div ref={rootRef} className="relative" data-sort-dropdown>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 px-3 rounded-xl bg-white border border-stone-200 text-sm font-medium',
          'flex items-center gap-1.5 transition',
          open ? 'text-brand-900 border-brand-300' : 'text-brand-700 hover:text-brand-900 hover:border-stone-300',
        )}
      >
        <ArrowDownAZ size={14} className="text-brand-500" />
        <span>{current.label}</span>
        <ChevronDown
          size={14}
          className={cn('text-brand-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="排序方案"
          className={cn(
            'absolute right-0 top-full mt-2 z-20 w-64',
            'bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden',
            'animate-fadeUp',
          )}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-start gap-2 transition',
                  'border-l-2',
                  active
                    ? 'bg-brand-50 border-brand-900'
                    : 'border-transparent hover:bg-stone-50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-brand-900' : 'text-brand-700',
                    )}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs text-brand-400 mt-0.5">{opt.description}</div>
                </div>
                {active && (
                  <Check size={14} className="text-brand-900 mt-0.5 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
