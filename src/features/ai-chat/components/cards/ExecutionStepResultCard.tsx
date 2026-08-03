/**
 * ExecutionStepResultCard · 步骤执行结果卡片（v1.3-fix F3 · D5）
 *
 * 渲染 `/execute` 单步执行的结果：标题「步骤 {stepOrder}：{title}」+ 执行结果徽章
 * + result 文本（pre 可滚动）+ 复制按钮（navigator.clipboard）。
 *
 * 数据来源：ActionCard `{ type: 'execution_step_result', data: { planId, stepOrder, title, result } }`。
 */

import { useState } from 'react';
import { Copy, Check, SquareCheck } from 'lucide-react';
import CardShell from './CardShell';

interface Props {
  stepOrder: number;
  title: string;
  result: string;
}

export default function ExecutionStepResultCard({
  stepOrder,
  title,
  result,
}: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 非安全上下文/剪贴板不可用时静默失败（复制按钮仅做增强）
    }
  };

  return (
    <CardShell
      title={`步骤 ${stepOrder}：${title}`}
      icon={<SquareCheck size={15} className="text-green-600 dark:text-green-400" />}
      hideActions
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-[10px] font-medium text-green-700 dark:text-green-300">
          执行结果
        </span>
      </div>
      <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words text-xs text-brand-900 dark:text-stone-100 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg p-3">
        {result}
      </pre>
      <div className="mt-3 flex gap-2 border-t border-stone-200 dark:border-stone-600 pt-2.5">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 text-xs font-medium transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
    </CardShell>
  );
}
