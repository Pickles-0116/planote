/**
 * CallStatsPanel · AI 调用统计面板
 *
 * 展示调用次数、token 消耗和估算费用。
 * 支持时间范围切换（今日/本周/本月/全部）。
 */

import { useState } from 'react';
import { BarChart3, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAICallStats } from '../hooks/useAICallStats';
import type { StatsTimeRange } from '../stores/aiStatsStore';

const TIME_RANGES: { value: StatsTimeRange; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
];

export default function CallStatsPanel() {
  const { stats, timeRange, loading, setTimeRange, resetStats, formatTokens } = useAICallStats();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    if (showResetConfirm) {
      resetStats();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-900 dark:text-stone-100 flex items-center gap-2">
          <BarChart3 size={18} />
          调用统计
        </h3>
        <button
          onClick={handleReset}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition',
            showResetConfirm
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'text-brand-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700',
          )}
        >
          {showResetConfirm ? (
            <>
              <AlertTriangle size={12} />
              确认重置
            </>
          ) : (
            <>
              <RotateCcw size={12} />
              重置统计
            </>
          )}
        </button>
      </div>

      {/* 时间范围 */}
      <div className="flex gap-1.5">
        {TIME_RANGES.map((tr) => (
          <button
            key={tr.value}
            onClick={() => setTimeRange(tr.value)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-medium transition',
              timeRange === tr.value
                ? 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'bg-stone-100 dark:bg-stone-700 text-brand-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600',
            )}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* 统计数据 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="调用次数" value={stats.totalCalls.toString()} />
        <StatCard label="输入 Token" value={formatTokens(stats.promptTokens)} />
        <StatCard label="输出 Token" value={formatTokens(stats.completionTokens)} />
        <StatCard
          label="总 Token"
          value={formatTokens(stats.promptTokens + stats.completionTokens)}
        />
      </div>

      {loading && (
        <div className="text-xs text-brand-400 dark:text-stone-500 text-center py-1">
          加载中...
        </div>
      )}

      {stats.totalCalls === 0 && !loading && (
        <div className="text-center py-4 text-brand-400 dark:text-stone-500 text-sm">
          暂无调用记录
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 dark:bg-stone-700/50 rounded-xl p-3">
      <div className="text-xs text-brand-400 dark:text-stone-500 mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-brand-900 dark:text-stone-100">{value}</div>
    </div>
  );
}
