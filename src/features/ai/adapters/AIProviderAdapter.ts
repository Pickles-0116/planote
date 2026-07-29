/**
 * AI Provider 统一接口定义
 *
 * 所有 LLM 服务商（OpenAI / Claude / 通义千问 / 自定义）都实现此接口。
 * 对外暴露统一的 generateStream 和 testConnection 方法。
 */

/** 聊天消息角色。 */
export type ChatRole = 'system' | 'user' | 'assistant';

/** 聊天消息。 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** 生成选项。 */
export interface GenerateOptions {
  temperature: number;
  maxTokens: number;
  model: string;
  /** AbortSignal 用于取消生成。 */
  signal?: AbortSignal;
}

/** 流式生成的 usage 统计（部分服务商在最后一个 chunk 返回）。 */
export interface StreamUsage {
  promptTokens: number;
  completionTokens: number;
}

/** AI Provider 统一适配器接口。 */
export interface AIProviderAdapter {
  /** 服务商标识。 */
  readonly provider: string;

  /**
   * 流式生成文本内容。
   * @returns AsyncGenerator 逐 chunk 返回文本片段
   */
  generateStream(
    messages: ChatMessage[],
    options: GenerateOptions,
    apiKey: string,
    baseUrl?: string,
  ): AsyncGenerator<string, StreamUsage | void, unknown>;

  /**
   * 测试 API 连接。
   * @returns 成功返回 { latencyMs }，失败抛出 Error
   */
  testConnection(
    apiKey: string,
    baseUrl?: string,
    model?: string,
  ): Promise<{ latencyMs: number }>;
}

/**
 * 服务商 API 基地址常量。
 */
export const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
};

/**
 * 服务商推荐模型列表。
 */
export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  custom: [],
};
