/**
 * SortHint - 排序规则说明条（amber 背景）
 *
 * 视觉（与 prototype plans.html §1 对齐）：
 * - bg-amber-50/50 + border-amber-200
 * - Lucide Sparkles icon + 文案「按紧急度+进度智能排序，紧急度高的优先」
 *
 * 仅在分组视图下显示（design.md §2.1：3 视图对「已排序」数据的展示约定一致，
 * 但说明条语义上仅对智能排序生效，表格视图下隐藏以避免歧义）。
 */

import { Sparkles } from 'lucide-react';

export default function SortHint() {
  return (
    <div
      role="note"
      className="mb-4 px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900 animate-fadeUp animate-delay-50"
    >
      <Sparkles className="text-amber-600" size={12} />
      <span>分组内按"紧急度 + 进度"排序：</span>
      <span className="font-semibold">🔴 今天截止</span>
      <span className="text-amber-400">›</span>
      <span className="font-semibold">🟠 1-3 天内</span>
      <span className="text-amber-400">›</span>
      <span className="font-semibold">🟡 4-7 天内</span>
      <span className="text-amber-400">›</span>
      <span className="text-amber-700">按进度从高到低</span>
    </div>
  );
}
