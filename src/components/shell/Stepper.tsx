/**
 * Stepper - 通用 3 步骤指示器
 *
 * 视觉（与 prototype plan-edit.html 顶部指示器对齐）：
 * - 圆点（数字） + 横线连接 + 文案
 * - active：brand-900 背景白字
 * - completed：emerald-500 背景 + check icon
 * - pending：stone-200 背景 + 灰色数字
 *
 * 交互（spec §「步骤状态机」）：
 * - pending 步骤不可点击
 * - current 步骤不可点击
 * - completed 步骤可点击跳回
 * - a11y：role="navigation" + aria-current="step"
 *
 * 用法（PlanEdit 3 步）：
 *   <Stepper
 *     current={step}
 *     completed={completed}
 *     onJump={setStep}
 *     steps={[
 *       { id: 1, label: '基础信息', description: '标题 + 描述' },
 *       { id: 2, label: '类型与维度', description: '层级 + 时间维度' },
 *       { id: 3, label: '拆解事项', description: '可执行清单' },
 *     ]}
 *   />
 */

import { Check } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDef {
  id: 1 | 2 | 3;
  label: string;
  description?: string;
}

interface Props {
  current: 1 | 2 | 3;
  completed: Set<1 | 2 | 3>;
  onJump: (step: 1 | 2 | 3) => void;
  steps: StepDef[];
}

export default function Stepper({ current, completed, onJump, steps }: Props) {
  return (
    <nav
      role="navigation"
      aria-label="计划创建步骤"
      className="flex items-center gap-2 mb-8 animate-fadeUp"
    >
      {steps.map((step, idx) => {
        const isActive = step.id === current;
        const isCompleted = completed.has(step.id) && !isActive;
        const isPending = !isActive && !isCompleted;
        const clickable = isCompleted;

        return (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => clickable && onJump(step.id)}
              disabled={!clickable}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${step.label}${isActive ? '（当前）' : isCompleted ? '（已完成）' : '（未开始）'}`}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition',
                isActive && 'bg-brand-900 dark:bg-stone-700 text-white shadow-sm',
                isCompleted && 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer',
                isPending && 'text-brand-500 dark:text-stone-500 cursor-default',
              )}
            >
              <span
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  isActive && 'bg-white dark:bg-stone-200 text-brand-900 dark:text-stone-900',
                  isCompleted && 'bg-emerald-500 text-white',
                  isPending && 'bg-stone-200 dark:bg-stone-700 text-brand-500 dark:text-stone-400',
                )}
              >
                {isCompleted ? <Check size={11} strokeWidth={3} /> : step.id}
              </span>
              <span>{step.label}</span>
            </button>
            {idx < steps.length - 1 && (
              <ChevronRight className="text-brand-300 dark:text-stone-600 text-xs flex-shrink-0" size={12} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
