/**
 * RichEditor - Tiptap 富文本编辑器容器（add-blog-tiptap-editor 增量）
 *
 * Props：
 * - value: TiptapJSON string（从 Blog.content 传入）
 * - readOnly: 只读模式（详情页用）
 * - placeholder: 空文档占位
 * - charCount: 字数统计（父组件用 countText 计算后传入）
 * - onSaveStatusChange: 状态变化回调（编辑页用）
 * - onEditorReady: editor 实例 ready 后回调（供 useApplyFramework 接入）
 *
 * 受控模式：v1.0 用「半受控」——editor 内部状态自管；外部 value 变化时重 init。
 * 卸载：editor.destroy() 释放 ProseMirror。
 */

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import type { Editor } from '@tiptap/react';
import type { TiptapJSON } from '@/types/domain';
import { migrateBlogContent } from '../utils/migrateBlogContent';
import { countText } from '../utils/countText';
import EditorToolbar from './EditorToolbar';
import type { SaveStatus, CharCount } from '@/types/editor';

interface Props {
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  /** 是否已选 framework（控制「应用框架」按钮启用）。 */
  hasFramework?: boolean;
  /** 当前 framework 是否已应用到编辑器。 */
  frameworkApplied?: boolean;
  /** 「应用框架」按钮点击回调。 */
  onApplyFramework?: () => void;
  /** 立即保存（用于 Cmd/Ctrl+S）。 */
  onSaveNow?: () => void;
  /** 保存状态（仅编辑页用）。 */
  saveStatus?: SaveStatus;
  /** 字数（父组件传；用 countText 计算）。 */
  charCount?: CharCount;
  /** editor 实例 ready 回调（仅初次 mount 触发）。 */
  onEditorReady?: (editor: Editor) => void;
  /** 保存状态变化回调（供 useAutoSave 注入）。 */
  onSaveStatusChange?: (status: SaveStatus) => void;
  /** 额外 className（容器）。 */
  className?: string;
  /** add-blog-attachment 增量：附件按钮点击（父组件触发隐藏 file input）。 */
  onAttachClick?: () => void;
  /** v1.3-AI：打开 AI 写作面板。 */
  onAIWriting?: () => void;
}

export default function RichEditor({
  value,
  readOnly = false,
  placeholder = '开始写你的博客…',
  hasFramework = false,
  frameworkApplied = false,
  onApplyFramework,
  onSaveNow,
  saveStatus,
  charCount,
  onEditorReady,
  className,
  onAttachClick,
  onAIWriting,
}: Props): JSX.Element {
  const initialContent = migrateBlogContent(value);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-brand-900 underline underline-offset-2 hover:text-accent-500',
        },
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
    ],
    // Tiptap 内部使用 JSONContent；我们宽松的 TiptapJSON 是其超集，
    // 用类型断言传入（运行时结构兼容）。
    content: initialContent as unknown as Record<string, unknown>,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          'tiptap-content focus:outline-none min-h-[400px] px-5 py-4 prose prose-sm max-w-none',
        'data-testid': 'rich-editor-content',
      },
    },
  });

  // editor ready 时通知父组件（仅一次）
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
    // 这里故意只依赖 editor 引用；onEditorReady 用 ref 持有避免重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // 卸载清理：Tiptap useEditor 已在内部处理 destroy；显式 null check
  useEffect(() => {
    return () => {
      // no-op：useEditor 内部返回的 editor 实例在 unmount 时被 Tiptap 自动销毁
    };
  }, []);

  // 父组件传来的 charCount 缺省时，本地兜底计算
  const finalCharCount: CharCount = charCount ?? countText(editor?.getJSON() as TiptapJSON | undefined);

  return (
    <div
      className={
        className ??
        'border border-stone-200 rounded-xl bg-white shadow-soft overflow-hidden'
      }
    >
      <EditorToolbar
        editor={editor}
        readOnly={readOnly}
        saveStatus={saveStatus}
        charCount={finalCharCount}
        hasFramework={hasFramework}
        frameworkApplied={frameworkApplied}
        onApplyFramework={() => onApplyFramework?.()}
        onSaveNow={onSaveNow}
        onAttachClick={onAttachClick}
        onAIWriting={onAIWriting}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
