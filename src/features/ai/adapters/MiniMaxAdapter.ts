/**
 * MiniMax 适配器（A2 · 一等公民供应商）
 *
 * MiniMax 提供 OpenAI 兼容的 /v1/chat/completions 接口（2026-07-29 验证过的
 * 唯一浏览器可用路径），因此直接复用 OpenAIAdapter 的 SSE 解析逻辑，
 * 仅把默认 baseUrl 指到 `https://api.minimaxi.com/v1`，并把错误标签改写为 "MiniMax API"。
 *
 * 用户在设置页选 MiniMax 后无需手填 baseUrl 即可对话。
 */

import type {
  AIProviderAdapter,
  ChatMessage,
  GenerateOptions,
  StreamUsage,
} from './AIProviderAdapter';
import { PROVIDER_BASE_URLS } from './AIProviderAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';

export class MiniMaxAdapter implements AIProviderAdapter {
  readonly provider = 'minimax';

  private openai = new OpenAIAdapter();

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string, StreamUsage | void, unknown> {
    const effectiveBase = baseUrl || PROVIDER_BASE_URLS.minimax;
    try {
      return yield* this.openai.generateStream(messages, options, apiKey, effectiveBase);
    } catch (e) {
      // OpenAI adapter 错误信息以 "OpenAI API" 开头，翻译为 MiniMax
      if (e instanceof Error && e.message.startsWith('OpenAI API')) {
        throw new Error(e.message.replace(/^OpenAI API/, 'MiniMax API'));
      }
      throw e;
    }
  }

  async testConnection(
    apiKey: string,
    baseUrl?: string,
    model?: string,
  ): Promise<{ latencyMs: number }> {
    const effectiveBase = baseUrl || PROVIDER_BASE_URLS.minimax;
    try {
      return await this.openai.testConnection(apiKey, effectiveBase, model || 'MiniMax-Text-01');
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('OpenAI API')) {
        throw new Error(e.message.replace(/^OpenAI API/, 'MiniMax API'));
      }
      throw e;
    }
  }
}
