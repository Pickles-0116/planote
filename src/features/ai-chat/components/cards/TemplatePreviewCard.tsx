/**
 * TemplatePreviewCard · 模板预览卡片
 */

import { FileType } from 'lucide-react';
import CardShell, { type CardShellProps } from './CardShell';
import type { TemplatePreviewData } from '@/types/domain';

interface Props extends Omit<CardShellProps, 'title' | 'icon' | 'children'> {
  data: TemplatePreviewData;
}

export default function TemplatePreviewCard(props: Props): JSX.Element {
  const { data, onConfirm, onModify, onCancel } = props;
  return (
    <CardShell
      title="模板预览"
      icon={<FileType size={14} className="text-brand-700 dark:text-brand-400" />}
      onConfirm={onConfirm}
      onModify={onModify}
      onCancel={onCancel}
    >
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-stone-500 dark:text-stone-400">名称</span>
          <span className="font-medium">{data.name || '(空)'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-stone-500 dark:text-stone-400">分类</span>
          <span>{data.category}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-stone-500 dark:text-stone-400">字数</span>
          <span>{data.aiParams?.minWords} ~ {data.aiParams?.maxWords}</span>
        </div>
        {data.description && (
          <div className="text-xs text-stone-600 dark:text-stone-300">{data.description}</div>
        )}
        {data.sections && data.sections.length > 0 && (
          <div className="pt-2 border-t border-stone-200 dark:border-stone-600">
            <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">章节（{data.sections.length} 节）</div>
            <ol className="space-y-1">
              {data.sections.map((s, i) => (
                <li key={i} className="text-xs">
                  <div className="font-medium">{i + 1}. {s.heading}</div>
                  {s.guide && <div className="text-stone-500 dark:text-stone-400 ml-3">引导：{s.guide}</div>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </CardShell>
  );
}