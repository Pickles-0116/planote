/**
 * ImportMarkdownButton · v1.1 增量
 *
 * 「导入 .md」按钮 + 隐藏 file input。点击 → 选 .md → 解析 → 创建 blog。
 */

import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarkdownImport } from '@/features/blog/hooks/useMarkdownImport';

interface ImportMarkdownButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary';
}

export default function ImportMarkdownButton({
  className,
  variant = 'primary',
}: ImportMarkdownButtonProps) {
  const ref = useRef<HTMLInputElement>(null);
  const importFile = useMarkdownImport();

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
        title="导入 Markdown 文件（≤ 1MB）"
      >
        <FileUp size={14} />
        导入 .md
      </button>
      <input
        ref={ref}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void importFile(file);
          }
          // 重置 value 以便同一文件能再次触发
          e.target.value = '';
        }}
      />
    </>
  );
}
