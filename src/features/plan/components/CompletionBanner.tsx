/**
 * CompletionBanner - 100% 完成金色横幅
 *
 * 视觉（与 prototype plan-detail.html data-completion-banner 对齐）：
 * - amber 渐变背景 + amber 边框
 * - 左侧 trophy 渐变方块
 * - 右侧 CTA 按钮（黑底 + Sparkles icon）
 * - shimmer 扫光（CSS @keyframes）
 * - X 关闭按钮
 *
 * 行为（spec Requirement: 100% 完成金色横幅）：
 * - visible=true 时显示
 * - 点 CTA → onGenerateBlog（由父级连接 useUIStore.openDrawer('framework', ...)）
 * - 点 X → onDismiss（由 useCompletionBanner 提供）
 */

import { Trophy, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onGenerateBlog: () => void;
}

export default function CompletionBanner({ visible, onDismiss, onGenerateBlog }: Props) {
  if (!visible) return null;

  return (
    <div
      data-completion-banner
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden',
        'bg-gradient-to-r from-amber-50 via-accent-50 to-amber-50',
        'border-2 border-accent-300 rounded-2xl p-5 mb-6',
        'flex items-center gap-4 animate-fadeUp',
      )}
    >
      {/* shimmer 扫光层 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'linear-gradient(90deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite',
        }}
        aria-hidden
      />

      {/* 左侧 trophy 方块 */}
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center flex-shrink-0 relative">
        <Trophy className="text-white" size={20} />
      </div>

      {/* 中间文案 */}
      <div className="flex-1 relative">
        <div className="font-bold text-amber-900 text-base">
          🎉 恭喜！计划已全部完成
        </div>
        <div className="text-sm text-amber-800/80 mt-0.5">
          所有事项已勾选完成，是时候把这段经历沉淀成一篇博客了
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onGenerateBlog}
        className="relative px-4 py-2.5 bg-brand-900 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition flex items-center gap-2 shadow-sm flex-shrink-0"
      >
        <Sparkles size={14} />
        生成总结博客
      </button>

      {/* 关闭按钮 */}
      <button
        type="button"
        onClick={onDismiss}
        className="relative w-8 h-8 rounded-lg hover:bg-amber-100/50 flex items-center justify-center text-amber-700 flex-shrink-0"
        aria-label="关闭横幅"
      >
        <X size={16} />
      </button>
    </div>
  );
}
