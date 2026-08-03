/**
 * generateExecutionPlan · /plan AI 流式生成全流程（v1.3-fix F3 · D1）
 *
 * 流程：
 * 1. useAIModelStore.getState() 取默认 profile（F4 模式：不闭包捕获 store）
 * 2. getAdapter(provider).generateStream([PLAN_MODE_SYSTEM_PROMPT, 用户需求], { onChunk 收 thinking })
 * 3. 流式累积正文 → parseExecutionPlanFromText 三级降级解析
 * 4. 返回 { plan, raw, thinking, fallback }
 *
 * 独立成函数（不修改 useAIChat.send），便于单测与 /plan 命令直接调用。
 */

import { getAdapter } from '@/features/ai/adapters';
import { useAIModelStore } from '@/features/ai/stores/aiModelStore';
import { PLAN_MODE_SYSTEM_PROMPT } from '../prompts/chatSystemPrompt';
import { parseExecutionPlanFromText } from './planParser';
import { splitThinking, mergeThinking } from './thinkingExtractor';
import type { AIPlan } from '@/types/domain';

export interface PlanSkillContext {
  /** 被引用的技能名称（仅用于 system 提示标注）。 */
  name: string;
  /** 已用默认值填充参数的技能 promptTemplate。 */
  template: string;
}

export interface GenerateExecutionPlanResult {
  plan: AIPlan;
  /** AI 回复正文（含 tool_call 块原文，供调试/回显）。 */
  raw: string;
  /** 思考过程累积（thinking 旁路，不进入正文）。 */
  thinking: string;
  /** 是否走了兜底（解析失败降级为可编辑模板）。 */
  fallback: boolean;
}

/**
 * 生成执行计划。
 * @param goal 规划需求
 * @param skillContext 可选，Plan 模式下引用的技能方法论上下文。
 *        传入后会在 PLAN_MODE_SYSTEM_PROMPT 之后追加一条 system 消息，
 *        让 AI 按该技能模板的方法论/结构拆解计划步骤。
 * @throws 未配置 AI 模型时抛 '请先在设置中配置 AI 模型'
 */
export async function generateExecutionPlan(
  goal: string,
  skillContext?: PlanSkillContext,
): Promise<GenerateExecutionPlanResult> {
  const { getDefaultProfile, getDecodedApiKey } = useAIModelStore.getState();
  const profile = getDefaultProfile();
  if (!profile) {
    throw new Error('请先在设置中配置 AI 模型');
  }

  const apiKey = getDecodedApiKey(profile.id);
  const adapter = getAdapter(profile.provider);
  const controller = new AbortController();

  let thinkingAccum = '';
  let accumulated = '';

  // Plan 模式引用的技能方法论上下文：注入为 PLAN_MODE_SYSTEM_PROMPT 之后的第二条 system
  const systemMessages: { role: 'system'; content: string }[] = [
    { role: 'system', content: PLAN_MODE_SYSTEM_PROMPT },
  ];
  if (skillContext && skillContext.template.trim()) {
    systemMessages.push({
      role: 'system',
      content:
        `[技能方法论：${skillContext.name}]\n` +
        `请参照以下技能模板的方法论与结构来拆解上面的执行计划，使计划步骤与该技能的执行方式一致：\n\n` +
        skillContext.template,
    });
  }

  const stream = adapter.generateStream(
    [...systemMessages, { role: 'user', content: goal }],
    {
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      model: profile.model,
      signal: controller.signal,
      // D1：旁路收集思考过程（不进入正文）
      onChunk: (c) => {
        if (c?.thinking) thinkingAccum += c.thinking;
      },
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

  const { content: cleanContent, thinking: tagThinking } = splitThinking(accumulated);
  const { plan, parseErrors } = parseExecutionPlanFromText(cleanContent, goal);
  // 三级降级保证 plan 非 null（兜底 B 一定返回可编辑模板）
  return {
    plan: plan as AIPlan,
    raw: accumulated,
    thinking: mergeThinking(thinkingAccum, tagThinking),
    fallback: parseErrors.length > 0,
  };
}
