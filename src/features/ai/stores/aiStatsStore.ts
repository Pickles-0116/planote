/**
 * AI 调用统计 Zustand Store
 *
 * 统计数据存储在 IndexedDB（通过 aiCallLogRepo），
 * Store 仅持有 transient 的 loading/error 状态和聚合缓存。
 */

import { create } from 'zustand';
import type { AICallStats, AICallLogCreateInput } from '@/db/repos/types';
import { aiCallLogRepo } from '@/db/repos';
import { PRICING } from '@/db/repos/AICallLogRepo';

export type StatsTimeRange = 'today' | 'week' | 'month' | 'all';

function getSinceDate(range: StatsTimeRange): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  switch (range) {
    case 'today':
      now.setHours(0, 0, 0, 0);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - 1);
      break;
  }
  return now.toISOString();
}

export interface AIStatsStoreState {
  stats: AICallStats;
  timeRange: StatsTimeRange;
  modelFilter: string | null;
  loading: boolean;

  setTimeRange: (range: StatsTimeRange) => void;
  setModelFilter: (modelId: string | null) => void;
  refreshStats: () => Promise<void>;
  logCall: (input: AICallLogCreateInput) => Promise<void>;
  resetStats: () => Promise<void>;
}

/** 根据模型名称估算费用（美元）。 */
export function estimateCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const pricing = PRICING[modelName];
  if (!pricing) return null;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

export const useAIStatsStore = create<AIStatsStoreState>((set, get) => ({
  stats: { totalCalls: 0, promptTokens: 0, completionTokens: 0, estimatedCost: null },
  timeRange: 'month',
  modelFilter: null,
  loading: false,

  setTimeRange: (range) => {
    set({ timeRange: range });
    get().refreshStats();
  },

  setModelFilter: (modelId) => {
    set({ modelFilter: modelId });
    get().refreshStats();
  },

  refreshStats: async () => {
    const { timeRange, modelFilter } = get();
    set({ loading: true });
    try {
      const since = getSinceDate(timeRange);
      const stats = await aiCallLogRepo.getStats(since, modelFilter ?? undefined);
      set({ stats, loading: false });
    } catch (e) {
      console.error('[aiStatsStore.refreshStats]', e);
      set({ loading: false });
    }
  },

  logCall: async (input) => {
    try {
      await aiCallLogRepo.create(input);
      // 刷新统计
      await get().refreshStats();
    } catch (e) {
      console.error('[aiStatsStore.logCall]', e);
    }
  },

  resetStats: async () => {
    try {
      await aiCallLogRepo.clearAll();
      set({
        stats: { totalCalls: 0, promptTokens: 0, completionTokens: 0, estimatedCost: null },
      });
    } catch (e) {
      console.error('[aiStatsStore.resetStats]', e);
    }
  },
}));
