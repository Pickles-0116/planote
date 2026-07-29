/**
 * 意图分类器
 *
 * 优先从 AI 回复中提取 `<intent>...</intent>` 标记；缺失时用关键词 fallback。
 *
 * 来源：openspec/changes/ai-chat-intent-routing/design.md 决策 3。
 */

import type { ChatIntent } from '@/types/domain';

const INTENT_PATTERN = /<intent>\s*(create_plan|create_blog|create_template|query|chat)\s*<\/intent>/i;

/** 关键词 → 意图映射（按从具体到通用排序）。 */
const KEYWORD_MAP: Array<{ keywords: string[]; intent: ChatIntent }> = [
  { keywords: ['建一个模板', '设计模板', '创建模板', '做个模板'], intent: 'create_template' },
  { keywords: ['写博客', '写一篇', '开始写', '撰写'], intent: 'create_blog' },
  { keywords: ['建一个计划', '创建计划', '新建计划', '设定目标', '设定计划'], intent: 'create_plan' },
  { keywords: ['有哪些', '查一下', '查询', '看看我的', '统计', '完成率', '总数'], intent: 'query' },
];

/**
 * 分类意图。
 * @param aiReply AI 完整回复（含 `<intent>` 标记）
 * @param userMessage 用户消息（fallback 用）
 */
export function classifyIntent(aiReply: string, userMessage: string): ChatIntent {
  // 1. 优先从回复前 200 字符找 intent 标记
  const head = aiReply.slice(0, 200);
  const match = head.match(INTENT_PATTERN);
  if (match) {
    return match[1].toLowerCase() as ChatIntent;
  }

  // 2. 关键词 fallback（userMessage）
  for (const { keywords, intent } of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (userMessage.includes(kw)) return intent;
    }
  }

  // 3. 默认 chat
  return 'chat';
}