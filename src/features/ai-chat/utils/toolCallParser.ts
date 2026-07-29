/**
 * Tool Call 解析器
 *
 * 从 AI 流式回复中提取 ```tool_call\n...\n``` 代码块，解析为 ToolCall 对象。
 * 容错 JSON.parse 失败（捕获到 parseErrors）。
 *
 * 来源：openspec/changes/ai-chat-intent-routing/design.md 决策 2。
 */

export interface ToolCall {
  tool: string;
  data: Record<string, unknown>;
}

export interface ParseResult {
  /** 去除 tool_call 块后的纯文本。 */
  textContent: string;
  /** 解析成功的工具调用。 */
  toolCalls: ToolCall[];
  /** 解析失败的代码块原文（用于 UI 兜底展示）。 */
  parseErrors: string[];
}

/**
 * 解析 AI 回复。
 * @param content AI 完整回复（流式 done 后调用）
 */
export function parseToolCalls(content: string): ParseResult {
  const toolCallRegex = /```tool_call\n([\s\S]*?)\n```/g;
  const toolCalls: ToolCall[] = [];
  const parseErrors: string[] = [];

  let match;
  while ((match = toolCallRegex.exec(content)) !== null) {
    const raw = match[1];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.tool === 'string') {
        toolCalls.push({
          tool: parsed.tool,
          data: parsed.data ?? {},
        });
      } else {
        parseErrors.push(raw);
      }
    } catch {
      parseErrors.push(raw);
    }
  }

  const textContent = content.replace(toolCallRegex, '').trim();
  return { textContent, toolCalls, parseErrors };
}