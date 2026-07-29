/**
 * AIStatusBar - 编辑器 AI 状态条
 *
 * 在编辑器区域顶部显示薄条状态栏：
 * - generating：脉冲动画 + "AI 正在写作…" + 停止按钮
 * - done/error：短暂显示后自动隐藏
 * - idle：不渲染
 */

import { useState, useEffect } from 'react';
import { Sparkles, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'generating' | 'done' | 'error' | 'idle';

interface Props {
  status: Status;
  onCancel?: () => void;
}

export default function AIStatusBar({ status, onCancel }: Props): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'generating') {
      setVisible(true);
    } else if (status === 'done' || status === 'error') {
      const timer = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [status]);

  if (!visible && status === 'idle') return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-1.5 rounded-t-xl text-xs transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        status === 'generating' && 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-400',
        status === 'done' && 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
        status === 'error' && 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={12} className={status === 'generating' ? 'animate-pulse' : ''} />
        <span>
          {status === 'generating' && 'AI 正在写作…'}
          {status === 'done' && '生成完成'}
          {status === 'error' && '生成失败'}
        </span>
      </div>

      {status === 'generating' && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-brand-100 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 transition-colors"
        >
          <Square size={10} fill="currentColor" />
          停止
        </button>
      )}
    </div>
  );
}
