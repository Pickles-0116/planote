/**
 * NewBlogMenu · v1.1 增量
 *
 * 统一「新建博客」入口：
 * - 「空白博客」→ 跳 /blogs/new
 * - 「导入 .md」→ 弹文件选择
 *
 * v1.0 仅有「空白博客」一个入口；v1.1 增「导入 .md」。
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, FileUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImportMarkdownButton from './ImportMarkdownButton';

export default function NewBlogMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // 外部点击关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm"
      >
        <PenLine size={14} />
        新建博客
        <ChevronDown
          size={12}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg overflow-hidden z-20 animate-fadeUp"
          role="menu"
        >
          <button
            type="button"
            onClick={() => {
              navigate('/blogs/new');
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-brand-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition text-left"
            role="menuitem"
          >
            <PenLine size={14} />
            <div>
              <div className="font-medium">空白博客</div>
              <div className="text-[10px] text-brand-400 dark:text-stone-500">
                从零开始写
              </div>
            </div>
          </button>
          <div
            className="border-t border-stone-100 dark:border-stone-700"
            onClick={() => setOpen(false)}
          >
            <ImportMarkdownButton
              variant="secondary"
              className="w-full justify-start px-4 py-2.5 rounded-none shadow-none"
            />
          </div>
          <div className="px-4 py-2 text-[10px] text-brand-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-900/50">
            <FileUp size={10} className="inline mr-1" />
            支持 .md / .markdown / .txt，≤ 1MB
          </div>
        </div>
      )}
    </div>
  );
}
