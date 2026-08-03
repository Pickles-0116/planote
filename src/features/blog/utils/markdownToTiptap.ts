/**
 * markdownToTiptap · v1.1 增量
 *
 * 把 Markdown 字符串转为 Tiptap JSON（存到 Blog.content）。
 *
 * 流程：
 *   1. marked.parse(md) → HTML
 *   2. generateJSON(html, [...extensions]) → TiptapJSON
 *
 * 依赖：marked（解析） + @tiptap/html（HTML→JSON 转换）
 * 与 v1.0 RichEditor 使用同一组 extensions，确保双向一致。
 */

import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import type { TiptapJSON } from '@/types/editor';

/** 与 RichEditor.tsx 保持一致的 extensions（避免解析后编辑器渲染差异）。 */
const EXTENSIONS = [
  StarterKit,
  Link.configure({ openOnClick: false, autolink: true }),
  Image,
];

/**
 * 把 Markdown 字符串转成 TiptapJSON。
 *
 * - gfm: true  → 支持删除线、表格（基础）
 * - breaks: true → 单换行 → <br>（更符合日常笔记习惯）
 * - async: false → 同步解析
 */
export function markdownToTiptapJSON(markdown: string): TiptapJSON {
  const html = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;
  return generateJSON(html, EXTENSIONS) as TiptapJSON;
}

/**
 * 从 Markdown 提取标题：
 * 1) 首个 H1（`# xxx`）
 * 2) 否则文件名（去扩展名）
 */
export function extractTitle(markdown: string, filename: string): string {
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match && h1Match[1]) {
    return h1Match[1].trim().slice(0, 200);
  }
  return filename.replace(/\.(md|markdown|txt)$/i, '').slice(0, 200);
}

/**
 * 提取 Markdown 第一段作为 excerpt（最多 120 字）。
 * 跳过空行和标题行，取首个段落。
 */
export function extractExcerpt(markdown: string, max = 120): string {
  const lines = markdown.split('\n');
  const paragraphLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (paragraphLines.length > 0) break;
      continue;
    }
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // 列表也作为 excerpt 的一部分
      paragraphLines.push(trimmed);
      if (paragraphLines.join(' ').length >= max) break;
      continue;
    }
    paragraphLines.push(trimmed);
    if (paragraphLines.join(' ').length >= max) break;
  }
  const text = paragraphLines.join(' ').replace(/[#*`>]/g, '').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
