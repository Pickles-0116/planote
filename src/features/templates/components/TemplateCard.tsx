/** TemplateCard - 博客模板卡片（模板列表网格展示） */
import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, BookOpen, Target, BarChart3, Lightbulb, Scale, Search,
  FileText, Pen, ClipboardList, RotateCcw, MoreVertical, Copy, Trash2, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AddToCollectionButton from '@/components/shared/AddToCollectionButton';
import type { BlogTemplate } from '@/types/domain';

interface Props { template: BlogTemplate; onClick: () => void; onDuplicate: () => void; onDelete: () => void; compact?: boolean }

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, BookOpen, Target, BarChart3, Lightbulb, Scale, Search, FileText, Pen, ClipboardList, RotateCcw,
};
const CAT: Record<string, string> = { review: '复盘', note: '笔记', summary: '总结', habit: '习惯', decision: '决策', analysis: '分析', custom: '自定义' };
const STY: Record<string, string> = { professional: '专业', casual: '轻松', academic: '学术', narrative: '叙事', custom: '自定义' };

export default function TemplateCard({ template, onClick, onDuplicate, onDelete, compact }: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const Icon = ICON_MAP[template.icon] ?? Sparkles;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={cn('group relative bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4 cursor-pointer transition hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus:outline-none', compact && 'p-3')}>
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-700 flex items-center justify-center flex-shrink-0 text-brand-600 dark:text-stone-300">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100 truncate">{template.name}</h3>
          {!compact && <p className="text-xs text-brand-500 dark:text-stone-400 line-clamp-2 mt-0.5">{template.description}</p>}
        </div>
        <div ref={menuRef} className="relative flex-shrink-0 flex items-center gap-0.5">
          <span onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition">
            <AddToCollectionButton entityType="template" entityId={template.id} />
          </span>
          <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="p-1 rounded-lg text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition">
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-32 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg py-1 text-xs">
              <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-700 text-brand-700 dark:text-stone-200">
                <Copy size={12} /> 复制模板
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600">
                <Trash2 size={12} /> 删除
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-brand-50 dark:bg-stone-700 text-brand-700 dark:text-stone-300">{CAT[template.category] ?? template.category}</span>
        {!compact && <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-stone-100 dark:bg-stone-700 text-brand-500 dark:text-stone-400">{STY[template.aiParams.style] ?? template.aiParams.style}</span>}
        <span className="ml-auto text-[10px] text-brand-400 dark:text-stone-500">{template.useCount} 次使用</span>
      </div>
    </div>
  );
}
