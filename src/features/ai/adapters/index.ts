/**
 * AI Provider 适配器工厂
 *
 * 根据 provider 类型返回对应的适配器实例。
 */

import type { AIProviderAdapter } from './AIProviderAdapter';
import type { AIProvider } from '@/types/domain';
import { OpenAIAdapter } from './OpenAIAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';
import { QwenAdapter } from './QwenAdapter';
import { CustomAdapter } from './CustomAdapter';

/** 单例缓存（避免重复构造）。 */
const cache = new Map<string, AIProviderAdapter>();

/** 获取指定服务商的适配器实例。 */
export function getAdapter(provider: AIProvider): AIProviderAdapter {
  let adapter = cache.get(provider);
  if (!adapter) {
    switch (provider) {
      case 'openai':
        adapter = new OpenAIAdapter();
        break;
      case 'claude':
        adapter = new ClaudeAdapter();
        break;
      case 'qwen':
        adapter = new QwenAdapter();
        break;
      case 'custom':
        adapter = new CustomAdapter();
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    cache.set(provider, adapter);
  }
  return adapter;
}

export { PROVIDER_BASE_URLS, PROVIDER_MODELS } from './AIProviderAdapter';
export type {
  AIProviderAdapter,
  ChatMessage,
  ChatRole,
  GenerateOptions,
  StreamUsage,
} from './AIProviderAdapter';
