/**
 * FrameworkRepository 实现（v1.0 只读 + apply）
 *
 * 关键规则（tasks.md 3.4 + spec.md Requirement: Framework 内置数据）：
 * - 只暴露 list / get / apply / incrementUseCount
 * - 不实现 create / update / delete（v1.0 限制内置）
 * - apply 返回 Tiptap JSON 文档（同事务内 useCount +1）
 * - 传入 planId 时把 plan 字段注入占位符
 */

import type { ID, Framework, TiptapJSON, Plan, FrameworkSection } from '@/types/domain';
import type { FrameworkRepository, AppErrorPayload } from './types';
import { AppError } from './types';
import type { PlanoteDB } from '../schema';

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Framework not found: ${id}`,
  };
  throw new AppError(payload);
};

// ========== Tiptap 节点构造工具 ==========

const heading = (level: 1 | 2, text: string): TiptapJSON['content'][number] => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

const paragraph = (text: string): TiptapJSON['content'][number] => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : undefined,
});

const bulletList = (...items: string[]): TiptapJSON['content'][number] => ({
  type: 'bulletList',
  content: items.map((it) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: it }] }],
  })),
});

/** 默认 doc。 */
const doc = (...content: TiptapJSON['content']): TiptapJSON => ({
  type: 'doc',
  content,
});

/** 简单占位符替换：`{plan.title}` 这种。 */
const substitute = (text: string, plan: Plan | undefined): string => {
  if (!plan) return text;
  return text
    .split('{plan.title}').join(plan.title)
    .split('{plan.description}').join(plan.description)
    .split('{progress}').join(String(plan.progress));
};

/** 把一个 section 渲染为 heading + 引导 paragraph。 */
const sectionToNodes = (
  s: FrameworkSection,
  plan: Plan | undefined,
): TiptapJSON['content'] => [
  heading(2, s.heading),
  paragraph(substitute(s.guide, plan)),
  paragraph(''), // 空白行供用户填写
];

export class FrameworkRepo implements FrameworkRepository {
  constructor(private db: PlanoteDB) {}

  async list(): Promise<Framework[]> {
    const all = await this.db.frameworks.toArray();
    // 按 category 排序：review → habit → note → summary
    const order: Record<string, number> = {
      review: 0,
      habit: 1,
      note: 2,
      summary: 3,
    };
    return all.sort(
      (a, b) => (order[a.category] ?? 99) - (order[b.category] ?? 99),
    );
  }

  async get(id: ID): Promise<Framework | undefined> {
    return this.db.frameworks.get(id);
  }

  async apply(frameworkId: ID, planId?: ID): Promise<TiptapJSON> {
    return this.db.transaction('rw', this.db.frameworks, this.db.plans, async () => {
      const fwRow = await this.db.frameworks.get(frameworkId);
      if (fwRow === undefined) throwNotFound(frameworkId);
      const fw = fwRow as Framework;

      // 加载 plan（若有）
      const plan = planId ? await this.db.plans.get(planId) : undefined;

      // 生成 Tiptap 文档
      const content: TiptapJSON['content'] = [
        heading(1, `${plan?.title ?? '未命名'} · ${fw.name}`),
        paragraph(plan?.description ?? fw.description),
        ...fw.sections.flatMap((s) => sectionToNodes(s, plan)),
      ];

      if (plan) {
        // 关键数据：进度 + 完成事项
        content.push(
          heading(2, '关键数据'),
          bulletList(
            `完成率：${plan.progress}%`,
            `计划状态：${plan.status}`,
          ),
        );
      }

      // useCount +1
      await this.db.frameworks.put({ ...fw, useCount: fw.useCount + 1 });

      return doc(...content);
    });
  }

  async incrementUseCount(frameworkId: ID): Promise<void> {
    const fwRow = await this.db.frameworks.get(frameworkId);
    if (fwRow === undefined) throwNotFound(frameworkId);
    const fw = fwRow as Framework;
    await this.db.frameworks.put({ ...fw, useCount: fw.useCount + 1 });
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createFrameworkRepo = (
  database: PlanoteDB = defaultDb,
): FrameworkRepo => new FrameworkRepo(database);
