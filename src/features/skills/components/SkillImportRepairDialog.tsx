/**
 * SkillImportRepairDialog.tsx · D2
 *
 * 上传的 skill markdown 不符合规范时弹出：展示原始解析错误 + 「用 AI 帮我整理」
 * 按钮，点后调用 repairSkillMarkdown 把原文改成标准格式，填入可编辑文本框；
 * 用户确认后 onConfirm(fixedText) 交给父组件导入。
 */

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Check, Loader2, AlertTriangle } from 'lucide-react';
import { repairSkillMarkdown } from '../utils/repairSkillMarkdown';
import { checkSkillMarkdown } from '@/features/skills/utils/importSkills';

interface Props {
  open: boolean;
  rawText: string;
  errorMessage: string;
  fileName: string;
  onCancel: () => void;
  /** 用户在预览里确认修复后的文本，父组件负责解析 + 导入。 */
  onConfirm: (fixedText: string) => void | Promise<void>;
}

export function SkillImportRepairDialog({
  open,
  rawText,
  errorMessage,
  fileName,
  onCancel,
  onConfirm,
}: Props): JSX.Element | null {
  const [fixedText, setFixedText] = useState(rawText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 每次打开（或失败内容变化）重置文本框为原始文本
  useEffect(() => {
    if (open) {
      setFixedText(rawText);
      setError(null);
    }
  }, [open, rawText]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!open) return null;

  const runAi = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const fixed = await repairSkillMarkdown({
        rawText,
        errorMessage,
        fileName,
        signal: ctrl.signal,
      });
      setFixedText(fixed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleConfirm = async () => {
    setError(null);

    // 前置本地校验：不通过就地报错，不把坏文本抛给父组件导入。
    const check = checkSkillMarkdown(fixedText);
    if (!check.ok) {
      setError(`格式仍不符合要求：${check.message}`);
      return;
    }

    setConfirming(true);
    try {
      await onConfirm(fixedText);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-[min(860px,94vw)] max-h-[88vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-stone-800">
        {/* 头部 */}
        <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-4 dark:border-stone-700">
          <AlertTriangle size={18} className="text-amber-500" />
          <h3 className="flex-1 text-base font-semibold text-brand-900 dark:text-stone-100">
            格式不兼容，需要整理后导入
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <span className="font-medium">解析报错：</span>
            {errorMessage}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                整理后的标准格式（可手动微调）
              </span>
              <button
                type="button"
                onClick={runAi}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? 'AI 整理中…' : '用 AI 帮我整理'}
              </button>
            </div>
            <textarea
              value={fixedText}
              onChange={(e) => setFixedText(e.target.value)}
              spellCheck={false}
              className="h-72 w-full resize-y rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-xs leading-relaxed text-stone-800 outline-none focus:border-brand-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              placeholder="点「用 AI 帮我整理」生成标准格式，或在此手动粘贴正确的 markdown…"
            />
            <p className="mt-1 text-xs text-stone-400">
              标准格式：<code className="rounded bg-stone-100 px-1 dark:bg-stone-700">--- frontmatter（name/type/folder/description/params）---</code> + 正文模板（用 <code className="rounded bg-stone-100 px-1 dark:bg-stone-700">{'{{key}}'}</code> 引用参数）。
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-4 dark:border-stone-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || fixedText.trim() === ''}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            {confirming ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {confirming ? '导入中…' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
}
