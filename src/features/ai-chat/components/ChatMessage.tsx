/**
 * ChatMessage · 单条消息气泡
 *
 * 用户消息：右对齐，浅色背景
 * AI 消息：左对齐，白色背景 + Markdown 渲染（react-markdown + rehype-sanitize 防 XSS）
 * System 消息：不渲染
 *
 * 预留 actionCard 渲染位（ai-chat-intent-routing 接入后会嵌 ActionCard 组件）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { splitThinking } from '../utils/thinkingExtractor';
import type { ChatMessage } from '@/types/domain';

interface Props {
  message: ChatMessage;
  /**
   * 当前消息是否正在流式生成（仅最后一条 assistant 消息在 generating 时为 true）。
   * 用于渲染"思考中…"占位折叠区，以及 streaming 时自动展开/收起思考过程。
   */
  isStreaming?: boolean;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

export default function ChatMessage({ message, isStreaming = false }: Props): JSX.Element | null {
  if (message.role === 'system') return null;

  const isUser = message.role === 'user';
  const [showThinking, setShowThinking] = useState(false);

  // D3：streaming 时思考折叠区自动展开/收起（chat-thinking-placeholder）
  // 阶段① 无 thinking 无 content → 自动展开"思考中…"占位
  // 阶段② thinking 流出中（有 thinking 无 content）→ 保持展开
  // 阶段③ content 到达 → 自动收起一次，之后用户可手动展开
  const autoExpandedRef = useRef(false);
  const autoCollapsedRef = useRef(false);

  const hasThinking = !!message.thinking;
  // 占位态：streaming + 非用户 + 无 thinking + 无 content
  const isThinkingPlaceholder =
    isStreaming && !isUser && !hasThinking && !message.content;
  // 思考折叠区显示条件：有 thinking 内容，或处于占位态
  const showThinkingSection = !isUser && (hasThinking || isThinkingPlaceholder);

  useEffect(() => {
    if (!isStreaming || isUser) return;
    // 阶段①/②：无 content 时自动展开（一次性，不覆盖用户手动收起）
    if (!message.content && !autoExpandedRef.current) {
      setShowThinking(true);
      autoExpandedRef.current = true;
    }
    // 阶段③：content 首次到达时自动收起（一次性）
    if (message.content && !autoCollapsedRef.current) {
      setShowThinking(false);
      autoCollapsedRef.current = true;
    }
  }, [isStreaming, isUser, message.content]);

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
        {/* D1/D3：AI 思考过程（默认折叠，点击展开）+ streaming 占位 */}
        {showThinkingSection && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowThinking((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 text-[11px] hover:text-stone-600 dark:hover:text-stone-300 transition-colors',
                isThinkingPlaceholder
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-stone-400 dark:text-stone-500',
              )}
              aria-expanded={showThinking}
            >
              {isThinkingPlaceholder && (
                <span className="inline-block w-[11px] h-[11px] border-[1.5px] border-stone-300 dark:border-stone-600 border-t-amber-500 dark:border-t-amber-400 rounded-full animate-spin" />
              )}
              <span className={cn('font-medium', isThinkingPlaceholder && 'animate-pulse')}>
                {isThinkingPlaceholder ? '思考中…' : '思考过程'}
              </span>
              {!isThinkingPlaceholder && (
                <span>{showThinking ? '▲' : '▼'}</span>
              )}
            </button>
            {showThinking && (
              <div className="mt-1 rounded-lg bg-stone-100 dark:bg-stone-800/80 px-3 py-2 text-xs text-stone-500 dark:text-stone-400 whitespace-pre-wrap leading-relaxed border border-stone-200/60 dark:border-stone-600/60">
                {isThinkingPlaceholder ? (
                  <div className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="ml-1.5">AI 正在分析你的问题…</span>
                  </div>
                ) : (
                  <>
                    {message.thinking}
                    {isStreaming && !message.content && (
                      <span className="inline-block animate-pulse">▍</span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 流式生成中的光标占位（content 为空且无思考折叠区时显示） */}
        {!isUser && message.content === '' && !showThinkingSection && (
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