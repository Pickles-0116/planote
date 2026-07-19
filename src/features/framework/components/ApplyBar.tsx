/**
 * ApplyBar - 抽屉底部 CTA（add-framework-drawer 增量）
 *
 * props：
 * - selected: 当前选中的预置（null 时禁用）
 * - onApply: 点击应用回调
 * - ref：通过 ref 把 apply button 暴露给父组件做 focus trap
 */

import { forwardRef, type Ref } from 'react';
import { cn } from '@/lib/utils';
import type { PresetFramework } from '@/features/framework/data/presets';

interface Props {
  selected: PresetFramework | null;
  onApply: () => void;
}

const ApplyBar = forwardRef(function ApplyBar(
  { selected, onApply }: Props,
  ref: Ref<HTMLButtonElement>,
): JSX.Element {
  const disabled = !selected;
  return (
    <div className="p-5 border-t border-stone-200 flex-shrink-0 bg-white">
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={onApply}
        className={cn(
          'w-full py-2.5 text-sm font-medium rounded-xl transition',
          'focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
          disabled
            ? 'bg-stone-100 text-brand-400 cursor-not-allowed'
            : 'bg-brand-900 text-white hover:bg-brand-800 shadow-sm',
        )}
      >
        {disabled ? '请先选择一个框架' : `应用《${selected?.name ?? ''}》`}
      </button>
    </div>
  );
});

export default ApplyBar;
