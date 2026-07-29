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

import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarkdownImport } from '@/features/blog/hooks/useMarkdownImport';

interface ImportMarkdownButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary';
  /** 按钮文案（默认「导入 .md」）。 */
  label?: string;
  /** title 属性（默认说明大小限制）。 */
  title?: string;
}

export default function ImportMarkdownButton({
  className,
  variant = 'primary',
  label = '导入 .md',
  title = '导入 Markdown 文件（≤ 5MB / 个，可多选）',
}: ImportMarkdownButtonProps) {
  const ref = useRef<HTMLInputElement>(null);
  const { importFiles } = useMarkdownImport();

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
        title={title}
      >
        <FileUp size={14} />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={(e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) {
            const files = Array.from(fileList);
            void importFiles(files);
          }
          // 重置 value 以便同一文件能再次触发
          e.target.value = '';
        }}
      />
    </>
  );
}
