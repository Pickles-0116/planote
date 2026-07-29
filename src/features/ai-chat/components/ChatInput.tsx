/**
 * ChatInput · 输入框 + 发送按钮 + 中断按钮 + 模式切换占位
 *
 * ai-chat-intent-routing 会把 ModeToggle 接入（替换 placeholder）。
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMode } from '@/types/domain';
import type { ChatStatus } from '../hooks/useAIChat';

interface Props {
  status: ChatStatus;
  mode: ChatMode;
  onSend: (text: string) => void;
  onCancel: () => void;
  onModeChange?: (mode: ChatMode) => void;
}

export default function ChatInput({ status, mode, onSend, onCancel, onModeChange }: Props): JSX.Element {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = status === 'generating';
  const canSend = text.trim().length > 0 && !isGenerating;

  // 自动撑高（最多 200px）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    // 重置高度
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.style.height = 'auto';
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isGenerating ? 'AI 正在回复...' : '输入消息，Enter 发送，Shift+Enter 换行'}
          disabled={isGenerating}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-xl border border-stone-200 dark:border-stone-600',
            'bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-100 px-3 py-2',
            'focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-400',
            'disabled:bg-stone-50 dark:disabled:bg-stone-800 disabled:cursor-not-allowed',
          )}
        />
        {isGenerating ? (
          <button
            type="button"
            data-testid="chat-cancel"
            onClick={onCancel}
            aria-label="停止生成"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            data-testid="chat-send"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="发送"
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
              canSend
                ? 'bg-brand-900 hover:bg-brand-800 text-white dark:bg-brand-700 dark:hover:bg-brand-600'
                : 'bg-stone-100 dark:bg-stone-700 text-stone-400 cursor-not-allowed',
            )}
          >
            <Send size={16} />
          </button>
        )}
      </div>

      {/* 模式占位（ai-chat-intent-routing 接入） */}
      {onModeChange && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
          <span>当前模式：{mode === 'guided' ? '🧭 引导模式' : '⚡ 自由模式'}</span>
          <button
            type="button"
            onClick={() => onModeChange(mode === 'guided' ? 'free' : 'guided')}
            className="hover:underline"
          >
            切换
          </button>
        </div>
      )}
    </div>
  );
}