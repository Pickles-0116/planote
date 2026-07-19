/**
 * extractPlainText - TiptapJSON → 纯文本
 *
 * DFS 遍历所有 text 节点，段落间用 `\n` 分隔。供：
 * - `Blog.contentText` 字段（全文检索 / 摘要）
 * - `Blog.excerpt`（首段前 100 字符）
 * - 旧数据迁移
 *
 * 不依赖 Tiptap 运行时（仅依赖类型定义），可独立单测。
 */

import type { TiptapJSON, TiptapNode } from '@/types/domain';

/** 单个 text 节点。 */
interface TextNode {
  text?: string;
  type?: string;
  content?: unknown[];
}

/** 节点是否含 text 字段（Tiptap 文本节点）。 */
const isTextNode = (n: unknown): n is TextNode =>
  typeof n === 'object' && n !== null && 'text' in (n as object);

/** 递归收集所有 text 节点文本。 */
const collectTexts = (node: TiptapNode | undefined, acc: string[]): void => {
  if (!node) return;
  // 当前节点是 text node
  if (isTextNode(node) && typeof node.text === 'string') {
    acc.push(node.text);
    return;
  }
  // 递归子节点
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectTexts(child, acc);
    }
  }
};

/** 把 Tiptap 文档转成纯文本。段落间以 `\n` 分隔。 */
export function extractPlainText(doc: TiptapJSON | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  const lines: string[] = [];
  for (const block of doc.content) {
    const buf: string[] = [];
    collectTexts(block, buf);
    lines.push(buf.join(''));
  }
  return lines.join('\n').trim();
}
