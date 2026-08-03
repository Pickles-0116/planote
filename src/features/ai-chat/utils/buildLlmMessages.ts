/**
 * buildLlmMessages · 构造发送给 LLM 的 messages 数组
 *
 * 从 ChatSession.messages 中裁剪出参与本轮对话的上下文：
 * - 系统提示（systemPrompt）始终作为第一条
 * - 最近 N 轮 user/assistant 进入尾部；更早的轮次折叠为「早期对话摘要」system 消息
 * - D2：保留 queryInterceptor 注入的「数据查询结果」system 消息（content 以 "[数据查询结果" 开头），
 *   使 AI 能读到本地博客/计划数据；其余 system 消息（系统提示、早期摘要）不重复进入。
 * - 技能引用：保留 @skill 注入的「技能引用」system 消息（content 以 "[技能引用：" 开头），
 *   使 AI 后续对话能按被引用技能的 prompt 模板执行。
 *
 * 抽离为纯函数以便单测回归（见 buildLlmMessages.test.ts）。
 */

import type { ChatSession, ChatMessage } from '@/types/domain';
import type { ChatMessage as AIMessage } from '@/features/ai/adapters';

/** 上下文窗口：最近保留的轮数。 */
export const CONTEXT_WINDOW_ROUNDS = 10;

/** 数据查询注入消息的标记前缀（queryInterceptor.formatQueryResultForLLM 产出），D2 依赖此契约。 */
export const DATA_QUERY_PREFIX = '[数据查询结果';

/** 技能引用注入消息的标记前缀（@skill 命令产出，content 形如 `[技能引用：xxx]\n...`）。 */
export const SKILL_REFERENCE_PREFIX = '[技能引用：';

/** 判断一条消息是否为本地数据查询注入结果（需保留进 LLM 上下文）。 */
export function isDataQueryMessage(m: ChatMessage): boolean {
  return m.role === 'system' && m.content.startsWith(DATA_QUERY_PREFIX);
}

/** 判断一条消息是否为 @skill 注入的技能引用（需保留进 LLM 上下文）。 */
export function isSkillReferenceMessage(m: ChatMessage): boolean {
  return m.role === 'system' && m.content.startsWith(SKILL_REFERENCE_PREFIX);
}

/**
 * 构造发送到 LLM 的 messages 数组：system + 最近 N 轮 + 早期摘要。
 */
export function buildLlmMessages(session: ChatSession, systemPrompt: string): AIMessage[] {
  const all = session.messages;
  // D2：保留数据查询注入的 system 消息，其余 system 消息排除（系统提示在 result[0] 单独注入）
  const turns: ChatMessage[] = all.filter((m) => {
    if (isDataQueryMessage(m)) return true;
    if (isSkillReferenceMessage(m)) return true;
    return m.role !== 'system';
  });

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
