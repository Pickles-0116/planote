/**
 * SaveStatusBadge - 自动保存状态徽章（add-blog-tiptap-editor 增量）
 *
 * 状态机：
 * - 'idle'   → 空白（不渲染文字）
 * - 'saving' → 「保存中…」text-amber-600
 * - 'saved'  → 「已保存 · 刚刚」text-emerald-600
 *
 * 只读模式不显示（仅编辑页用）。
 */

import type { SaveStatus } from '@/types/editor';

interface Props {
  status: SaveStatus;
}

export default function SaveStatusBadge({ status }: Props): JSX.Element | null {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <div
        className="text-xs text-amber-600 flex items-center gap-1.5 select-none"
        data-testid="save-status"
        data-status="saving"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        保存中…
      </div>
    );
  }

  return (
    <div
      className="text-xs text-emerald-600 flex items-center gap-1.5 select-none"
      data-testid="save-status"
      data-status="saved"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      已保存 · 刚刚
    </div>
  );
}
