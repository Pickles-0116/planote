/**
 * 适配器错误格式化工具
 *
 * 所有 4 个 Adapter（OpenAI / Claude / Qwen / Custom）在收到非 2xx 响应时
 * 抛 `formatAdapterError(providerLabel, status, url, model, body)`，让用户
 * 自查时直接看到 URL + model + status + body。
 *
 * 来源：openspec/changes/ai-config-improvements
 */

export function formatAdapterError(
  providerLabel: string,
  status: number,
  url: string,
  model: string,
  body: string,
): string {
  const safeBody = body && body.trim() ? body.trim() : 'No body';
  return `${providerLabel} API ${status} (url=${url}, model=${model}): ${safeBody}`;
}

/**
 * 识别常见网络/CORS 错误并提供 actionable 提示。
 * 来源：MiniMax 等聚合 API 没有 CORS 头，浏览器拦截。
 */
export function explainFetchError(providerLabel: string, error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('CORS')) {
    return (
      `${providerLabel} 请求被浏览器拦截（CORS）。` +
      `MiniMax / one-api 等聚合 API 通常没配 Access-Control-Allow-Origin 头。` +
      `解决方案：① 用 CORS 代理（如 Cloudflare Workers 中转）；② 在本地起一个 Node 代理；` +
      `③ 切换到有 CORS 的官方 API（OpenAI / Anthropic 官方）。`
    );
  }
  return msg;
}