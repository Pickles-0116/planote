/**
 * Tiptap JSON → Markdown / HTML 转换（导出中心用）
 *
 * 仅覆盖博客正文常见节点：doc / heading / paragraph / bulletList / orderedList /
 * listItem / blockquote / codeBlock / text（含 bold/italic/code/strike 标记）。
 * 其它未知节点降级为纯文本拼接，保证导出不崩。
 */

import type { TiptapNode } from '@/types/domain';

interface Marked {
  text?: string;
  marks?: Array<{ type: string; [k: string]: unknown }>;
}

function renderMarks(text: string, marks?: Array<{ type: string }>): string {
  let out = text;
  const types = (marks ?? []).map((m) => m.type);
  if (types.includes('strike')) out = `~~${out}~~`;
  if (types.includes('code')) out = `\`${out}\``;
  if (types.includes('bold')) out = `**${out}**`;
  if (types.includes('italic')) out = `_${out}_`;
  return out;
}

function inlineToMarkdown(node: TiptapNode): string {
  if (node.type === 'text') {
    const t = node as TiptapNode & Marked;
    return renderMarks(t.text ?? '', t.marks as Array<{ type: string }> | undefined);
  }
  if (node.content) return node.content.map(inlineToMarkdown).join('');
  return '';
}

function inlineToHtml(node: TiptapNode): string {
  if (node.type === 'text') {
    const t = node as TiptapNode & Marked;
    let out = (t.text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const types = (t.marks ?? []).map((m: { type: string }) => m.type);
    if (types.includes('strike')) out = `<s>${out}</s>`;
    if (types.includes('code')) out = `<code>${out}</code>`;
    if (types.includes('bold')) out = `<strong>${out}</strong>`;
    if (types.includes('italic')) out = `<em>${out}</em>`;
    return out;
  }
  if (node.content) return node.content.map(inlineToHtml).join('');
  return '';
}

function blockToMarkdown(node: TiptapNode, depth = 0): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 2;
      return `${'#'.repeat(level)} ${inlineToMarkdown(node)}\n\n`;
    }
    case 'paragraph':
      return `${inlineToMarkdown(node)}\n\n`;
    case 'codeBlock': {
      const code = inlineToMarkdown(node).replace(/\n+$/, '');
      return `\`\`\`\n${code}\n\`\`\`\n\n`;
    }
    case 'blockquote':
      return `${inlineToMarkdown(node).split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
    case 'bulletList':
      return `${(node.content ?? []).map((li) => `- ${inlineToMarkdown(li).trim()}`).join('\n')}\n\n`;
    case 'orderedList':
      return `${(node.content ?? []).map((li, i) => `${i + 1}. ${inlineToMarkdown(li).trim()}`).join('\n')}\n\n`;
    default:
      return node.content ? node.content.map((c) => blockToMarkdown(c, depth)).join('') : '';
  }
}

function blockToHtml(node: TiptapNode): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 2;
      return `<h${level}>${inlineToHtml(node)}</h${level}>`;
    }
    case 'paragraph':
      return `<p>${inlineToHtml(node)}</p>`;
    case 'codeBlock':
      return `<pre><code>${inlineToHtml(node)}</code></pre>`;
    case 'blockquote':
      return `<blockquote>${inlineToHtml(node)}</blockquote>`;
    case 'bulletList':
      return `<ul>${(node.content ?? []).map((li) => `<li>${inlineToHtml(li)}</li>`).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content ?? []).map((li) => `<li>${inlineToHtml(li)}</li>`).join('')}</ol>`;
    default:
      return node.content ? node.content.map(blockToHtml).join('') : '';
  }
}

export function tiptapToMarkdown(doc: TiptapNode): string {
  if (!doc?.content) return '';
  return doc.content.map((n) => blockToMarkdown(n)).join('').trim() + '\n';
}

export function tiptapToHtml(doc: TiptapNode): string {
  if (!doc?.content) return '';
  return doc.content.map(blockToHtml).join('');
}

/** 文件名安全化（去掉非法字符）。 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'untitled';
}
