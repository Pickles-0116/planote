/**
 * OpenAI 适配器
 *
 * 使用 fetch + ReadableStream 实现流式读取。
 * 兼容 OpenAI API 格式（/v1/chat/completions）。
 */

import type {
  AIProviderAdapter,
  ChatMessage,
  GenerateOptions,
  StreamUsage,
} from './AIProviderAdapter';
import { PROVIDER_BASE_URLS } from './AIProviderAdapter';
import { formatAdapterError, explainFetchError } from './errorFormat';

/** 解析 SSE data 行。 */
function parseSSELine(line: string): { content?: string; usage?: StreamUsage; done?: boolean } {
  if (!line.startsWith('data: ')) return {};
  const data = line.slice(6).trim();
  if (data === '[DONE]') return { done: true };

  try {
    const json = JSON.parse(data);
    const content = json.choices?.[0]?.delta?.content ?? '';
    const usage = json.usage
      ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens }
      : undefined;
    return { content: content || undefined, usage };
  } catch {
    return {};
  }
}

export class OpenAIAdapter implements AIProviderAdapter {
  readonly provider = 'openai';

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string, StreamUsage | void, unknown> {
    const url = `${baseUrl || PROVIDER_BASE_URLS.openai}/chat/completions`;
    let lastUsage: StreamUsage | undefined;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: options.signal,
      });
    } catch (e) {
      // Failed to fetch / NetworkError / CORS 等
      throw new Error(
        explainFetchError(
          `OpenAI (url=${url}, model=${options.model})`,
          e,
        ),
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        formatAdapterError('OpenAI', response.status, url, options.model, errText),
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = parseSSELine(trimmed);
          if (parsed.done) return lastUsage;
          if (parsed.usage) lastUsage = parsed.usage;
          if (parsed.content) yield parsed.content;
        }
      }
    } finally {
      reader.releaseLock();
    }

    return lastUsage;
  }

  async testConnection(
    apiKey: string,
    baseUrl?: string,
    model?: string,
  ): Promise<{ latencyMs: number }> {
    const url = `${baseUrl || PROVIDER_BASE_URLS.openai}/chat/completions`;
    const start = performance.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        formatAdapterError('OpenAI', response.status, url, model || 'gpt-3.5-turbo', errText),
      );
    }

    return { latencyMs: Math.round(performance.now() - start) };
  }
}
