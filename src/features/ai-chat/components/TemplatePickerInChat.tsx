/**
 * TemplatePickerInChat · 对话中内嵌的模板选择器
 *
 * 用户点击模板 → 自动发 user 消息 "使用模板 X" 触发 AI 重新生成。
 */

import { useEffect, useState } from 'react';
import { blogTemplateRepo } from '@/db/repos';
import { FileType } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BlogTemplate } from '@/types/domain';

interface Props {
  onPick: (templateName: string) => void;
}

export default function TemplatePickerInChat({ onPick }: Props): JSX.Element {
  const [templates, setTemplates] = useState<BlogTemplate[]>([]);

  useEffect(() => {
    blogTemplateRepo
      .list()
      .then(setTemplates)
      .catch((e) => console.error('Failed to load templates:', e));
  }, []);

  if (templates.length === 0) return <div className="text-xs text-stone-400 mt-2">暂无模板</div>;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t.name)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs',
            'bg-stone-100 hover:bg-brand-100 dark:bg-stone-700 dark:hover:bg-brand-900/30',
            'text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-600',
            'transition-colors',
          )}
        >
          <FileType size={11} />
          {t.name}
        </button>
      ))}
    </div>
  );
}