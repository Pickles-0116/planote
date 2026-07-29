/**
 * AIChat · /ai-chat 全屏页
 *
 * AppLayout 已为 /ai-chat 路由提供整宽整高的 <main> 容器（绕过 max-w-7xl）。
 * 这里直接 h-full 填满父级即可。
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useAIChat } from '@/features/ai-chat/hooks/useAIChat';
import { buildChatSystemPrompt } from '@/features/ai-chat/prompts/chatSystemPrompt';
import ChatSessionList from '@/features/ai-chat/components/ChatSessionList';
import ChatPanel, { type CardAction } from '@/features/ai-chat/components/ChatPanel';
import ModelSelector from '@/features/ai-chat/components/ModelSelector';
import { handleCreatePlan } from '@/features/ai-chat/handlers/createPlanHandler';
import { handleSaveBlogDraft } from '@/features/ai-chat/handlers/createBlogHandler';
import { handleCreateTemplate } from '@/features/ai-chat/handlers/createTemplateHandler';
import { emitChatEvent } from '@/features/ai-chat/utils/emitChatEvent';

export default function AIChat(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get('session');

  const chat = useAIChat((ctx) => buildChatSystemPrompt({ mode: ctx.mode ?? 'free' }));
  const [sessionTitle, setSessionTitle] = useState('新对话');

  useEffect(() => {
    if (initialSessionId) {
      chat.setSessionId(initialSessionId).catch(console.error);
    }
  }, [initialSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const s = chat.sessions.find((x) => x.id === chat.activeSessionId);
    if (s) setSessionTitle(s.title);
  }, [chat.sessions, chat.activeSessionId]);

  const ctx = useMemo(
    () => ({
      navigate,
      appendAssistantMessage: chat.appendAssistantMessage,
    }),
    [navigate, chat.appendAssistantMessage],
  );

  const handleCardAction: CardAction = (card, action) => {
    const cardType =
      card.type === 'plan_preview' ? 'plan' :
      card.type === 'blog_preview' ? 'blog' :
      card.type === 'template_preview' ? 'template' :
      card.type === 'data_query' ? 'query' :
      card.type === 'suggestion' ? 'suggestion' : 'plan';

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
    if (card.type === 'plan_preview') {
      void handleCreatePlan(card.data, ctx);
    } else if (card.type === 'blog_preview') {
      void handleSaveBlogDraft(card.data, ctx);
    } else if (card.type === 'template_preview') {
      void handleCreateTemplate(card.data, ctx);
    } else {
      console.log('[CardAction confirm] unhandled card type:', card.type);
    }
  };

  const handleTemplatePick = (templateName: string) => {
    chat.send(`使用模板 ${templateName}`).catch(console.error);
  };

  const showTemplatePicker = useMemo(() => {
    const last = chat.messages[chat.messages.length - 1];
    return (
      last?.actionCard?.type === 'blog_preview' &&
      !last.actionCard.data.templateId
    );
  }, [chat.messages]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-900">
      {/* 顶栏 */}
      <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-700 flex items-center gap-3 bg-white dark:bg-stone-800 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="返回"
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center justify-center text-brand-500"
        >
          <ArrowLeft size={16} />
        </button>
        <Sparkles size={16} className="text-brand-700 dark:text-brand-400" />
        <h2 className="text-base font-bold text-brand-900 dark:text-stone-100 truncate flex-1">
          {sessionTitle}
        </h2>
        <ModelSelector
          value={chat.modelProfileId}
          options={chat.availableProfiles}
          disabled={!chat.activeSessionId || chat.status === 'generating'}
          onChange={(id) => {
            chat.setModelProfileId(id).catch(console.error);
          }}
        />
        <span className="text-xs text-stone-400 dark:text-stone-500 ml-2">
          {chat.activeSessionId ? `${chat.messages.length} 条消息` : '未选择会话'}
        </span>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 min-h-0">
        <div className="w-60 flex-shrink-0 border-r border-stone-200 dark:border-stone-700">
          <ChatSessionList
            sessions={chat.sessions}
            activeSessionId={chat.activeSessionId}
            onSelect={(id) => {
              chat.setSessionId(id).catch(console.error);
              navigate(`/ai-chat?session=${id}`, { replace: true });
            }}
            onCreate={() => {
              chat
                .createNewSession()
                .then((id) => navigate(`/ai-chat?session=${id}`, { replace: true }))
                .catch(console.error);
            }}
            onDelete={() => {
              chat.deleteCurrentSession().catch(console.error);
              navigate('/ai-chat', { replace: true });
            }}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <ChatPanel
            status={chat.status}
            messages={chat.messages}
            mode={chat.mode}
            activeSessionId={chat.activeSessionId}
            errorMessage={chat.errorMessage}
            onSend={chat.send}
            onCancel={chat.cancel}
            onModeChange={(m) => {
              chat.setMode(m).catch(console.error);
            }}
            onCardAction={handleCardAction}
            onTemplatePick={handleTemplatePick}
            showTemplatePicker={showTemplatePicker}
          />
        </div>
      </div>
    </div>
  );
}