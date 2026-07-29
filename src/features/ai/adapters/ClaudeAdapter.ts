/**
 * Claude (Anthropic) 适配器
 *
 * Claude API 使用不同的请求格式和 SSE 事件类型。
 * 通过 x-api-key header 鉴权，请求体使用 messages 格式。
 */

import type {
  AIProviderAdapter,
  ChatMessage,
  GenerateOptions,
  StreamUsage,
} from './AIProviderAdapter';
import { PROVIDER_BASE_URLS } from './AIProviderAdapter';
import { formatAdapterError } from './errorFormat';

export class ClaudeAdapter implements AIProviderAdapter {
  readonly provider = 'claude';

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string, StreamUsage | void, unknown> {
    const url = `${baseUrl || PROVIDER_BASE_URLS.claude}/messages`;

    // Claude 格式：system 消息提取到顶层
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: options.model,
      messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
    };
    if (systemMsg) body.system = systemMsg.content;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        formatAdapterError('Claude', response.status, url, options.model, errText),
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let lastUsage: StreamUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta') {
              const text = json.delta?.text;
              if (text) yield text;
            } else if (json.type === 'message_delta') {
              const usage = json.usage;
              if (usage) {
                lastUsage = {
                  promptTokens: usage.input_tokens ?? 0,
                  completionTokens: usage.output_tokens ?? 0,
                };
              }
            }
          } catch {
            // skip malformed lines
          }
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
    const url = `${baseUrl || PROVIDER_BASE_URLS.claude}/messages`;
    const start = performance.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`连接失败 (${response.status}): ${errText || '请检查 API Key'}`);
    }

    return { latencyMs: Math.round(performance.now() - start) };
  }
}
