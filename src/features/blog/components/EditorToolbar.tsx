/**
 * EditorToolbar - 博客编辑器工具栏（add-blog-tiptap-editor 增量）
 *
 * 11 个格式按钮（B / I / H1 / H2 / H3 / bullet / ordered / quote / code / codeBlock / link）
 * + 「应用框架」按钮（disabled if !frameworkId；显对勾 if isApplied）
 * + 保存状态 + 字数统计
 * + Cmd/Ctrl+S 快捷键拦截
 *
 * a11y：每个按钮 `aria-label` + 激活态 `aria-pressed`。
 */

import { memo } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Link as LinkIcon,
  Paperclip,
  Sparkles,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import CharacterCount from './CharacterCount';
import SaveStatusBadge from './SaveStatusBadge';
import type { SaveStatus, CharCount } from '@/types/editor';

interface Props {
  editor: Editor | null;
  readOnly?: boolean;
  saveStatus?: SaveStatus;
  charCount?: CharCount;
  hasFramework: boolean;
  frameworkApplied: boolean;
  onApplyFramework: () => void;
  onSaveNow?: () => void;
  /** add-blog-attachment 增量：附件按钮点击（父组件触发隐藏 file input）。 */
  onAttachClick?: () => void;
  /** v1.3-AI：打开 AI 写作面板。 */
  onAIWriting?: () => void;
}

// 单按钮定义
interface ToolbarButton {
  key: string;
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => boolean;
}

const BUTTONS: ToolbarButton[] = [
  {
    key: 'bold',
    label: '加粗',
    icon: Bold,
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    key: 'italic',
    label: '斜体',
    icon: Italic,
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    key: 'h1',
    label: '一级标题',
    icon: Heading1,
    isActive: (e) => e.isActive('heading', { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'h2',
    label: '二级标题',
    icon: Heading2,
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3',
    label: '三级标题',
    icon: Heading3,
    isActive: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    key: 'bulletList',
    label: '无序列表',
    icon: List,
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'orderedList',
    label: '有序列表',
    icon: ListOrdered,
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'blockquote',
    label: '引用',
    icon: Quote,
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: 'code',
    label: '行内代码',
    icon: Code,
    isActive: (e) => e.isActive('code'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    key: 'codeBlock',
    label: '代码块',
    icon: Code2,
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    key: 'link',
    label: '链接',
    icon: LinkIcon,
    isActive: (e) => e.isActive('link'),
    run: (e) => {
      const previous = (e.getAttributes('link').href as string | undefined) ?? '';
      // 简易 prompt：v1.0 简化为 window.prompt
      const url = window.prompt('输入链接 URL（留空取消）', previous);
      if (url === null) return false;
      if (url === '') {
        return e.chain().focus().extendMarkRange('link').unsetLink().run();
      }
      return e.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    },
  },
];

/** 分割线。 */
function Divider(): JSX.Element {
  return <div className="w-px h-5 bg-stone-200 mx-1 flex-shrink-0" />;
}

function EditorToolbarBase({
  editor,
  readOnly,
  saveStatus,
  charCount,
  hasFramework,
  frameworkApplied,
  onApplyFramework,
  onSaveNow,
  onAttachClick,
  onAIWriting,
}: Props): JSX.Element {
  // 只读模式：工具栏全部隐藏
  if (readOnly) return <></>;

  const handleClick = (btn: ToolbarButton): void => {
    if (!editor) return;
    btn.run(editor);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!editor || !onSaveNow) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSaveNow();
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="富文本格式工具栏"
      onKeyDown={handleKey}
      className="flex flex-wrap items-center gap-1 p-2 border-b border-stone-200 bg-stone-50/60 rounded-t-xl"
    >
      {BUTTONS.map((btn) => {
        const Icon = btn.icon;
        const active = editor ? btn.isActive(editor) : false;
        return (
          <button
            key={btn.key}
            type="button"
            aria-label={btn.label}
            aria-pressed={active}
            disabled={!editor}
            onClick={() => handleClick(btn)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              active
                ? 'bg-brand-900 text-white'
                : 'text-brand-600 hover:bg-stone-200/70 hover:text-brand-900',
            )}
          >
            <Icon size={15} />
          </button>
        );
      })}

      <Divider />

      {/* add-blog-attachment 增量：插入图片/PDF 按钮 */}
      {onAttachClick && (
        <button
          type="button"
          aria-label="插入图片或 PDF"
          aria-disabled={!editor}
          disabled={!editor}
          onClick={onAttachClick}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'text-brand-600 hover:bg-stone-200/70 hover:text-brand-900',
            'focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none',
          )}
          title="插入图片或 PDF（保存为附件）"
        >
          <Paperclip size={15} />
        </button>
      )}

      <Divider />

      <button
        type="button"
        aria-label={frameworkApplied ? '框架已应用' : '应用框架'}
        aria-pressed={frameworkApplied}
        disabled={!editor || !hasFramework}
        onClick={onApplyFramework}
        className={cn(
          'h-8 px-2.5 rounded-lg flex items-center gap-1.5 transition text-xs font-medium',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          frameworkApplied
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-white text-brand-700 border border-stone-200 hover:bg-stone-50',
        )}
        title={!hasFramework ? '请先选择框架' : frameworkApplied ? '已应用' : '应用框架章节'}
      >
        {frameworkApplied ? <Check size={14} /> : <Sparkles size={14} />}
        应用框架
      </button>

      {/* v1.3-AI：AI 写作按钮 */}
      {onAIWriting && (
        <button
          type="button"
          aria-label="AI 写作"
          disabled={!editor}
          onClick={onAIWriting}
          className={cn(
            'h-8 px-2.5 rounded-lg flex items-center gap-1.5 transition text-xs font-medium',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-sm',
          )}
          title="AI 辅助写作"
        >
          <Sparkles size={14} />
          AI 写作
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        {saveStatus !== undefined && <SaveStatusBadge status={saveStatus} />}
        {charCount !== undefined && (
          <CharacterCount words={charCount.words} chars={charCount.chars} />
        )}
      </div>
    </div>
  );
}

export default memo(EditorToolbarBase);
