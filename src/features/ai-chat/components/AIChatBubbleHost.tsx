/**
 * AIChatBubbleHost · 全局挂载容器（Portal → body）
 *
 * 与 FrameworkGenerationDrawerHost 同级模式：在 AppLayout 中挂一次。
 * - 监听当前路由：/ai-chat 时不渲染（避免重复 UI）
 * - 用 createPortal 挂到 body，z-index 9999
 */

import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import ChatBubble from './ChatBubble';
import { buildChatSystemPrompt } from '../prompts/chatSystemPrompt';

export default function AIChatBubbleHost(): JSX.Element | null {
  const location = useLocation();

  // /ai-chat 时由页面全屏展示，气泡隐藏
  if (location.pathname === '/ai-chat') return null;

  // SSR 安全
  if (typeof document === 'undefined') return null;

  const bubble = (
    <ChatBubble
      systemPromptProvider={(ctx) => buildChatSystemPrompt({ mode: ctx.mode ?? 'free' })}
      onChatPage={false}
    />
  );

  return createPortal(bubble, document.body);
}