/**
 * Mock AI Adapter · E2E 测试用
 *
 * 来源：openspec/changes/ai-chat-telemetry-polish/design.md 决策 3。
 *
 * 通过设置 window.__CHAT_TEST_REPLIES__ 在测试中预设回复。
 * 每次 generateStream 调用从数组头部取一个回复，按 chunk 切分后流式输出。
 */

import type { AIProviderAdapter, ChatMessage, GenerateOptions, StreamUsage } from '@/features/ai/adapters';

declare global {
  interface Window {
    __CHAT_TEST_REPLIES__?: string[];
  }
}

const DEFAULT_REPLIES: string[] = [
  '<intent>chat</intent>\n你好，我是 Planote AI 助手！',
  '<intent>create_plan</intent>\n好的，我来帮你创建计划：\n```tool_call\n{"tool":"create_plan","data":{"title":"Q3 OKR","level":"mid","timeDim":"monthly","items":[{"title":"完成 v1.5"},{"title":"用户增长 50%"}]}}\n```',
  '<intent>query</intent>\n让我查一下你的计划：\n```tool_call\n{"tool":"get_plans","data":{}}\n```',
];

export class MockAIAdapter implements AIProviderAdapter {
  readonly provider = 'mock';

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
  ): AsyncGenerator<string, StreamUsage | void, unknown> {
    void options;
    const replies =
      typeof window !== 'undefined' && window.__CHAT_TEST_REPLIES__
        ? window.__CHAT_TEST_REPLIES__
        : DEFAULT_REPLIES;

    const reply = replies.shift() ?? DEFAULT_REPLIES[0];
    const chunks = reply.match(/.{1, 5}/g) ?? [reply];
    for (const chunk of chunks) {
      // 模拟网络延迟
      await new Promise((r) => setTimeout(r, 10));
      yield chunk;
    }
    return { promptTokens: messages.length, completionTokens: reply.length };
  }

  async testConnection(): Promise<{ latencyMs: number }> {
    return { latencyMs: 10 };
  }
}

export const mockAdapter = new MockAIAdapter();