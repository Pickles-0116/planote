/**
 * ChatMessage · 单条消息气泡
 *
 * 用户消息：右对齐，浅色背景
 * AI 消息：左对齐，白色背景 + Markdown 渲染（react-markdown + rehype-sanitize 防 XSS）
 * System 消息：不渲染
 *
 * 预留 actionCard 渲染位（ai-chat-intent-routing 接入后会嵌 ActionCard 组件）。
 */

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { splitThinking } from '../utils/thinkingExtractor';
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
  const [showThinking, setShowThinking] = useState(false);

  // 把 markdown 渲染节点包装一层 — 因为 ai-chat-intent-routing 还没接，这里只是预留位置
  const renderedContent = useMemo(() => {
    if (isUser) return null;
    // D2：兜底历史脏数据/漏网路径，渲染前再剥一次 <thinking>
    const cleanContent = splitThinking(message.content || '').content || ' ';
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
        >
          {cleanContent}
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
        {/* D1：AI 思考过程（默认折叠，点击展开） */}
        {!isUser && message.thinking && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowThinking((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              aria-expanded={showThinking}
            >
              <span className="font-medium">思考过程</span>
              <span>{showThinking ? '▲' : '▼'}</span>
            </button>
            {showThinking && (
              <div className="mt-1 rounded-lg bg-stone-100 dark:bg-stone-800/80 px-3 py-2 text-xs text-stone-500 dark:text-stone-400 whitespace-pre-wrap leading-relaxed border border-stone-200/60 dark:border-stone-600/60">
                {message.thinking}
              </div>
            )}
          </div>
        )}

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