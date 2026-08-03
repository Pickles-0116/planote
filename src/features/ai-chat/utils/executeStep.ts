/**
 * executeStep · /execute 单步执行器（v1.3-fix F3 · D5）
 *
 * 按 step.type 分发：
 * - `skill`：skillRepo.get(toolData.skillId) → 参数优先 toolData.params、缺省用 skill 默认值
 *             → 注入 {{blogs}}（若 opts.blogs 且模板含占位符，blogRepo.listByIds + contentText 截断 ≤10 篇 × 1500 字）
 *             → 流式生成 → 返回结果文本
 * - `query` / `summarize` / `custom`：**先走真实数据查询**（interceptDataQuery），
 *             把真实结果注入 prompt 再生成，并额外产出一张 `data_query` ActionCard，
 *             由 DataQueryCard 自行调 interceptDataQuery 真实渲染（复用既有意图路由卡片机制）。
 * - `create_blog` / `create_template` / `create_plan`：返回执行说明文本（不写系统，等用户确认）
 *
 * 失败不 throw（返回 `执行失败：<msg>`），让调用方能继续推进其他步骤；
 * 即便 AI 生成失败，已经查到的真实数据卡片仍会返回给调用方渲染。
 * 统一 useAIModelStore.getState() 取 profile（F4 模式，不闭包捕获 store）。
 */

import { getAdapter } from '@/features/ai/adapters';
import { useAIModelStore } from '@/features/ai/stores/aiModelStore';
import { skillRepo, blogRepo } from '@/db/repos';
import {
  interceptDataQuery,
  formatQueryResultForLLM,
  type DataQueryTool,
} from './queryInterceptor';
import type { ActionCard, AIPlan, ExecutionStep, ID } from '@/types/domain';

/** 单篇博客注入字数上限（架构 D5）。 */
const BLOG_CHAR_LIMIT = 1500;
/** 注入博客篇数上限（架构 D5）。 */
const BLOG_COUNT_LIMIT = 10;
/** 查询结果注入 prompt 的字符上限（防止爆 token）。 */
const QUERY_INJECT_LIMIT = 4000;

/**
 * 单步执行结果。
 *
 * `cards` 复用既有 `ActionCard` 判别联合（不自创卡片类型）：
 * query/summarize/custom 命中真实数据时放一张 `data_query` 卡，
 * 调用方按普通 ActionCard 渲染即可。
 */
export interface ExecuteStepOutcome {
  /** AI 生成的结果文本（失败时为可读的失败说明）。 */
  result: string;
  /** 需要额外渲染的操作卡片（当前仅 data_query）。 */
  cards: ActionCard[];
}

/** 通用流式生成：返回正文累积文本。 */
async function streamText(prompt: string): Promise<string> {
  const { getDefaultProfile, getDecodedApiKey } = useAIModelStore.getState();
  const profile = getDefaultProfile();
  if (!profile) {
    throw new Error('请先在设置中配置 AI 模型');
  }

  const apiKey = getDecodedApiKey(profile.id);
  const adapter = getAdapter(profile.provider);
  const controller = new AbortController();

  let accumulated = '';
  const stream = adapter.generateStream(
    [{ role: 'user', content: prompt }],
    {
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      model: profile.model,
      signal: controller.signal,
    },
    apiKey,
    profile.baseUrl,
  );

  while (true) {
    const result = await stream.next();
    if (result.done) break;
    if (typeof result.value === 'string') {
      accumulated += result.value;
    }
  }
  return accumulated;
}

/** 组装 skill 步骤的最终 prompt（注入 {{blogs}} + 参数占位符）。 */
async function buildSkillPrompt(
  step: ExecutionStep,
  opts: { blogs?: ID[] },
): Promise<{ prompt: string; skillName: string }> {
  const skillId = typeof step.toolData?.skillId === 'string' ? step.toolData.skillId : '';
  const skill = skillId ? await skillRepo.get(skillId) : undefined;
  if (!skill) {
    throw new Error('技能不存在或已被删除');
  }

  let prompt = skill.promptTemplate;

  // 1. 注入 {{blogs}} 占位符（若模板含该占位符）
  if (prompt.includes('{{blogs}}')) {
    if (opts.blogs && opts.blogs.length > 0) {
      const blogs = await blogRepo.listByIds(opts.blogs.slice(0, BLOG_COUNT_LIMIT));
      if (blogs.length > 0) {
        const injected = blogs
          .map(
            (b, i) =>
              `${i + 1}. ${b.title}\n${(b.contentText ?? '').slice(0, BLOG_CHAR_LIMIT)}`,
          )
          .join('\n\n');
        prompt = prompt.replace('{{blogs}}', injected);
      } else {
        prompt = prompt.replace('{{blogs}}', '（未注入博客数据：所选博客不存在）');
      }
    } else {
      prompt = prompt.replace('{{blogs}}', '（未注入博客数据：本会话未选择博客）');
    }
  }

  // 2. 参数注入：优先 toolData.params，缺省用 skill.params 默认值
  const rawParams = step.toolData?.params;
  const toolParams =
    rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)
      ? (rawParams as Record<string, unknown>)
      : undefined;
  for (const p of skill.params) {
    const value = toolParams?.[p.key] ?? p.default ?? '';
    prompt = prompt.split(`{{${p.key}}}`).join(String(value));
  }

  return { prompt, skillName: skill.name };
}

const VALID_TOOLS: DataQueryTool[] = ['get_plans', 'get_blogs', 'get_templates', 'get_stats'];

/**
 * 推断步骤要查的实体。
 * 优先 `toolData.tool`，否则按标题/描述关键词判定；判定不出来时：
 * - `query` 步骤兜底查博客（PlanMode 里 query 步骤绝大多数是「找博客」）；
 * - `summarize` / `custom` 返回 null（保持原有纯生成行为，不强插卡片）。
 */
function inferQueryTool(step: ExecutionStep): DataQueryTool | null {
  const explicit = step.toolData?.tool;
  if (typeof explicit === 'string' && (VALID_TOOLS as string[]).includes(explicit)) {
    return explicit as DataQueryTool;
  }
  const text = `${step.title} ${step.description ?? ''}`.toLowerCase();
  if (/博客|文章|blog|post/.test(text)) return 'get_blogs';
  if (/计划|规划|plan(?!ote)/.test(text)) return 'get_plans';
  if (/模板|template/.test(text)) return 'get_templates';
  if (/统计|概览|数据情况|stats/.test(text)) return 'get_stats';
  return (step.type ?? 'custom') === 'query' ? 'get_blogs' : null;
}

/** 从 step.toolData.filter 取查询条件（非对象时忽略）。 */
function readStepFilter(step: ExecutionStep): Record<string, unknown> | undefined {
  const raw = step.toolData?.filter;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

/** 真实查询产物：卡片 + 注入 prompt 的文本 + 兜底摘要。 */
interface StepQueryOutcome {
  card?: ActionCard;
  injected?: string;
  summary?: string;
}

/**
 * 为 query/summarize/custom 步骤执行真实数据查询。
 * 查询失败不影响后续生成（返回空产物）。
 */
async function runStepQuery(step: ExecutionStep): Promise<StepQueryOutcome> {
  const tool = inferQueryTool(step);
  if (!tool) return {};

  const filter = readStepFilter(step);
  try {
    const qr = await interceptDataQuery(tool, filter);
    const injected = formatQueryResultForLLM(qr).slice(0, QUERY_INJECT_LIMIT);
    const hit = qr.total ?? qr.displayRows.length;
    const summary =
      tool === 'get_stats'
        ? (qr.summary ?? '')
        : `已查询本地数据（${tool}），命中 ${hit} 条。`;
    // 卡片只带 tool + filter：DataQueryCard 自己调 interceptDataQuery 真实渲染
    return { card: { type: 'data_query', tool, filter }, injected, summary };
  } catch (err) {
    console.error('[executeStep] 数据查询失败：', err);
    return {};
  }
}

/**
 * 执行单个步骤。
 * @param plan 所属计划（create_* 说明文本引用）
 * @param step 待执行步骤
 * @param opts.blogs 当前会话已选博客 id（skill 步骤 {{blogs}} 注入用）
 */
export async function executeStep(
  plan: AIPlan,
  step: ExecutionStep,
  opts: { blogs?: ID[] } = {},
): Promise<ExecuteStepOutcome> {
  const type = step.type ?? 'custom';
  const cards: ActionCard[] = [];

  try {
    // create_* 类：只输出执行说明，不写系统（等用户确认后走既有 handler）
    if (type === 'create_blog' || type === 'create_template' || type === 'create_plan') {
      return {
        result: `【${step.title}】此步骤为内容创建类操作，将在确认后写入系统（当前未执行）。所属计划：${plan.title}`,
        cards,
      };
    }

    // skill 类：走 S 模块技能引用
    if (type === 'skill') {
      const { prompt, skillName } = await buildSkillPrompt(step, opts);
      const result = await streamText(prompt);
      return {
        result: result.trim() || `技能「${skillName}」执行完成，但未返回内容。`,
        cards,
      };
    }

    // query / summarize / custom：先真查数据，再把真实结果交给 AI 生成
    const query = await runStepQuery(step);
    if (query.card) cards.push(query.card);

    const parts = [step.title, step.description ?? ''];
    if (query.injected) {
      parts.push('以下是本应用中的真实数据，请严格基于它作答，不要编造：');
      parts.push(query.injected);
    }
    const prompt = parts.filter(Boolean).join('\n').trim();

    try {
      const result = await streamText(prompt);
      const text = result.trim();
      if (text) return { result: text, cards };
      return { result: query.summary || '该步骤执行完成，但未返回内容。', cards };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 查询已成功时不算整步失败：保留真实数据卡片 + 说明 AI 未执行
      if (query.summary) {
        return { result: `${query.summary}\n\n（AI 生成未执行：${msg}）`, cards };
      }
      return { result: `执行失败：${msg}`, cards };
    }
  } catch (err) {
    return { result: `执行失败：${err instanceof Error ? err.message : String(err)}`, cards };
  }
}
