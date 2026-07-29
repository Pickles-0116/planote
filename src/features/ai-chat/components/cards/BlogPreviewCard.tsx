/**
 * BlogPreviewCard · 博客预览卡片
 *
 * 来源：openspec/changes/ai-chat-intent-routing（M2 骨架）+ ai-chat-create-content（业务接入）。
 */

import { FileText } from 'lucide-react';
import CardShell, { type CardShellProps } from './CardShell';
import type { BlogPreviewData } from '@/types/domain';

const STYLE_LABELS: Record<string, string> = {
  professional: '专业',
  casual: '轻松',
  academic: '学术',
  narrative: '叙事',
};

interface Props extends Omit<CardShellProps, 'title' | 'icon' | 'children'> {
  data: BlogPreviewData;
}

export default function BlogPreviewCard(props: Props): JSX.Element {
  const { data, onConfirm, onModify, onCancel } = props;
  const wordCount = data.content?.length ?? 0;
  const preview = (data.content ?? '').slice(0, 300);

  return (
    <CardShell
      title="博客预览"
      icon={<FileText size={14} className="text-brand-700 dark:text-brand-400" />}
      onConfirm={onConfirm}
      onModify={onModify}
      onCancel={onCancel}
    >
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-stone-500 dark:text-stone-400">标题</span>
          <span className="font-medium">{data.title || '(空)'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-stone-500 dark:text-stone-400">风格</span>
          <span>{STYLE_LABELS[data.style] ?? data.style}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-stone-500 dark:text-stone-400">字数</span>
          <span>约 {wordCount} 字</span>
        </div>
        {preview && (
          <div className="pt-2 border-t border-stone-200 dark:border-stone-600">
            <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">内容预览</div>
            <pre className="text-xs whitespace-pre-wrap font-sans text-stone-700 dark:text-stone-300 max-h-40 overflow-y-auto scrollbar-thin">
              {preview}{wordCount > 300 ? '...' : ''}
            </pre>
          </div>
        )}
      </div>
    </CardShell>
  );
}