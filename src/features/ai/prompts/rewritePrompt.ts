/**
 * 段落重写 Prompt 模板 v1.0
 *
 * 用户选中一段文字，AI 仅重新生成该段落。
 */

export interface RewriteInput {
  /** 选中的原始段落文本。 */
  selectedText: string;
  /** 用户可选的补充指令（如"更简洁一些"）。 */
  instruction?: string;
  /** 上下文（选中段落前后的文本，帮助 AI 理解语境）。 */
  contextBefore?: string;
  contextAfter?: string;
}

export function buildRewritePrompt(input: RewriteInput) {
  const instructionHint = input.instruction
    ? `\n- 额外要求：${input.instruction}`
    : '';

  const contextText = [
    input.contextBefore ? `## 上文\n${input.contextBefore.slice(-500)}` : '',
    input.contextAfter ? `## 下文\n${input.contextAfter.slice(0, 500)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const system = `你是一位博客编辑。请重新改写用户选中的段落。

## 要求
- 保持原段落的核心意思不变
- 先理解原段落的核心意思，然后用更好的方式重新表达${instructionHint}
- 保持与上下文的连贯性
- 不要编造新的信息

## 输出格式
- 直接输出改写后的文本，不要加 Markdown 标记
- 不要输出解释说明`;

  const user = `${contextText ? `${contextText}\n\n` : ''}## 需要改写的段落
${input.selectedText}

请改写以上段落：`;

  return { system, user };
}
