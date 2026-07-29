/**
 * ChatBubble · 浮动气泡（右下角）+ 展开面板
 *
 * 浮动按钮：48px 圆形，✨ 图标
 * 展开面板：420×600px，圆角阴影
 *
 * 用法：
 * - 在 AIChatBubbleHost 中用 createPortal 挂到 body
 * - 路由在 /ai-chat 时自动隐藏
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, X, Minus, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAIChat } from '../hooks/useAIChat';
import ChatPanel, { type CardAction } from './ChatPanel';
import { handleCreatePlan } from '../handlers/createPlanHandler';
import { handleSaveBlogDraft } from '../handlers/createBlogHandler';
import { handleCreateTemplate } from '../handlers/createTemplateHandler';
import { emitChatEvent } from '../utils/emitChatEvent';
import ModelSelector from './ModelSelector';

interface Props {
  /** 提供 System Prompt（按 ChatContext 注入）。 */
  systemPromptProvider: (ctx: import('@/types/domain').ChatContext) => string;
  /** 当前路由（用于判断是否隐藏）。 */
  onChatPage?: boolean;
}

export default function ChatBubble({ systemPromptProvider, onChatPage }: Props): JSX.Element | null {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const chat = useAIChat(systemPromptProvider);
  const mode = chat.mode;

  if (onChatPage) return null;

  const ctx = useMemo(
    () => ({ navigate, appendAssistantMessage: chat.appendAssistantMessage }),
    [navigate, chat.appendAssistantMessage],
  );

  const handleCardAction: CardAction = (card, action) => {
    const cardType =
      card.type === 'plan_preview' ? 'plan' :
      card.type === 'blog_preview' ? 'blog' :
      card.type === 'template_preview' ? 'template' :
      card.type === 'data_query' ? 'query' :
      card.type === 'suggestion' ? 'suggestion' : 'plan'; // 'unknown' fallback to 'plan' for type compat

    if (action === 'cancel') {
      emitChatEvent('chat_card_cancel', { cardType });
      chat.appendAssistantMessage('好的，已取消该操作。').catch(console.error);
      return;
    }
    if (action === 'modify') {
      emitChatEvent('chat_card_modify', { cardType });
      chat.appendAssistantMessage('请告诉我你想如何修改？').catch(console.error);
      return;
    }
    emitChatEvent('chat_card_confirm', { cardType });
    if (card.type === 'plan_preview') void handleCreatePlan(card.data, ctx);
    else if (card.type === 'blog_preview') void handleSaveBlogDraft(card.data, ctx);
    else if (card.type === 'template_preview') void handleCreateTemplate(card.data, ctx);
  };

  const handleTemplatePick = (templateName: string) => {
    chat.send(`使用模板 ${templateName}`).catch(console.error);
  };

  const showTemplatePicker = useMemo(() => {
    const last = chat.messages[chat.messages.length - 1];
    return last?.actionCard?.type === 'blog_preview' && !last.actionCard.data.templateId;
  }, [chat.messages]);

  // 点击外部最小化
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as Node)) {
        const button = document.querySelector('[data-testid="chat-bubble-button"]');
        if (button && button.contains(e.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          data-testid="chat-bubble-button"
          onClick={() => {
            emitChatEvent('chat_open', { source: 'bubble' });
            setIsOpen(true);
          }}
          aria-label="打开 AI 对话"
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-brand-900 hover:bg-brand-800 dark:bg-brand-700 dark:hover:bg-brand-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
          style={{ zIndex: 9999 }}
        >
          <Sparkles size={20} />
        </button>
      )}

      {isOpen && (
        <div
          ref={panelRef}
          data-testid="chat-bubble-panel"
          className="fixed bottom-6 right-6 w-[420px] h-[600px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white dark:bg-stone-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-stone-200 dark:border-stone-700 animate-fadeUp"
          style={{ zIndex: 9999 }}
        >
          <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between bg-gradient-to-r from-brand-50 to-white dark:from-stone-800 dark:to-stone-800 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={16} className="text-brand-700 dark:text-brand-400 flex-shrink-0" />
              <h3 className="text-sm font-bold text-brand-900 dark:text-stone-100 truncate">
                Planote AI
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <ModelSelector
                value={chat.modelProfileId}
                options={chat.availableProfiles}
                disabled={!chat.activeSessionId || chat.status === 'generating'}
                onChange={(id) => {
                  chat.setModelProfileId(id).catch(console.error);
                }}
              />
              <button
                type="button"
                onClick={() => navigate('/ai-chat')}
                aria-label="打开完整对话页"
                title="打开完整对话页"
                className="w-7 h-7 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500 dark:text-stone-400"
              >
                <Maximize2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="最小化"
                className="w-7 h-7 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500 dark:text-stone-400"
              >
                <Minus size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  emitChatEvent('chat_close', { messageCount: chat.messages.length });
                  setIsOpen(false);
                  chat.setSessionId(null).catch(console.error);
                }}
                aria-label="关闭"
                className="w-7 h-7 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500 dark:text-stone-400"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ChatPanel
              status={chat.status}
              messages={chat.messages}
              mode={mode}
              activeSessionId={chat.activeSessionId}
              errorMessage={chat.errorMessage}
              onSend={chat.send}
              onCancel={chat.cancel}
              onModeChange={(m) => { chat.setMode(m).catch(console.error); }}
              onCardAction={handleCardAction}
              onTemplatePick={handleTemplatePick}
              showTemplatePicker={showTemplatePicker}
            />
          </div>
        </div>
      )}
    </>
  );
}