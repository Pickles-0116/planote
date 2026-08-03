/**
 * NewBlogMenu · v1.1 批量升级
 *
 * 统一「新建博客」入口：
 * - 「空白博客」→ 跳 /blogs/new
 * - 「导入 .md」→ 弹文件选择（多选批量，留在列表页）
 *
 * 行为（spec Requirement: 批量 Markdown 导入入口 MUST 支持多选）：
 * - 入口文案与大小限制同步到 5MB
 * - 批量导入完成后**不**跳转
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, ChevronDown, Files } from 'lucide-react';
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

  const handleClose = (): void => setOpen(false);

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
          className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg overflow-hidden z-20 animate-fadeUp"
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

          {/* 批量导入（v1.1） */}
          <div
            onClick={handleClose}
            data-menu-item="batch-import"
          >
            <ImportMarkdownButton
              variant="secondary"
              label="批量导入 .md"
              className="w-full justify-start px-4 py-2.5 rounded-none shadow-none"
            />
          </div>

          {/* 目录导入（含图片内联） */}
          <div
            onClick={handleClose}
            data-menu-item="dir-import"
          >
            <ImportMarkdownButton
              mode="directory"
              variant="secondary"
              label="导入目录（含图片）"
              className="w-full justify-start px-4 py-2.5 rounded-none shadow-none"
            />
          </div>

          <div className="px-4 py-2 text-[10px] text-brand-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-900/50">
            <Files size={10} className="inline mr-1" />
            支持 .md / .markdown / .txt，≤ 5MB / 个，可多选
          </div>
        </div>
      )}
    </div>
  );
}
