/**
 * ChatSessionList · 会话列表侧边栏
 *
 * 显示：标题 + updatedAt 相对时间 + 消息数
 * 操作：点击切换、新建、删除
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/features/blog/utils/formatRelativeTime';
import type { ChatSession, ID } from '@/types/domain';

interface Props {
  sessions: ChatSession[];
  activeSessionId: ID | null;
  onSelect: (id: ID) => void;
  onCreate: () => void;
  onDelete: (id: ID) => void;
}

export default function ChatSessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
}: Props): JSX.Element {
  // 强制刷新相对时间显示（每分钟）
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-800 border-r border-stone-200 dark:border-stone-700">
      <div className="p-3 border-b border-stone-200 dark:border-stone-700">
        <button
          type="button"
          data-testid="chat-new-session"
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-900 hover:bg-brand-800 text-white text-sm font-medium transition-colors dark:bg-brand-700 dark:hover:bg-brand-600"
        >
          <Plus size={14} />
          新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-stone-400 dark:text-stone-500">
            暂无历史会话
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              data-testid={`chat-session-${s.id}`}
              className={cn(
                'group flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-stone-100 dark:border-stone-700/50 transition-colors',
                activeSessionId === s.id
                  ? 'bg-brand-50 dark:bg-brand-900/20'
                  : 'hover:bg-stone-50 dark:hover:bg-stone-700/50',
              )}
              onClick={() => onSelect(s.id)}
            >
              <MessageSquare
                size={14}
                className={cn(
                  'flex-shrink-0 mt-0.5',
                  activeSessionId === s.id ? 'text-brand-700 dark:text-brand-400' : 'text-stone-400',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-brand-900 dark:text-stone-100 truncate">
                  {s.title || '新对话'}
                </div>
                <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                  {formatRelativeTime(s.updatedAt)} · {s.messages.length} 条
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`删除会话「${s.title}」？`)) onDelete(s.id);
                }}
                aria-label="删除会话"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}