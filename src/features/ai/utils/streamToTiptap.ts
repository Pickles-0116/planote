/**
 * streamToTiptap · 流式 Markdown → TiptapJSON 增量转换
 *
 * AI 输出的 Markdown 流式文本片段被累积后，
 * 周期性地通过 markdownToTiptapJSON 全量转换并更新到编辑器。
 *
 * 设计选择：
 * - v1.3 使用"累积 + 全量转换"策略（简单可靠）
 * - v1.4 可优化为增量 diff 策略减少重渲染
 */

import { markdownToTiptapJSON } from '@/features/blog/utils/markdownToTiptap';
import type { TiptapJSON } from '@/types/domain';

/** 从 Markdown 字符串提取标题（首个 H1）。 */
export function extractTitleFromMarkdown(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? '';
}

/** 从 Markdown 提取摘要（首段，最多 120 字）。 */
export function extractExcerptFromMarkdown(md: string, max = 120): string {
  const lines = md.split('\n');
  const para: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (para.length > 0) break;
      continue;
    }
    if (t.startsWith('#')) continue;
    para.push(t);
    if (para.join(' ').length >= max) break;
  }
  const text = para.join(' ').replace(/[#*`>]/g, '').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * 将完整的 Markdown 文本转换为 TiptapJSON。
 * 用于流式生成完成后的最终转换。
 */
export function markdownStreamToTiptap(markdown: string): TiptapJSON {
  return markdownToTiptapJSON(markdown);
}

/**
 * 提取 TiptapJSON 的纯文本内容。
 */
export function extractPlainText(doc: TiptapJSON): string {
  const parts: string[] = [];
  const walk = (node: { text?: string; content?: unknown[] }): void => {
    if (typeof node.text === 'string') parts.push(node.text);
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child as { text?: string; content?: unknown[] });
    }
  };
  walk(doc);
  return parts.join(' ').trim();
}
