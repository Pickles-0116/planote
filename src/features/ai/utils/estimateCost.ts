/**
 * 费用估算工具
 *
 * 基于内置定价表和模型名称计算估算费用。
 */

import { PRICING } from '@/db/repos/AICallLogRepo';

/**
 * 估算 API 调用费用（美元）。
 * 如果模型不在定价表中（自定义模型），返回 null。
 */
export function estimateCallCost(
  modelName: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const pricing = PRICING[modelName];
  if (!pricing) return null;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

/**
 * 格式化费用显示。
 */
export function formatCost(cost: number | null): string {
  if (cost === null) return '—';
  if (cost < 0.001) return '< $0.001';
  return `$${cost.toFixed(4)}`;
}

/**
 * 格式化 token 数量显示。
 */
export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

/**
 * 获取已知模型的定价信息。
 */
export function getModelPricing(modelName: string): { input: number; output: number } | null {
  return PRICING[modelName] ?? null;
}
