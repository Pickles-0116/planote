/**
 * countText - 字数 / 字符统计
 *
 * 与 Tiptap `editor.storage.characterCount` 行为对齐：
 * - words: trim 后按 `\s+` split 长度
 * - chars: 文本总长度（含空白）
 *
 * v1.0 不引 `@tiptap/extension-characterCount` 依赖（多 ~10KB）；
 * 自研 30 行可控；行为通过单元等价测试保证。
 */

import type { TiptapJSON } from '@/types/domain';
import { extractPlainText } from './extractPlainText';

/** 字数 / 字符统计结果。 */
export interface CountResult {
  words: number;
  chars: number;
}

/** 统计 Tiptap 文档的字数与字符数。 */
export function countText(doc: TiptapJSON | undefined): CountResult {
  const plain = extractPlainText(doc);
  const chars = plain.length;
  // 单词：trim 后按 \s+ 切分；空串则 0
  const trimmed = plain.trim();
  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
  return { words, chars };
}
