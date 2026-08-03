/**
 * ExecutionPlanCard · PlanMode 产出的执行计划卡片（v1.3 P 模块）
 *
 * 基于 CardShell：clipboard 图标头 + 步骤列表 + 四动作（确认 / 修改 / 导出 .md / 在新对话执行）。
 * 步骤状态跨会话共享（由父级通过 aiPlanRepo 持久化）。
 */

import { useState } from 'react';
import { ClipboardList, Check, Download, Play, Circle } from 'lucide-react';
import CardShell from './CardShell';
import type { AIPlan, ExecutionStep, ExecutionStepStatus } from '@/types/domain';
import { cn } from '@/lib/utils';

interface Props {
  plan: AIPlan;
  onConfirm?: () => void;
  onModify?: () => void;
  onExport?: () => void;
  onRunInB?: () => void;
  /** 步骤状态切换（持久化 + 回写卡片）。 */
  onToggleStep?: (stepId: string, status: ExecutionStepStatus) => void;
}

function planToMarkdown(plan: AIPlan): string {
  const lines = [`# ${plan.title}`, plan.description ? `\n${plan.description}\n` : '', '## 执行步骤', ...plan.steps.map((s, i) => `${i + 1}. [${s.status === 'done' ? 'x' : ' '}] ${s.title}${s.description ? ` — ${s.description}` : ''}`)];
  return lines.join('\n') + '\n';
}

export default function ExecutionPlanCard({ plan, onConfirm, onModify, onExport, onRunInB, onToggleStep }: Props): JSX.Element {
  const [local, setLocal] = useState<AIPlan>(plan);

  const toggle = (step: ExecutionStep) => {
    const next: ExecutionStepStatus = step.status === 'done' ? 'todo' : 'done';
    const updated: AIPlan = { ...local, steps: local.steps.map((s) => (s.id === step.id ? { ...s, status: next } : s)) };
    setLocal(updated);
    onToggleStep?.(step.id, next);
  };

  const exportMd = () => {
    const md = planToMarkdown(local);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${local.title || 'plan'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onExport?.();
  };

  const doneCount = local.steps.filter((s) => s.status === 'done').length;

  return (
    <CardShell
      title={local.title}
      icon={<ClipboardList size={15} className="text-brand-700 dark:text-brand-300" />}
      onConfirm={onConfirm}
      onModify={onModify}
    >
      {local.description && <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">{local.description}</p>}
      <div className="flex items-center gap-2 mb-2 text-[11px] text-stone-400">
        <span>进度 {doneCount}/{local.steps.length}</span>
        <span className="flex-1 h-1 rounded-full bg-stone-200 dark:bg-stone-600 overflow-hidden">
          <span className="block h-full bg-brand-900 dark:bg-brand-500 transition-all" style={{ width: `${(doneCount / local.steps.length) * 100}%` }} />
        </span>
      </div>
      <ol className="space-y-1">
        {local.steps.map((s, i) => (
          <li key={s.id}>
            <button type="button" onClick={() => toggle(s)} className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700/60 text-left transition">
              <span className={cn('mt-0.5 flex-shrink-0', s.status === 'done' ? 'text-green-600' : 'text-stone-300')}>
                {s.status === 'done' ? <Check size={14} /> : <Circle size={14} />}
              </span>
              <span className={cn('flex-1 text-sm', s.status === 'done' ? 'text-stone-400 line-through' : 'text-brand-900 dark:text-stone-100')}>
                <span className="text-stone-400 mr-1">{i + 1}.</span>
                {s.title}
                {s.description && <span className="block text-[11px] text-stone-400 font-normal">{s.description}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2 border-t border-stone-200 dark:border-stone-600 pt-2.5">
        <button type="button" onClick={exportMd} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-medium">
          <Download size={12} /> 导出 .md
        </button>
        <button type="button" onClick={onRunInB} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-xs font-medium">
          <Play size={12} /> 在新对话执行
        </button>
      </div>
    </CardShell>
  );
}
