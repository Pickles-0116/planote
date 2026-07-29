/**
 * PolishGenerator - 自由润色模式 UI
 *
 * 输入原始素材 → 选择风格/长度预设 → 一键润色为博客。
 */

import { useState, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useAIGenerate } from '../hooks/useAIGenerate';
import { buildPolishPrompt } from '../prompts';
import type { PolishStyle, PolishLength } from '../prompts';
import { markdownToTiptapJSON } from '@/features/blog/utils/markdownToTiptap';
import { cn } from '@/lib/utils';

interface Props {
  editor?: Editor | null;
}

const STYLES: { value: PolishStyle; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'concise', label: '简洁' },
  { value: 'detailed', label: '详细' },
  { value: 'storytelling', label: '故事化' },
  { value: 'listicle', label: '列表化' },
];

const LENGTHS: { value: PolishLength; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'short', label: '短文' },
  { value: 'medium', label: '中文' },
  { value: 'long', label: '长文' },
];

export default function PolishGenerator({ editor }: Props): JSX.Element {
  const [material, setMaterial] = useState('');
  const [style, setStyle] = useState<PolishStyle>('auto');
  const [length, setLength] = useState<PolishLength>('auto');

  const { status, generatedText, errorMessage, generate } = useAIGenerate('polish');

  const canGenerate = material.trim().length >= 50 && status !== 'generating';

  const handleGenerate = useCallback(async () => {
    const { system, user } = buildPolishPrompt({
      rawMaterial: material,
      style,
      length,
    });
    const md = await generate([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    if (md && editor) {
      const json = markdownToTiptapJSON(md);
      editor.commands.setContent(json as never);
    }
  }, [material, style, length, generate, editor]);

  return (
    <div className="p-5 space-y-4">
      {/* 素材输入 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          原始素材
        </label>
        <textarea
          value={material}
          onChange={(e) => setMaterial(e.target.value.slice(0, 5000))}
          placeholder="粘贴笔记、想法、草稿…（至少 50 字）"
          rows={8}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-300 dark:placeholder:text-stone-500"
        />
        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 text-right">
          {material.length} / 5000
        </p>
      </div>

      {/* 风格预设 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          输出风格
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStyle(value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                style === value
                  ? 'bg-brand-900 text-white dark:bg-brand-700'
                  : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 长度预设 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          输出长度
        </label>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setLength(value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                length === value
                  ? 'bg-brand-900 text-white dark:bg-brand-700'
                  : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 状态 */}
      {status === 'generating' && (
        <div className="flex items-center gap-2 text-sm text-brand-900 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded-xl px-4 py-3">
          <Loader2 size={16} className="animate-spin" />
          正在润色生成…
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          <button type="button" onClick={handleGenerate} className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline">
            <RefreshCw size={12} /> 重试
          </button>
        </div>
      )}
      {status === 'done' && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            润色完成（{generatedText.length} 字），已插入编辑器
          </p>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={cn(
          'w-full py-2.5 rounded-xl text-sm font-medium transition-colors',
          canGenerate
            ? 'bg-brand-900 text-white hover:bg-brand-800 dark:bg-brand-700 dark:hover:bg-brand-600'
            : 'bg-stone-100 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed',
        )}
      >
        {status === 'generating' ? '润色中…' : '润色生成'}
      </button>
    </div>
  );
}
