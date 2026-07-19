/**
 * Planote · 编辑器类型定义
 *
 * Tiptap JSON 结构化定义。`TiptapJSON` 是存储格式（`Blog.content`），
 * 详尽节点类型支持工具栏 / 框架应用 / 字数统计等逻辑做类型守卫。
 *
 * 与 `domain.ts` 中的 `TiptapJSON` / `TiptapNode` 保持兼容（基础类型用同一字段名），
 * 详细类型在本文件补全。所有 Tiptap 文档流转都基于本文件类型。
 */

import type { TiptapJSON, TiptapNode } from './domain';

// re-export 基础类型，组件统一从本文件导入
export type { TiptapJSON, TiptapNode };

/** 段落节点。 */
export interface TiptapParagraph {
  type: 'paragraph';
  content?: TiptapInlineNode[];
}

/** 标题节点（level 1-3）。 */
export interface TiptapHeading {
  type: 'heading';
  attrs: { level: 1 | 2 | 3 };
  content?: TiptapInlineNode[];
}

/** bulletList / orderedList / blockquote / codeBlock / listItem 容器节点。 */
export interface TiptapContainerNode {
  type: 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock' | 'listItem';
  content?: TiptapNode[];
}

/** 内联节点（text / hardBreak）。 */
export type TiptapInlineNode =
  | { type: 'text'; text: string; marks?: TiptapMark[] }
  | { type: 'hardBreak' };

/** 文本 mark。 */
export type TiptapMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'link'; attrs: { href: string } };

/** 编辑器生命周期状态（供 useAutoSave 上报父组件）。 */
export type SaveStatus = 'idle' | 'saving' | 'saved';

/** 字数统计。 */
export interface CharCount {
  words: number;
  chars: number;
}
