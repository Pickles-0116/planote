/**
 * FeedbackSettings - 反馈区块占位（add-settings-and-shell）
 *
 * v1.0 仅占位：v1.1 计划内
 */

import { MessageCircle, Sparkles } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';

export default function FeedbackSettings(): JSX.Element {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-brand-900 dark:text-stone-100">反馈</h2>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          提建议 / 报问题 / 提需求。
        </p>
      </header>

      <EmptyState
        icon={MessageCircle}
        title="反馈功能 v1.1 计划内"
        description="v1.0 是本地单用户工具，暂未集成反馈渠道。v1.1 计划加入 issue 模板与 GitHub 链接。"
        action={{
          label: '了解 v1.1 计划',
          onClick: () => {
            window.open('https://github.com/Fission-AI/OpenSpec', '_blank', 'noopener,noreferrer');
          },
          variant: 'secondary',
        }}
        variant="default"
      />

      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5">
        <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-stone-300 mb-2">
          <Sparkles size={14} className="text-accent-500" />
          <span className="font-semibold">v1.1 预览</span>
        </div>
        <ul className="text-xs text-brand-500 dark:text-stone-400 space-y-1.5 pl-1">
          <li>· 反馈表单（issue 模板）</li>
          <li>· 错误自动上报（接入 Sentry）</li>
          <li>· 用户调研（可选参与）</li>
        </ul>
      </div>
    </section>
  );
}
