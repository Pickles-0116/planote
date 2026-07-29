/**
 * queryInterceptor · 拦截 AI 的 get_* tool call
 *
 * 来源：openspec/changes/ai-chat-smart-qa/design.md 决策 1。
 */

import { planRepo, blogRepo, blogTemplateRepo } from '@/db/repos';
import { computeAppStats } from './computeAppStats';

export type DataQueryTool = 'get_plans' | 'get_blogs' | 'get_templates' | 'get_stats';

export interface QueryResult {
  tool: DataQueryTool;
  /** JSON-serializable 结果（用于注入下一轮对话）。 */
  data: unknown;
  /** 用于 DataQueryCard 渲染的可读摘要。 */
  displayRows: Array<{ id: string; cells: Array<{ label: string; value: string; href?: string }> }>;
  /** 统计摘要（仅 get_stats 用）。 */
  summary?: string;
}

export async function interceptDataQuery(
  tool: DataQueryTool,
  filter?: Record<string, unknown>,
): Promise<QueryResult> {
  switch (tool) {
    case 'get_plans': {
      const opts = filter ? { filter: filter as Record<string, import('@/db/repos/types').FilterValue> } : undefined;
      const plans = await planRepo.list(opts);
      const rows = plans.map((p) => ({
        id: p.id,
        cells: [
          { label: '标题', value: p.title },
          { label: '状态', value: p.status },
          { label: '进度', value: `${p.progress}%` },
          { label: '层级', value: p.level },
        ],
        href: `/plans/${p.id}`,
      }));
      return {
        tool,
        data: plans.map((p) => ({
          title: p.title,
          status: p.status,
          progress: p.progress,
          level: p.level,
          timeDim: p.timeDim,
          endDate: p.endDate,
        })),
        displayRows: rows,
      };
    }
    case 'get_blogs': {
      const opts = filter ? { filter: filter as Record<string, import('@/db/repos/types').FilterValue> } : undefined;
      const blogs = await blogRepo.list(opts);
      const rows = blogs.map((b) => ({
        id: b.id,
        cells: [
          { label: '标题', value: b.title },
          { label: '状态', value: b.status },
          { label: '来源', value: b.source },
          { label: '更新', value: b.updatedAt.slice(0, 10) },
        ],
        href: `/blogs/${b.id}`,
      }));
      return {
        tool,
        data: blogs.map((b) => ({
          title: b.title,
          status: b.status,
          source: b.source,
          updatedAt: b.updatedAt,
        })),
        displayRows: rows,
      };
    }
    case 'get_templates': {
      const opts = filter ? { filter: filter as Record<string, import('@/db/repos/types').FilterValue> } : undefined;
      const templates = await blogTemplateRepo.list(opts);
      const rows = templates.map((t) => ({
        id: t.id,
        cells: [
          { label: '名称', value: t.name },
          { label: '分类', value: t.category },
          { label: '使用', value: `${t.useCount} 次` },
          { label: '内置', value: t.builtin ? '是' : '否' },
        ],
        href: `/templates/${t.id}/edit`,
      }));
      return {
        tool,
        data: templates.map((t) => ({
          name: t.name,
          category: t.category,
          useCount: t.useCount,
          builtin: t.builtin,
        })),
        displayRows: rows,
      };
    }
    case 'get_stats': {
      const stats = await computeAppStats();
      const summary = [
        `计划总数 ${stats.planCounts.total}（进行中 ${stats.planCounts.doing}，已完成 ${stats.planCounts.done}）`,
        `博客总数 ${stats.blogCounts.total}（草稿 ${stats.blogCounts.draft}，已发布 ${stats.blogCounts.published}）`,
        `事项总数 ${stats.itemCounts.total}（已完成 ${stats.itemCounts.done}）`,
        `平均进度 ${stats.overallProgress}%`,
        `本周新增：计划 ${stats.weeklyNew.plans}，博客 ${stats.weeklyNew.blogs}`,
      ].join('\n');
      return { tool, data: stats, displayRows: [], summary };
    }
  }
}

/** 把结果格式化为 system message content。 */
export function formatQueryResultForLLM(result: QueryResult): string {
  if (result.tool === 'get_stats') {
    return `[数据查询结果 - ${result.tool}]\n${result.summary}`;
  }
  return `[数据查询结果 - ${result.tool}]\n${JSON.stringify(result.data, null, 2)}`;
}