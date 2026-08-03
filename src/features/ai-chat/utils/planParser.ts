/**
 * PlanMode 计划解析器（v1.3-fix F3 · D1 三级降级）
 *
 * 纯函数、无 IO，负责把 AI 回复（tool_call 块 / 裸 JSON 片段）归一化为 AIPlan：
 * - normalizePlanInput：把任意 { title, description, steps } 归一化为合法 AIPlan
 * - buildFallbackPlan：解析失败时生成 3 步可编辑模板
 * - parseExecutionPlanFromText：三级降级主入口
 *
 * 归一化容错（架构 §7.4）：
 * - 缺 steps / 空数组 → throw
 * - 非法 step（无 title）→ 丢弃
 * - step.type 缺省 / 非法 → 'custom'
 * - step.id = newId()、status = 'todo'
 */

import { newId } from '@/lib/id';
import { parseToolCalls } from './toolCallParser';
import type { AIPlan, ExecutionStep, ExecutionStepType } from '@/types/domain';

const now = (): string => new Date().toISOString();

/** type 白名单（架构 §7.4）。 */
const STEP_TYPE_WHITELIST: readonly ExecutionStepType[] = [
  'query',
  'summarize',
  'create_blog',
  'create_template',
  'create_plan',
  'skill',
  'custom',
];

/** 校验单个 step；非法（无 title）返回 null 丢弃。 */
function normalizeStep(raw: Record<string, unknown>): ExecutionStep | null {
  const rawTitle = raw.title;
  if (typeof rawTitle !== 'string' || !rawTitle.trim()) return null;

  const rawType = raw.type;
  const type: ExecutionStepType =
    typeof rawType === 'string' &&
    (STEP_TYPE_WHITELIST as readonly string[]).includes(rawType)
      ? (rawType as ExecutionStepType)
      : 'custom';

  const rawToolData = raw.toolData;
  const toolData =
    rawToolData && typeof rawToolData === 'object' && !Array.isArray(rawToolData)
      ? (rawToolData as Record<string, unknown>)
      : undefined;

  return {
    id: newId(),
    title: rawTitle.trim(),
    description:
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : undefined,
    status: 'todo',
    type,
    toolData,
  };
}

/**
 * 把 AI 产出的原始计划结构归一化为 AIPlan。
 * @throws 当 steps 缺失 / 为空 / 全部非法时抛错（触发上层降级）
 */
export function normalizePlanInput(raw: Record<string, unknown>, goal: string): AIPlan {
  const rawSteps = raw.steps;
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    throw new Error('steps 缺失或为空');
  }

  const steps: ExecutionStep[] = [];
  for (const s of rawSteps) {
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      const step = normalizeStep(s as Record<string, unknown>);
      if (step) steps.push(step);
    }
  }
  if (steps.length === 0) {
    throw new Error('steps 均不合法');
  }

  const ts = now();
  const rawTitle = raw.title;
  return {
    id: newId(),
    title:
      typeof rawTitle === 'string' && rawTitle.trim()
        ? rawTitle.trim()
        : goal.slice(0, 30),
    description:
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : undefined,
    steps,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * 兜底 B：解析失败时生成 3 步可编辑模板（标题 = goal 截断 30 字）。
 * 仍返回合法 AIPlan，保证 UI 一定能渲染 execution_plan 卡片。
 */
export function buildFallbackPlan(goal: string): AIPlan {
  const ts = now();
  const clean = goal.trim() || '未命名计划';
  const steps: ExecutionStep[] = [
    {
      id: newId(),
      title: '分析需求背景与现有数据',
      type: 'query',
      description: '读取系统中与需求相关的博客/计划数据',
      status: 'todo',
    },
    {
      id: newId(),
      title: '整理要点并生成内容框架',
      type: 'custom',
      description: '基于上一步数据组织结构',
      status: 'todo',
    },
    {
      id: newId(),
      title: '输出最终成果预览',
      type: 'create_blog',
      description: '生成内容预览供确认',
      status: 'todo',
    },
  ];
  return {
    id: newId(),
    title: clean.slice(0, 30),
    steps,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * 三级降级解析主入口：
 * 1. 主路径：parseToolCalls 找 tool === 'execution_plan' 的块 → normalizePlanInput
 * 2. 兜底 A：正则 /\{[\s\S]*?"steps"[\s\S]*?\}/ 提取 JSON → JSON.parse → normalizePlanInput
 * 3. 兜底 B：buildFallbackPlan（plan 一定非 null，parseErrors 带说明）
 */
export function parseExecutionPlanFromText(
  text: string,
  goal: string,
): { plan: AIPlan | null; raw: string; parseErrors: string[] } {
  const parseErrors: string[] = [];

  // 1. 主路径：复用 parseToolCalls
  const parsed = parseToolCalls(text);
  for (const tc of parsed.toolCalls) {
    if (tc.tool === 'execution_plan') {
      try {
        const plan = normalizePlanInput(tc.data ?? {}, goal);
        return { plan, raw: text, parseErrors };
      } catch (e) {
        parseErrors.push(
          `execution_plan tool_call 解析失败：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // 2. 兜底 A：提取最外层 JSON（第一个 `{` 到最后一个 `}`）
  //    注意不能用 /\{[\s\S]*?"steps"[\s\S]*?\}/ 非贪婪匹配——steps 数组里第一个
  //    内层对象的 `}` 会提前截断，得到不完整 JSON 导致 JSON.parse 失败。
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      const data = JSON.parse(candidate);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const plan = normalizePlanInput(data as Record<string, unknown>, goal);
        return { plan, raw: text, parseErrors };
      }
    } catch (e) {
      parseErrors.push(`JSON 片段解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    parseErrors.push('未找到包含 steps 的 JSON 片段');
  }

  // 3. 兜底 B：可编辑模板
  parseErrors.push('AI 输出无法解析，已降级为可编辑模板');
  return { plan: buildFallbackPlan(goal), raw: text, parseErrors };
}
