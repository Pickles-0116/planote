/**
 * ChatMessage · 单条消息气泡
 *
 * 用户消息：右对齐，浅色背景
 * AI 消息：左对齐，白色背景 + Markdown 渲染（react-markdown + rehype-sanitize 防 XSS）
 * System 消息：不渲染
 *
 * 预留 actionCard 渲染位（ai-chat-intent-routing 接入后会嵌 ActionCard 组件）。
 */

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/domain';

interface Props {
  message: ChatMessage;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

export default function ChatMessage({ message }: Props): JSX.Element | null {
  if (message.role === 'system') return null;

  const isUser = message.role === 'user';

  // 把 markdown 渲染节点包装一层 — 因为 ai-chat-intent-routing 还没接，这里只是预留位置
  const renderedContent = useMemo(() => {
    if (isUser) return null;
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
        >
          {message.content || ' '}
        </ReactMarkdown>
      </div>
    );
  }, [isUser, message.content]);

  return (
    <div
      data-testid={isUser ? 'chat-message-user' : 'chat-message-assistant'}
      className={cn(
        'flex w-full mb-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm group relative',
          isUser
            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-900 dark:text-stone-100 rounded-br-sm'
            : 'bg-white dark:bg-stone-700 text-brand-900 dark:text-stone-100 rounded-bl-sm border border-stone-200 dark:border-stone-600',
        )}
      >
        {/* 流式生成中的光标占位（content 为空时显示） */}
        {!isUser && message.content === '' && (
          <span className="inline-block animate-pulse">▍</span>
        )}
        {isUser ? message.content : renderedContent}

        {/* 时间戳：hover 时显示 */}
        <span
          className={cn(
            'absolute -bottom-5 text-[10px] text-stone-400 dark:text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap',
            isUser ? 'right-1' : 'left-1',
          )}
        >
          {formatRelativeTime(message.timestamp)}
        </span>

        {/* 失败时显示重试按钮（仅 user 消息） */}
        {isUser && message.status === 'error' && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            发送失败
          </div>
        )}
      </div>
    </div>
  );
}