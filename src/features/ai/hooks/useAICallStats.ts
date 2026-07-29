/**
 * useAICallStats · 调用统计 Hook
 *
 * 封装 useAIStatsStore 的常用操作。
 */

import { useEffect } from 'react';
import { useAIStatsStore } from '../stores/aiStatsStore';
import { formatCost, formatTokens } from '../utils/estimateCost';

export function useAICallStats() {
  const store = useAIStatsStore();

  // 首次挂载时刷新统计
  useEffect(() => {
    store.refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    stats: store.stats,
    timeRange: store.timeRange,
    modelFilter: store.modelFilter,
    loading: store.loading,

    setTimeRange: store.setTimeRange,
    setModelFilter: store.setModelFilter,
    refreshStats: store.refreshStats,
    resetStats: store.resetStats,

    // 格式化辅助
    formatCost,
    formatTokens,
  };
}
