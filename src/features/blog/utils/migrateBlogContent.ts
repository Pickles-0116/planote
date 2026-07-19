/**
 * migrateBlogContent - 旧版 Blog.content 数据迁移
 *
 * 历史背景（v1.0 Sprint 2 之前）：
 * - 旧 Blog.content 是字符串（Markdown 或纯文本）
 * - 新版 Blog.content 升级为 TiptapJSON（结构化 JSON）
 *
 * 迁移策略（兼容三态）：
 * 1. `undefined` / `null` / `''` → 空 doc
 * 2. 以 `{` 开头 → 尝试 JSON.parse；失败回退到纯文本包装
 * 3. 其他 → 按 `\n` 拆段，每行一个 paragraph
 *
 * 幂等：再次调用不重复包裹（已是合法 doc 保持原样）。
 */

import type { TiptapJSON } from '@/types/domain';

/** 空 doc 常量（避免每次分配新对象，保持引用稳定）。 */
const EMPTY_DOC: TiptapJSON = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/** 字符串包装为 paragraph。 */
const wrapLine = (line: string): TiptapJSON['content'][number] =>
  line === ''
    ? { type: 'paragraph' }
    : {
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      };

/** 验证 parsed JSON 是否具备 Tiptap doc 最少结构。 */
const isValidDoc = (v: unknown): v is TiptapJSON =>
  typeof v === 'object' &&
  v !== null &&
  (v as { type?: string }).type === 'doc' &&
  Array.isArray((v as { content?: unknown }).content);

/** 把任意 raw 字符串升级为 TiptapJSON。 */
export function migrateBlogContent(
  raw: string | undefined | null,
): TiptapJSON {
  // 1) 空值 → 空 doc
  if (raw === undefined || raw === null || raw === '') {
    return EMPTY_DOC;
  }
  const trimmed = raw.trimStart();
  // 2) JSON 路径
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isValidDoc(parsed)) return parsed;
    } catch {
      // 损坏 JSON → 走纯文本逻辑
    }
  }
  // 3) 纯文本路径
  return {
    type: 'doc',
    content: raw.split('\n').map(wrapLine),
  };
}
