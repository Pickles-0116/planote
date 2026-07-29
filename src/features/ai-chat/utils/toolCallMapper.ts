/**
 * Tool Call → ActionCard 映射
 *
 * 来源：openspec/changes/ai-chat-intent-routing/design.md 决策 + ai-chat-smart-qa。
 */

import type { ToolCall } from './toolCallParser';
import type { ActionCard } from '@/types/domain';

/**
 * 把 ToolCall 映射为 ActionCard。未知 tool / parse 错误 → 'unknown' 类型。
 */
export function mapToolCallToActionCard(tc: ToolCall): ActionCard {
  switch (tc.tool) {
    case 'create_plan':
      return {
        type: 'plan_preview',
        data: tc.data as ActionCard extends { type: 'plan_preview'; data: infer D } ? D : never,
      };
    case 'create_blog':
      return {
        type: 'blog_preview',
        data: tc.data as ActionCard extends { type: 'blog_preview'; data: infer D } ? D : never,
      };
    case 'create_template':
      return {
        type: 'template_preview',
        data: tc.data as ActionCard extends { type: 'template_preview'; data: infer D } ? D : never,
      };
    case 'get_plans':
    case 'get_blogs':
    case 'get_templates':
    case 'get_stats':
      return {
        type: 'data_query',
        tool: tc.tool,
        filter: tc.data as Record<string, unknown> | undefined,
      };
    case 'suggest':
      return {
        type: 'suggestion',
        data: tc.data as ActionCard extends { type: 'suggestion'; data: infer D } ? D : never,
      };
    default:
      return {
        type: 'unknown',
        rawTool: tc.tool,
        rawData: tc.data,
      };
  }
}