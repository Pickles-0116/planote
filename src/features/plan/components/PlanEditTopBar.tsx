/**
 * PlanEditTopBar - 计划编辑页顶栏
 *
 * 视觉（与 prototype plan-edit.html header + PlanDetailTopBar 对齐）：
 * - 左侧：返回按钮 + breadcrumb（计划 / 新建/编辑）
 * - 中间：标题「新建计划 / 编辑计划」
 * - 右侧：保存按钮（步骤 3 可见）+ 保存中 spinner
 *
 * 行为：
 * - 返回按钮 → onBack（父组件决定是否弹 confirm）
 * - 保存按钮 → onSubmit
 *
 * Props:
 * - mode: 'create' | 'edit'
 * - saving: 是否正在保存
 * - canSave: 是否可保存（步骤 3 校验通过）
 * - showSave: 是否显示保存按钮（步骤 3 才显示）
 * - onBack, onSubmit
 */

import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mode: 'create' | 'edit';
  saving: boolean;
  showSave: boolean;
  canSave: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export default function PlanEditTopBar({
  mode,
  saving,
  showSave,
  canSave,
  onBack,
  onSubmit,
}: Props) {
  const title = mode === 'create' ? '新建计划' : '编辑计划';

  return (
    <div className="flex items-center gap-3 mb-6 animate-fadeUp">
      {/* 返回按钮 */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition"
        aria-label="返回"
      >
        <ArrowLeft size={14} />
      </button>

      {/* breadcrumb */}
      <nav className="flex items-center gap-2 text-sm flex-1 min-w-0">
        <Link
          to="/plans"
          className="text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 transition flex-shrink-0"
        >
          计划
        </Link>
        <ChevronRight className="text-brand-300 dark:text-stone-600 flex-shrink-0" size={12} />
        <span className="text-brand-900 dark:text-stone-100 font-medium truncate">{title}</span>
      </nav>

      {/* 保存按钮（步骤 3 可见） */}
      {showSave && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSave || saving}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-sm',
            !canSave || saving
              ? 'bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed'
              : 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200',
          )}
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? '保存中' : '保存计划'}
        </button>
      )}
    </div>
  );
}
