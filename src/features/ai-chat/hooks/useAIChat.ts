/**
 * useAIChat · AI 对话主 Hook
 *
 * 与 useAIGenerate 的区别（openspec/changes/ai-chat-core-ui/design.md 决策 1）：
 * - 维护 messages 数组 + 多轮
 * - 上下文窗口：最近 10 轮 + 早期摘要
 * - 与 System Prompt 绑定（按 ChatContext.mode 注入引导/自由指令段）
 * - 状态机包含 generating / done / error / cancelled + idle
 *
 * ai-chat-intent-routing 会扩展此 hook：流式完成后调 toolCallParser + toolCallMapper 挂 ActionCard。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAdapter } from '@/features/ai/adapters';
import type { ChatMessage as AIMessage } from '@/features/ai/adapters';
import { useAIModelStore } from '@/features/ai/stores/aiModelStore';
import { chatSessionRepo, aiCallLogRepo } from '@/db/repos';
import { newId } from '@/lib/id';
import { parseToolCalls } from '../utils/toolCallParser';
import { mapToolCallToActionCard } from '../utils/toolCallMapper';
import { classifyIntent } from '../utils/intentClassifier';
import { interceptDataQuery, formatQueryResultForLLM } from '../utils/queryInterceptor';
import { emitChatEvent } from '../utils/emitChatEvent';
import type { ChatSession, ChatMessage, ChatContext, ID, ChatMode, ActionCard } from '@/types/domain';

export type ChatStatus = 'idle' | 'generating' | 'done' | 'error' | 'cancelled';

export interface UseAIChatReturn {
  status: ChatStatus;
  messages: ChatMessage[];
  currentIntent: ChatContext['currentIntent'];
  activeSessionId: ID | null;
  mode: ChatMode;
  /** 当前会话绑定的模型 ID（null = 全局默认）。 */
  modelProfileId: ID | null;
  /** 所有可用模型配置。 */
  availableProfiles: Array<{ id: ID; name: string; provider: string; model: string }>;
  errorMessage: string | null;
  /** 发送消息（若 activeSessionId 为空会自动创建新会话）。 */
  send: (text: string) => Promise<void>;
  /** 中断当前生成。 */
  cancel: () => void;
  /** 切换到指定会话（加载 messages）。 */
  setSessionId: (id: ID | null) => Promise<void>;
  /** 创建新会话（保留旧 activeSessionId 不变）。 */
  createNewSession: () => Promise<ID>;
  /** 删除当前会话。 */
  deleteCurrentSession: () => Promise<void>;
  /** 设置当前会话绑定的 AI 模型（null = 用全局默认）。 */
  setModelProfileId: (id: ID | null) => Promise<void>;
  /** 切换模式（同时持久化到 ChatContext.mode）。 */
  setMode: (mode: ChatMode) => Promise<void>;
  /** 追加 assistant 消息（用于 handler 在创建成功后插入确认消息）。 */
  appendAssistantMessage: (text: string) => Promise<void>;
  /** 加载会话列表（供 ChatSessionList 使用）。 */
  refreshSessions: () => Promise<ChatSession[]>;
  /** 当前所有会话（缓存）。 */
  sessions: ChatSession[];
}

const CONTEXT_WINDOW_ROUNDS = 10;

/** 构造发送到 LLM 的 messages 数组：system + 最近 N 轮 + 早期摘要。 */
function buildLlmMessages(
  session: ChatSession,
  systemPrompt: string,
): AIMessage[] {
  const all = session.messages;
  // 收集 user/assistant 轮次（排除 system）
  const turns: ChatMessage[] = all.filter((m) => m.role !== 'system');

  const tail = turns.slice(-CONTEXT_WINDOW_ROUNDS);
  const headCount = turns.length - tail.length;

  const result: AIMessage[] = [{ role: 'system', content: systemPrompt }];
  if (headCount > 0) {
    const headTitles = turns
      .slice(0, headCount)
      .filter((m) => m.role === 'user')
      .slice(0, 5)
      .map((m) => m.content.slice(0, 30))
      .join(' | ');
    result.push({
      role: 'system',
      content: `[早期对话摘要 - 共 ${headCount} 轮] 用户的早期问题：${headTitles} ...`,
    });
  }
  for (const m of tail) {
    result.push({ role: m.role, content: m.content });
  }
  return result;
}

export function useAIChat(systemPromptProvider: (ctx: ChatContext) => string): UseAIChatReturn {
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [activeSessionId, setActiveSessionId] = useState<ID | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentIntent, setCurrentIntent] = useState<ChatContext['currentIntent']>(undefined);
  const [mode, setModeState] = useState<ChatMode>('free');
  const [modelProfileId, setModelProfileIdState] = useState<ID | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const store = useAIModelStore();

  /** 当前会话实际使用的 profile（per-session 覆盖 > 全局默认）。 */
  const resolveActiveProfile = useCallback(() => {
    if (modelProfileId) {
      const explicit = store.getProfile(modelProfileId);
      if (explicit) return explicit;
    }
    return store.getDefaultProfile();
  }, [modelProfileId, store]);

  const refreshSessions = useCallback(async () => {
    const list = await chatSessionRepo.list();
    setSessions(list);
    return list;
  }, []);

  const setSessionId = useCallback(
    async (id: ID | null) => {
      setActiveSessionId(id);
      if (id) {
        emitChatEvent('chat_session_switch', {
          messageCount: (await chatSessionRepo.get(id))?.messages.length ?? 0,
        });
      }
      if (id === null) {
        setMessages([]);
        setCurrentIntent(undefined);
        setModeState('free');
        setModelProfileIdState(null);
        return;
      }
      const session = await chatSessionRepo.get(id);
      if (session) {
        setMessages(session.messages);
        setCurrentIntent(session.context.currentIntent);
        setModeState(session.context.mode ?? 'free');
        setModelProfileIdState(session.modelProfileId ?? null);
        setErrorMessage(null);
      }
    },
    [],
  );

  /** 切换当前会话绑定的 AI 模型（持久化到 session）。 */
  const setModelProfileId = useCallback(
    async (id: ID | null) => {
      setModelProfileIdState(id);
      if (!activeSessionId) return;
      await chatSessionRepo.update(activeSessionId, { modelProfileId: id ?? undefined });
    },
    [activeSessionId],
  );

  const createNewSession = useCallback(async (): Promise<ID> => {
    const created = await chatSessionRepo.create({
      title: '新对话',
      messages: [],
      context: { mode: 'free' },
    });
    emitChatEvent('chat_session_create', {});
    await refreshSessions();
    await setSessionId(created.id);
    return created.id;
  }, [refreshSessions, setSessionId]);

  const deleteCurrentSession = useCallback(async () => {
    if (!activeSessionId) return;
    await chatSessionRepo.delete(activeSessionId);
    setActiveSessionId(null);
    setMessages([]);
    setCurrentIntent(undefined);
    await refreshSessions();
  }, [activeSessionId, refreshSessions]);

  const setMode = useCallback(
    async (newMode: ChatMode) => {
      const prev = mode;
      setModeState(newMode);
      emitChatEvent('chat_mode_switch', { from: prev, to: newMode });
      if (!activeSessionId) return;
      await chatSessionRepo.updateContext(activeSessionId, { mode: newMode });
    },
    [activeSessionId, mode],
  );

  /** 追加 assistant 消息（handler 用）。 */
  const appendAssistantMessage = useCallback(
    async (text: string) => {
      if (!activeSessionId) return;
      const msg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
      };
      const updated = await chatSessionRepo.appendMessage(activeSessionId, msg);
      setMessages(updated.messages);
    },
    [activeSessionId],
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // 埋点：chat_send_message
      emitChatEvent('chat_send_message', {
        messageLength: text.length,
        mode: (await chatSessionRepo.get(activeSessionId ?? ''))?.context.mode ?? 'free',
      });

      const profile = resolveActiveProfile();
      if (!profile) {
        setStatus('error');
        setErrorMessage('请先在设置中配置 AI 模型');
        return;
      }

      // 懒创建会话
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await chatSessionRepo.create({
          title: text.slice(0, 30).trim() || '新对话',
          messages: [],
          context: { mode: 'free' },
        });
        sessionId = created.id;
        setActiveSessionId(sessionId);
        await refreshSessions();
      }

      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        status: 'sent',
      };
      await chatSessionRepo.appendMessage(sessionId, userMsg);
      setMessages((prev) => [...prev, userMsg]);

      // 更新会话标题（首次）
      const session = await chatSessionRepo.get(sessionId);
      if (session && session.title === '新对话' && session.messages.length === 1) {
        await chatSessionRepo.update(sessionId, { title: text.slice(0, 30).trim() });
      }

      // 流式生成
      const apiKey = store.getDecodedApiKey(profile.id);
      const adapter = getAdapter(profile.provider);
      const controller = new AbortController();
      abortRef.current = controller;

      const sysPrompt = systemPromptProvider(session?.context ?? { mode: 'free' });
      const llmMessages = buildLlmMessages(
        { ...(session as ChatSession), messages: [...(session?.messages ?? []), userMsg] },
        sysPrompt,
      );

      setStatus('generating');
      setErrorMessage(null);

      // 创建空的 assistant 消息占位
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      await chatSessionRepo.appendMessage(sessionId, assistantMsg);
      setMessages((prev) => [...prev, assistantMsg]);

      const startTime = performance.now();
      let accumulated = '';
      let finalUsage: { promptTokens: number; completionTokens: number } | undefined;

      try {
        const stream = adapter.generateStream(
          llmMessages,
          {
            temperature: profile.temperature,
            maxTokens: profile.maxTokens,
            model: profile.model,
            signal: controller.signal,
          },
          apiKey,
          profile.baseUrl,
        );

        while (true) {
          const result = await stream.next();
          if (result.done) {
            if (result.value && typeof result.value === 'object' && 'promptTokens' in result.value) {
              finalUsage = result.value;
            }
            break;
          }
          if (typeof result.value === 'string') {
            accumulated += result.value;
            // 节流：每攒够一个 chunk 或 200ms 才写一次
            const updated = { ...assistantMsg, content: accumulated };
            // 直接更新内存（不每次写 IndexedDB，太慢）；最后 done 时一次性 put
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? updated : m)),
            );
          }
        }

        // 最终持久化（含 Tool Call 解析 → ActionCard）
        const parsed = parseToolCalls(accumulated);
        const intent = classifyIntent(accumulated, text);
        setCurrentIntent(intent);
        emitChatEvent('chat_intent_detected', { intent });

        // 把当前会话的 intent 写回
        await chatSessionRepo.updateContext(sessionId, { currentIntent: intent });

        // 取第一个有效的 tool call → ActionCard
        let actionCard: ActionCard | undefined;
        if (parsed.toolCalls.length > 0) {
          actionCard = mapToolCallToActionCard(parsed.toolCalls[0]);
        } else if (parsed.parseErrors.length > 0) {
          actionCard = { type: 'unknown', rawTool: '(parse error)', rawData: parsed.parseErrors[0] };
        }

        const finalAssistant: ChatMessage = {
          ...assistantMsg,
          content: parsed.textContent || accumulated,
          actionCard,
        };
        await chatSessionRepo.update(sessionId, {
          messages: [
            ...((await chatSessionRepo.get(sessionId))?.messages.filter(
              (m) => m.id !== assistantMsg.id,
            ) ?? []),
            finalAssistant,
          ],
        });
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? finalAssistant : m)));

        const elapsed = Math.round(performance.now() - startTime);
        setStatus('done');
        aiCallLogRepo.create({
          modelProfileId: profile.id,
          mode: 'chat',
          promptTokens: finalUsage?.promptTokens ?? 0,
          completionTokens: finalUsage?.completionTokens ?? 0,
          durationMs: elapsed,
          success: true,
        });
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus('cancelled');
          emitChatEvent('chat_stream_interrupt', {
            durationMs: elapsed,
            partialLength: accumulated.length,
          });
          aiCallLogRepo.create({
            modelProfileId: profile.id,
            mode: 'chat',
            promptTokens: 0,
            completionTokens: 0,
            durationMs: elapsed,
            success: false,
            errorCode: 'CANCELLED',
          });
          return;
        }
        const msg = err instanceof Error ? err.message : '生成失败，请重试';
        setStatus('error');
        setErrorMessage(msg);
        aiCallLogRepo.create({
          modelProfileId: profile.id,
          mode: 'chat',
          promptTokens: 0,
          completionTokens: 0,
          durationMs: elapsed,
          success: false,
          errorCode: 'API_ERROR',
        });
      } finally {
        abortRef.current = null;
      }
    },
    [store, activeSessionId, systemPromptProvider, refreshSessions, resolveActiveProfile],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 初次挂载加载会话列表
  useEffect(() => {
    refreshSessions().catch(console.error);
  }, [refreshSessions]);

  // 拦截 data_query actionCard
  // - 注入 system message（参与下一轮 LLM 调用）
  // - UI 渲染交给 DataQueryCard 内部 useEffect 自己 fetch（更解耦）
  const lastProcessedCardRef = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || !last.actionCard) return;
    const card = last.actionCard;
    const cardKey = `${last.id}:${card.type}`;

    if (lastProcessedCardRef.current === cardKey) return;

    if (card.type === 'data_query') {
      lastProcessedCardRef.current = cardKey;
      (async () => {
        try {
          const result = await interceptDataQuery(card.tool, card.filter);
          if (activeSessionId) {
            const sysMsg: ChatMessage = {
              id: newId(),
              role: 'system',
              content: formatQueryResultForLLM(result),
              timestamp: Date.now(),
            };
            const updated = await chatSessionRepo.appendMessage(activeSessionId, sysMsg);
            setMessages(updated.messages);
          }
        } catch (e) {
          console.error('[data_query interception]', e);
        }
      })();
    }
  }, [messages, activeSessionId]);

  return {
    status,
    messages,
    currentIntent,
    activeSessionId,
    mode,
    modelProfileId,
    availableProfiles: store.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      model: p.model,
    })),
    errorMessage,
    send,
    cancel,
    setSessionId,
    createNewSession,
    deleteCurrentSession,
    setMode,
    setModelProfileId,
    appendAssistantMessage,
    refreshSessions,
    sessions,
  };
}