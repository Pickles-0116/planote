/**
 * useApplyFramework - 把 FrameworkSection 列表注入 Tiptap editor
 *
 * 行为：
 * - 扫 H2 节点，比对 framework.sections.heading → 全部命中视为已应用
 * - 幂等：再点同一 framework 不动内容
 * - 切换 framework：先 clearContent，再按 sections 顺序插入 H2 + 空段
 * - placeholder 通过 data-placeholder 属性挂在 paragraph 上
 *
 * 视觉与 Blog 内容解耦：父组件只需提供 editor 与 framework 实例。
 */

import { useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type { Framework, TiptapJSON } from '@/types/domain';

interface UseApplyFrameworkResult {
  apply: () => void;
  isApplied: boolean;
}

/** 扫 H2 节点的 textContent。 */
const collectH2Headings = (editor: Editor): string[] => {
  const headings: string[] = [];
  const { state } = editor;
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      void pos; // pos 在 type 守卫中用不到，保留以备扩展
      const text = node.textContent;
      if (text) headings.push(text);
    }
    return true;
  });
  return headings;
};

/** 构造 H2 + 空段（含 placeholder）。 */
const buildSectionNodes = (sections: Framework['sections']): TiptapJSON['content'] => {
  const out: TiptapJSON['content'] = [];
  for (const s of sections) {
    out.push({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: s.heading }],
    });
    out.push({
      type: 'paragraph',
      attrs: { 'data-placeholder': s.placeholder },
    } as TiptapJSON['content'][number]);
  }
  return out;
};

/** 框架应用 hook。 */
export function useApplyFramework(
  editor: Editor | null,
  framework: Framework | null,
): UseApplyFrameworkResult {
  // isApplied：editor 与 framework 都到位时，扫 H2 比对
  const isApplied = useMemo(() => {
    if (!editor || !framework) return false;
    const headings = collectH2Headings(editor);
    if (headings.length === 0) return false;
    if (headings.length < framework.sections.length) return false;
    return framework.sections.every((s) => headings.includes(s.heading));
  }, [editor, framework]);

  const apply = useCallback((): void => {
    if (!editor || !framework) return;
    const headings = collectH2Headings(editor);
    const alreadyApplied =
      headings.length >= framework.sections.length &&
      framework.sections.every((s) => headings.includes(s.heading));
    if (alreadyApplied) return;

    // 清空 + 重建
    editor.commands.clearContent();
    const nodes = buildSectionNodes(framework.sections);
    editor.commands.insertContent(nodes as unknown as string);
  }, [editor, framework]);

  return { apply, isApplied };
}
