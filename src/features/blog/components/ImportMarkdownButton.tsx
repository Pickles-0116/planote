/**
 * ImportMarkdownButton · v1.1 批量升级
 *
 * 「导入 .md」按钮 + 隐藏 file input。
 * - 点击 → 选 .md / .markdown / .txt（**multiple** 多选）
 * - 选中 → 调 useMarkdownImport.importFiles（批量，**不**跳转）
 * - variant：primary（粗边框）/ secondary（文字按钮，菜单内用）
 *
 * 行为（spec Requirement: 批量 Markdown 导入入口 MUST 支持多选）：
 * - input multiple 属性
 * - accept=".md,.markdown,.txt"
 * - 5MB / 文件（v1.1 提升）
 */

import { useRef, useEffect } from 'react';
import { FileUp, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarkdownImport } from '@/features/blog/hooks/useMarkdownImport';

interface ImportMarkdownButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary';
  /** 导入模式：files=多选 .md 文件；directory=选目录（含图片自动配对内联）。 */
  mode?: 'files' | 'directory';
  /** 按钮文案（files 默认「导入 .md」；directory 默认「导入目录」）。 */
  label?: string;
  /** title 属性（默认说明大小限制）。 */
  title?: string;
}

export default function ImportMarkdownButton({
  className,
  variant = 'primary',
  mode = 'files',
  label,
  title,
}: ImportMarkdownButtonProps) {
  const ref = useRef<HTMLInputElement>(null);
  const { importFiles, importFilesWithImages } = useMarkdownImport();
  const isDir = mode === 'directory';
  const finalLabel = label ?? (isDir ? '导入目录' : '导入 .md');
  const finalTitle =
    title ??
    (isDir
      ? '选择包含 .md 和图片的目录，图片自动内联到正文'
      : '导入 Markdown 文件（≤ 5MB / 个，可多选）');

  // directory 模式：通过 setAttribute 注入非标准 webkitdirectory / directory 属性
  useEffect(() => {
    if (ref.current) {
      if (isDir) {
        ref.current.setAttribute('webkitdirectory', '');
        ref.current.setAttribute('directory', '');
      } else {
        ref.current.removeAttribute('webkitdirectory');
        ref.current.removeAttribute('directory');
      }
    }
  }, [isDir]);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition',
          variant === 'primary'
            ? 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-brand-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-700'
            : 'text-brand-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800',
          className,
        )}
        title={finalTitle}
      >
        {isDir ? <FolderOpen size={14} /> : <FileUp size={14} />}
        {finalLabel}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept={isDir ? undefined : '.md,.markdown,.txt'}
        className="hidden"
        onChange={(e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) {
            const files = Array.from(fileList);
            if (isDir) {
              void importFilesWithImages(files);
            } else {
              void importFiles(files);
            }
          }
          // 重置 value 以便同一文件能再次触发
          e.target.value = '';
        }}
      />
    </>
  );
}
