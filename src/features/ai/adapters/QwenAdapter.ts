/**
 * 通义千问 (Qwen / DashScope) 适配器
 *
 * 通义千问的 OpenAI 兼容模式 API 格式与 OpenAI 一致，
 * 仅基地址不同。因此复用 OpenAI 的 SSE 解析逻辑，
 * 但错误信息用 "Qwen" 标签重新包装。
 */

import type {
  AIProviderAdapter,
  ChatMessage,
  GenerateOptions,
  StreamUsage,
} from './AIProviderAdapter';
import { PROVIDER_BASE_URLS } from './AIProviderAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';

export class QwenAdapter implements AIProviderAdapter {
  readonly provider = 'qwen';

  private openai = new OpenAIAdapter();

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string, StreamUsage | void, unknown> {
    const effectiveBase = baseUrl || PROVIDER_BASE_URLS.qwen;
    try {
      return yield* this.openai.generateStream(messages, options, apiKey, effectiveBase);
    } catch (e) {
      // OpenAI adapter 错误信息以 "OpenAI API" 开头，翻译为 Qwen
      if (e instanceof Error && e.message.startsWith('OpenAI API')) {
        throw new Error(e.message.replace(/^OpenAI API/, 'Qwen API'));
      }
      throw e;
    }
  }

  async testConnection(
    apiKey: string,
    baseUrl?: string,
    model?: string,
  ): Promise<{ latencyMs: number }> {
    const effectiveBase = baseUrl || PROVIDER_BASE_URLS.qwen;
    try {
      return await this.openai.testConnection(apiKey, effectiveBase, model || 'qwen-turbo');
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('OpenAI API')) {
        throw new Error(e.message.replace(/^OpenAI API/, 'Qwen API'));
      }
      throw e;
    }
  }
}
