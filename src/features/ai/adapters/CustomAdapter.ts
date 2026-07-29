/**
 * 自定义 OpenAI 兼容适配器
 *
 * 用于本地模型（Ollama 等）或第三方 OpenAI 兼容代理。
 * 请求格式与 OpenAI 完全一致，仅 Base URL 不同。
 * 错误信息以 "Custom" 标签包装（不复用 "OpenAI" 标签）。
 */

import type {
  AIProviderAdapter,
  ChatMessage,
  GenerateOptions,
  StreamUsage,
} from './AIProviderAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';

export class CustomAdapter implements AIProviderAdapter {
  readonly provider = 'custom';

  private openai = new OpenAIAdapter();

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string, StreamUsage | void, unknown> {
    if (!baseUrl) throw new Error('自定义服务商必须提供 Base URL');
    try {
      return yield* this.openai.generateStream(messages, options, apiKey, baseUrl);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('OpenAI API')) {
        throw new Error(e.message.replace(/^OpenAI API/, 'Custom API'));
      }
      throw e;
    }
  }

  async testConnection(
    apiKey: string,
    baseUrl?: string,
    model?: string,
  ): Promise<{ latencyMs: number }> {
    if (!baseUrl) throw new Error('自定义服务商必须提供 Base URL');
    try {
      return await this.openai.testConnection(apiKey, baseUrl, model);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('OpenAI API')) {
        throw new Error(e.message.replace(/^OpenAI API/, 'Custom API'));
      }
      throw e;
    }
  }
}
