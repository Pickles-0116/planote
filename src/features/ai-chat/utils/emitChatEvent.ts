/**
 * emitChatEvent · 埋点 helper（v1.5-AI Chat）
 *
 * 来源：openspec/changes/ai-chat-telemetry-polish/design.md 决策 1。
 *
 * 用法：emitChatEvent('chat_send_message', { messageLength: 10, mode: 'free' })
 *
 * - dev 模式：console.log
 * - production：noop（未来可接 PostHog / 自建 analytics）
 */

export type ChatEventName =
  | 'chat_open'
  | 'chat_close'
  | 'chat_send_message'
  | 'chat_intent_detected'
  | 'chat_card_confirm'
  | 'chat_card_modify'
  | 'chat_card_cancel'
  | 'chat_mode_switch'
  | 'chat_stream_interrupt'
  | 'chat_session_create'
  | 'chat_session_switch'
  | 'chat_quick_action';

export interface ChatEventPayloadMap {
  chat_open: { source: 'bubble' | 'page' };
  chat_close: { messageCount: number };
  chat_send_message: { messageLength: number; mode: 'guided' | 'free' };
  chat_intent_detected: { intent: string };
  chat_card_confirm: { cardType: 'plan' | 'blog' | 'template' | 'query' | 'suggestion' };
  chat_card_modify: { cardType: string };
  chat_card_cancel: { cardType: string };
  chat_mode_switch: { from: 'guided' | 'free'; to: 'guided' | 'free' };
  chat_stream_interrupt: { durationMs: number; partialLength: number };
  chat_session_create: Record<string, never>;
  chat_session_switch: { messageCount: number };
  chat_quick_action: { action: string };
}

export type ChatEventPayload<E extends ChatEventName> = ChatEventPayloadMap[E];

const isDev = import.meta.env?.DEV ?? false;

export function emitChatEvent<E extends ChatEventName>(
  event: E,
  payload: ChatEventPayload<E>,
): void {
  if (!isDev) return; // production noop
  // 用 console.debug 避免 production 默认显示
  console.debug(`[chat-event] ${event}`, payload);
}