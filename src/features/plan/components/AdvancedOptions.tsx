/**
 * AdvancedOptions - 高级选项折叠
 *
 * 设计要点（design.md §2.8）：
 * - 折叠入口：步骤 3 底部「高级选项」
 * - 内容（v1.0 部分 disabled）：
 *   1. 「完成后自动生成博客」checkbox（v1.0 disabled，v1.1 启用）
 *   2. 「每日提醒」checkbox（v1.0 disabled，v1.1 启用）
 *   3. 「关联到上级计划」select（启用）
 *
 * Props:
 * - state, onChange
 * - parentCandidates: 可选的上级计划列表（level=long 的 plans）
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Plan, ID } from '@/types/domain';
import type { DraftFormState } from '../hooks/usePlanEditDraft';

interface Props {
  state: DraftFormState;
  onChange: (patch: Partial<DraftFormState>) => void;
  parentCandidates: Plan[];
}

export default function AdvancedOptions({ state, onChange, parentCandidates }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white rounded-2xl border border-stone-200 mb-6 animate-fadeUp">
      {/* 折叠入口 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-brand-700 hover:bg-stone-50 transition rounded-2xl"
        aria-expanded={open}
      >
        <span>高级选项</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* 折叠内容 */}
      {open && (
        <div className="px-6 pb-6 space-y-3 border-t border-stone-100 pt-4">
          {/* 完成后自动生成博客（v1.0 disabled） */}
          <div className="flex items-start gap-2">
            <label
              className={cn(
                'flex items-center gap-2 text-sm',
                state.autoGenBlog ? 'text-brand-900' : 'text-brand-500',
                'cursor-not-allowed',
              )}
            >
              <input
                type="checkbox"
                checked={state.autoGenBlog}
                disabled
                onChange={() => onChange({ autoGenBlog: !state.autoGenBlog })}
                className="rounded border-stone-300 cursor-not-allowed"
              />
              完成后自动生成博客
            </label>
            <Badge>v1.1 启用</Badge>
          </div>

          {/* 每日提醒（v1.0 disabled） */}
          <div className="flex items-start gap-2">
            <label
              className={cn(
                'flex items-center gap-2 text-sm',
                state.dailyReminder ? 'text-brand-900' : 'text-brand-500',
                'cursor-not-allowed',
              )}
            >
              <input
                type="checkbox"
                checked={state.dailyReminder}
                disabled
                onChange={() => onChange({ dailyReminder: !state.dailyReminder })}
                className="rounded border-stone-300 cursor-not-allowed"
              />
              每日提醒
            </label>
            <Badge>v1.1 启用</Badge>
          </div>

          {/* 关联上级（v1.0 enabled） */}
          <div>
            <label className="text-xs font-semibold text-brand-700 block mb-1.5">
              关联到上级计划
            </label>
            {parentCandidates.length === 0 ? (
              <div className="text-xs text-brand-400 flex items-center gap-1">
                <Info size={11} />
                暂无可关联的长期计划
              </div>
            ) : (
              <select
                value={state.parentPlanId ?? ''}
                onChange={(e) =>
                  onChange({
                    parentPlanId: e.target.value ? (e.target.value as ID) : null,
                  })
                }
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-brand-900 transition"
              >
                <option value="">无（独立计划）</option>
                {parentCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium">
      <Info size={9} />
      {children}
    </span>
  );
}
