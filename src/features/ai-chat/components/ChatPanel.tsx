/**
 * ChatPanel · 消息列表 + 输入框
 *
 * 自动滚动到底部。
 * ai-chat-intent-routing：在 ChatMessage 下方嵌入 ActionCard。
 * ai-chat-create-content：把 onCardAction 接入真实 handlers。
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ModeToggle from './ModeToggle';
import PlanPreviewCard from './cards/PlanPreviewCard';
import BlogPreviewCard from './cards/BlogPreviewCard';
import TemplatePreviewCard from './cards/TemplatePreviewCard';
import DataQueryCard from './cards/DataQueryCard';
import UnknownToolCard from './cards/UnknownToolCard';
import SuggestionCard from './cards/SuggestionCard';
import TemplatePickerInChat from './TemplatePickerInChat';
import type { ChatMessage as ChatMsg, ChatMode, ID, ActionCard } from '@/types/domain';
import type { ChatStatus } from '../hooks/useAIChat';

export type CardAction = (card: ActionCard, action: 'confirm' | 'modify' | 'cancel') => void;

interface Props {
  status: ChatStatus;
  messages: ChatMsg[];
  mode: ChatMode;
  activeSessionId: ID | null;
  errorMessage?: string | null;
  onSend: (text: string) => void;
  onCancel: () => void;
  onModeChange?: (mode: ChatMode) => void;
  /** ActionCard 按钮回调（ai-chat-create-content / ai-chat-smart-qa 接入）。 */
  onCardAction?: CardAction;
  /** TemplatePicker 选择模板后发送 user 消息。 */
  onTemplatePick?: (templateName: string) => void;
  /** 当前是否展示模板选择器（仅在 blog_preview 且无 templateId 时显示）。 */
  showTemplatePicker?: boolean;
}

function ActionCardRenderer({
  card,
  onAction,
}: {
  card: ActionCard;
  onAction?: CardAction;
}): JSX.Element | null {
  const stub: CardAction = onAction ?? ((c, a) => console.log('[待接入]', a, c));

  switch (card.type) {
    case 'plan_preview':
      return (
        <PlanPreviewCard
          data={card.data}
          onConfirm={() => stub(card, 'confirm')}
          onModify={() => stub(card, 'modify')}
          onCancel={() => stub(card, 'cancel')}
        />
      );
    case 'blog_preview':
      return (
        <BlogPreviewCard
          data={card.data}
          onConfirm={() => stub(card, 'confirm')}
          onModify={() => stub(card, 'modify')}
          onCancel={() => stub(card, 'cancel')}
        />
      );
    case 'template_preview':
      return (
        <TemplatePreviewCard
          data={card.data}
          onConfirm={() => stub(card, 'confirm')}
          onModify={() => stub(card, 'modify')}
          onCancel={() => stub(card, 'cancel')}
        />
      );
    case 'data_query':
      return <DataQueryCard tool={card.tool} filter={card.filter} />;
    case 'suggestion':
      return <SuggestionCard data={card.data} />;
    case 'unknown':
      return <UnknownToolCard rawTool={card.rawTool} rawData={card.rawData} />;
  }
}

export default function ChatPanel({
  status,
  messages,
  mode,
  activeSessionId: _activeSessionId,
  errorMessage,
  onSend,
  onCancel,
  onModeChange,
  onCardAction,
  onTemplatePick,
  showTemplatePicker,
}: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-stone-50 dark:bg-stone-900">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
        data-testid="chat-message-list"
      >
        {messages.length === 0 ? (
          <div className="px-6 pt-12 pb-6 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="text-base font-semibold text-brand-900 dark:text-stone-100 mb-2">
              Planote AI 助手
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              我可以帮你创建计划、写博客、设计模板，或者查询你的数据。请告诉我你想做什么？
            </p>
            {errorMessage && (
              <div className="mt-4 mx-auto max-w-xs px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 text-left">
                <div className="flex items-start gap-1.5">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {errorMessage === '请先在设置中配置 AI 模型' && (
                  <button
                    type="button"
                    onClick={() => navigate('/settings#ai-models')}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-900 hover:bg-brand-800 dark:bg-brand-700 dark:hover:bg-brand-600 text-white text-xs font-medium transition-colors"
                  >
                    <SettingsIcon size={11} />
                    去设置
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id}>
              <ChatMessage message={m} />
              {m.actionCard && (
                <ActionCardRenderer card={m.actionCard} onAction={onCardAction} />
              )}
            </div>
          ))
        )}

        {/* 错误条：在消息流末尾也展示一次（即使有 messages） */}
        {errorMessage && messages.length > 0 && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TemplatePicker 内嵌在 chat 末尾 */}
        {showTemplatePicker && onTemplatePick && (
          <div className="mt-4 px-2">
            <div className="text-[11px] text-stone-500 dark:text-stone-400 mb-1">
              选择模板以应用其风格：
            </div>
            <TemplatePickerInChat onPick={onTemplatePick} />
          </div>
        )}
      </div>

      {onModeChange && (
        <div className="px-3 py-2 border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex items-center justify-between">
          <ModeToggle mode={mode} onChange={onModeChange} disabled={status === 'generating'} />
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            {mode === 'guided' ? '一次问一个问题' : '智能推断默认值'}
          </span>
        </div>
      )}

      <ChatInput
        status={status}
        mode={mode}
        onSend={onSend}
        onCancel={onCancel}
      />
    </div>
  );
}