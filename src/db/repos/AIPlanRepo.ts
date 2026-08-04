/**
 * AIPlanRepository（v1.3 P 模块：PlanMode）
 *
 * 保存 PlanMode 产出的执行计划，状态跨会话共享（关掉再开仍接着进度）。
 * 与既有的 plans 表（项目计划特性）完全独立。
 */

import type { ID, AIPlan, ExecutionStep, ExecutionStepStatus, ISODate } from '@/types/domain';
import type { PlanoteDB } from '../schema';
import { newId } from '@/lib/id';

const now = (): ISODate => new Date().toISOString();

export class AIPlanRepo {
  constructor(private db: PlanoteDB) {}

  async list(): Promise<AIPlan[]> {
    const all = await this.db.aiPlans.toArray();
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: ID): Promise<AIPlan | undefined> {
    return this.db.aiPlans.get(id);
  }

  async upsert(plan: AIPlan): Promise<AIPlan> {
    const existing = await this.db.aiPlans.get(plan.id);
    const next: AIPlan = { ...plan, updatedAt: now(), createdAt: existing?.createdAt ?? plan.createdAt ?? now() };
    await this.db.aiPlans.put(next);
    return next;
  }

  /** 批量设置步骤状态（执行会话用）。 */
  async setStepStatus(planId: ID, stepId: ID, status: ExecutionStepStatus): Promise<AIPlan | undefined> {
    const plan = await this.db.aiPlans.get(planId);
    if (!plan) return undefined;
    const steps: ExecutionStep[] = plan.steps.map((s) =>
      s.id === stepId ? { ...s, status } : s,
    );
    const updated: AIPlan = { ...plan, steps, updatedAt: now() };
    await this.db.aiPlans.put(updated);
    return updated;
  }

  async remove(id: ID): Promise<void> {
    // aiPlans 在 v1.3 起不参与云同步（见 db/sync/types.ts 注释），
    // 物理删除本地记录即可，不再写墓碑。
    await this.db.transaction('rw', this.db.aiPlans, async () => {
      await this.db.aiPlans.delete(id);
    });
  }
}

import { db as defaultDb } from '../index';
export const createAIPlanRepo = (database: PlanoteDB = defaultDb): AIPlanRepo => new AIPlanRepo(database);

/** 由目标文本生成结构化执行计划（确定性生成，可后续替换为 AI 起草）。 */
export function buildPlanFromGoal(goal: string): AIPlan {
  const ts = now();
  const clean = goal.trim() || '未命名计划';
  const steps: ExecutionStep[] = [
    { id: newId(), title: '明确目标与范围', description: `对齐「${clean}」的最终交付物与边界。`, status: 'todo' },
    { id: newId(), title: '拆解关键任务', description: '列出达成目标所需的关键步骤与依赖。', status: 'todo' },
    { id: newId(), title: '分配资源与时间', description: '评估所需资源、排期与风险点。', status: 'todo' },
    { id: newId(), title: '执行与验证', description: '逐步落地并对齐阶段成果。', status: 'todo' },
    { id: newId(), title: '复盘与收尾', description: '验收交付物，沉淀可复用经验。', status: 'todo' },
  ];
  return {
    id: newId(),
    title: clean,
    description: '由 PlanMode 生成的执行计划。',
    steps,
    createdAt: ts,
    updatedAt: ts,
  };
}
