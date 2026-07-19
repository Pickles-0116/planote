/**
 * CharacterCount - 工具栏右下角字数统计（add-blog-tiptap-editor 增量）
 *
 * 显示 `字数 N · 字符 M`：
 * - words: trim 后按 \s+ 切分长度
 * - chars: 文本总长度（含空白）
 * - 与 Tiptap @tiptap/extension-characterCount 行为对齐
 * - 只读模式下也显示（详情页有用）
 */

import { memo } from 'react';

interface Props {
  words: number;
  chars: number;
}

function CharacterCountBase({ words, chars }: Props): JSX.Element {
  return (
    <div
      className="text-xs text-brand-400 select-none tabular-nums"
      aria-live="polite"
      data-testid="character-count"
    >
      字数 {words} · 字符 {chars}
    </div>
  );
}

export default memo(CharacterCountBase);
