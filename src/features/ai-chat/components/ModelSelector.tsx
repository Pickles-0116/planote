/**
 * ModelSelector · 会话级 AI 模型下拉选择器
 *
 * 显示当前会话使用的模型，提供切换入口：
 * - 「默认（跟随全局）」：不绑定特定 model，用 useAIModelStore.getDefaultProfile()
 * - 其他：列出所有 AIModelProfile，按 name 显示
 *
 * 来源：v1.5 AI 对话助手 - per-session 模型选择
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileOption {
  id: string;
  name: string;
  provider: string;
  model: string;
}

interface Props {
  /** 当前选中的 profile ID（null = 全局默认） */
  value: string | null;
  /** 所有可选 profile */
  options: ProfileOption[];
  /** 全局默认 profile 的显示名（用于「默认」选项的副文本） */
  defaultName?: string;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}

const PROVIDER_SHORT: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  qwen: 'Qwen',
  custom: 'Custom',
};

export default function ModelSelector({
  value,
  options,
  defaultName = '默认',
  disabled,
  onChange,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = value ? options.find((p) => p.id === value) : null;
  const label = current
    ? `${current.name} · ${PROVIDER_SHORT[current.provider] ?? current.provider}`
    : defaultName;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        data-testid="chat-model-selector"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
          'border-stone-200 dark:border-stone-600',
          open
            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
            : 'bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Cpu size={11} />
        {label}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] max-h-72 overflow-y-auto scrollbar-thin bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              'w-full text-left px-3 py-2 text-xs hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors',
              value === null && 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300',
            )}
          >
            <div className="font-medium">默认</div>
            <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
              跟随全局默认模型（{defaultName}）
            </div>
          </button>

          {options.length > 0 && (
            <div className="border-t border-stone-100 dark:border-stone-700 my-1" />
          )}

          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-stone-400 dark:text-stone-500">
              暂无可用模型，请到「设置 → AI 模型」添加
            </div>
          ) : (
            options.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors',
                  value === p.id && 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300',
                )}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                  {PROVIDER_SHORT[p.provider] ?? p.provider} · {p.model}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}