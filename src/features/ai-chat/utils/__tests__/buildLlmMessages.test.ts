import { describe, it, expect } from 'vitest';
import {
  buildLlmMessages,
  isDataQueryMessage,
  isSkillReferenceMessage,
  DATA_QUERY_PREFIX,
  SKILL_REFERENCE_PREFIX,
} from '../buildLlmMessages';
import type { ChatMessage, ChatSession } from '@/types/domain';

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, 'role' | 'content'>): ChatMessage {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: 0,
    ...partial,
  } as ChatMessage;
}

function session(messages: ChatMessage[]): ChatSession {
  return {
    id: 's1',
    title: 't',
    messages,
    context: {},
    createdAt: '2026-07-29T00:00:00Z',
    updatedAt: '2026-07-29T00:00:00Z',
  };
}

describe('buildLlmMessages', () => {
  it('D2：保留 [数据查询结果] system 消息进入 LLM 上下文', () => {
    const s = session([
      msg({ role: 'user', content: '我 leetcode 文件夹有几篇' }),
      msg({ role: 'assistant', content: '我来查一下' }),
      msg({ role: 'system', content: `${DATA_QUERY_PREFIX} - get_blogs]\n[{"title":"a"}]` }),
    ]);
    const out = buildLlmMessages(s, 'SYS_PROMPT');
    const systemBodies = out.filter((m) => m.role === 'system').map((m) => m.content);
    expect(systemBodies).toContain(`${DATA_QUERY_PREFIX} - get_blogs]\n[{"title":"a"}]`);
  });

  it('D2：过滤掉非数据查询的 system 消息（早期摘要由函数单独生成）', () => {
    const s = session([
      msg({ role: 'system', content: '某早期摘要 system 不应出现' }),
      msg({ role: 'user', content: '你好' }),
      msg({ role: 'assistant', content: '你好！' }),
    ]);
    const out = buildLlmMessages(s, 'SYS_PROMPT');
    expect(out.some((m) => m.content === '某早期摘要 system 不应出现')).toBe(false);
    // 系统提示始终在首条
    expect(out[0]).toEqual({ role: 'system', content: 'SYS_PROMPT' });
  });

  it('isDataQueryMessage 仅匹配带前缀的 system 消息', () => {
    expect(isDataQueryMessage(msg({ role: 'system', content: `${DATA_QUERY_PREFIX} - get_stats]` }))).toBe(true);
    expect(isDataQueryMessage(msg({ role: 'system', content: '普通 system' }))).toBe(false);
    expect(isDataQueryMessage(msg({ role: 'user', content: `${DATA_QUERY_PREFIX} x` }))).toBe(false);
  });

  it('保留 [技能引用：] system 消息进入 LLM 上下文', () => {
    const s = session([
      msg({ role: 'user', content: '用月报技能写一下' }),
      msg({ role: 'system', content: `${SKILL_REFERENCE_PREFIX}月报]\n请按模板输出本月总结` }),
    ]);
    const out = buildLlmMessages(s, 'SYS_PROMPT');
    const systemBodies = out.filter((m) => m.role === 'system').map((m) => m.content);
    expect(systemBodies).toContain(`${SKILL_REFERENCE_PREFIX}月报]\n请按模板输出本月总结`);
  });

  it('isSkillReferenceMessage 仅匹配带前缀的 system 消息', () => {
    expect(isSkillReferenceMessage(msg({ role: 'system', content: `${SKILL_REFERENCE_PREFIX}月报]` }))).toBe(true);
    expect(isSkillReferenceMessage(msg({ role: 'system', content: '普通 system' }))).toBe(false);
    expect(isSkillReferenceMessage(msg({ role: 'user', content: `${SKILL_REFERENCE_PREFIX}月报]` }))).toBe(false);
  });
});
