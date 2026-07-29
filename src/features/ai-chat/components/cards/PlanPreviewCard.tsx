/**
 * PlanPreviewCard · 计划预览卡片
 *
 * 来源：openspec/changes/ai-chat-intent-routing（M2 骨架）+ ai-chat-create-content（业务接入）。
 */

import { ClipboardList } from 'lucide-react';
import CardShell, { type CardShellProps } from './CardShell';
import type { PlanPreviewData } from '@/types/domain';

const LEVEL_LABELS: Record<string, string> = {
  short: '短期计划',
  mid: '中期计划',
  long: '长期计划',
};
const TIME_DIM_LABELS: Record<string, string> = {
  daily: '每日',
  monthly: '每月',
  yearly: '每年',
  once: '一次性',
};

interface Props extends Omit<CardShellProps, 'title' | 'icon' | 'children'> {
  data: PlanPreviewData;
}

export default function PlanPreviewCard(props: Props): JSX.Element {
  const { data, onConfirm, onModify, onCancel } = props;
  return (
    <CardShell
      title="计划预览"
      icon={<ClipboardList size={14} className="text-brand-700 dark:text-brand-400" />}
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
          <span className="text-stone-500 dark:text-stone-400">层级 / 维度</span>
          <span>{LEVEL_LABELS[data.level] ?? data.level} · {TIME_DIM_LABELS[data.timeDim] ?? data.timeDim}</span>
        </div>
        {data.startDate && (
          <div className="flex justify-between text-xs">
            <span className="text-stone-500 dark:text-stone-400">时间</span>
            <span>{data.startDate} ~ {data.endDate ?? '未定'}</span>
          </div>
        )}
        {data.description && (
          <div className="text-xs text-stone-600 dark:text-stone-300 pt-1 border-t border-stone-200 dark:border-stone-600">
            {data.description}
          </div>
        )}
        {data.items && data.items.length > 0 && (
          <div className="pt-2 border-t border-stone-200 dark:border-stone-600">
            <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">事项（{data.items.length} 项）</div>
            <ul className="space-y-0.5">
              {data.items.map((item, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5">
                  <span className="text-stone-400">☐</span>
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardShell>
  );
}