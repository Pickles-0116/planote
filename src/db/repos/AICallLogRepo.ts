/**
 * AICallLogRepository 实现
 *
 * 调用日志存储在 IndexedDB，用于本地统计面板。
 * getStats 按时间范围和模型 ID 聚合。
 */

import type { ID, AICallLog, ISODate } from '@/types/domain';
import type {
  AICallLogRepository,
  AICallLogCreateInput,
  AICallStats,
  QueryOptions,
} from './types';
import { newId } from '@/lib/id';
import type { PlanoteDB } from '../schema';

const nowISO = (): ISODate => new Date().toISOString();

/**
 * 内置定价表（美元 / 1M tokens）。
 * 用于费用估算，自定义模型无定价信息返回 null。
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'qwen-max': { input: 0.02, output: 0.06 },
  'qwen-plus': { input: 0.004, output: 0.012 },
  'qwen-turbo': { input: 0.002, output: 0.006 },
};

export class AICallLogRepo implements AICallLogRepository {
  constructor(private db: PlanoteDB) {}

  async create(input: AICallLogCreateInput): Promise<AICallLog> {
    const log: AICallLog = {
      ...input,
      id: newId(),
      createdAt: nowISO(),
    };
    await this.db.aiCallLogs.add(log);
    return log;
  }

  async list(opts?: QueryOptions<AICallLog>): Promise<AICallLog[]> {
    let rows: AICallLog[] = await this.db.aiCallLogs.toArray();

    if (opts?.filter) {
      const filter = opts.filter;
      rows = rows.filter((log) => {
        for (const [k, v] of Object.entries(filter)) {
          const actual = (log as unknown as Record<string, unknown>)[k];
          if (v === undefined) continue;
          if (actual !== v) return false;
        }
        return true;
      });
    }

    // 默认按 createdAt desc
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    if (opts?.pagination) {
      const { offset, limit } = opts.pagination;
      rows = rows.slice(offset, offset + limit);
    }
    return rows;
  }

  async getStats(since?: ISODate, modelProfileId?: ID): Promise<AICallStats> {
    let rows: AICallLog[] = await this.db.aiCallLogs.toArray();

    if (since) {
      rows = rows.filter((r) => r.createdAt >= since);
    }
    if (modelProfileId) {
      rows = rows.filter((r) => r.modelProfileId === modelProfileId);
    }

    const totalCalls = rows.length;
    const promptTokens = rows.reduce((sum, r) => sum + (r.promptTokens ?? 0), 0);
    const completionTokens = rows.reduce((sum, r) => sum + (r.completionTokens ?? 0), 0);

    // 费用估算（需要关联模型配置拿 model 名称）
    // 简化：遍历日志，尝试从 PRICING 表匹配
    let estimatedCost: number | null = 0;
    for (const row of rows) {
      // 从 aiCallLogs 无法直接拿到 model 名称，暂存 modelProfileId
      // 实际估算在 hook 层做（能拿到 modelProfiles）
      // 这里仅返回 token 汇总，费用在 hook 层计算
      void row;
    }
    estimatedCost = null; // 由 hook 层补充

    return { totalCalls, promptTokens, completionTokens, estimatedCost };
  }

  async clearAll(): Promise<void> {
    await this.db.aiCallLogs.clear();
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createAICallLogRepo = (database: PlanoteDB = defaultDb): AICallLogRepo =>
  new AICallLogRepo(database);

/** 导出定价表供外部费用估算使用。 */
export { PRICING };
