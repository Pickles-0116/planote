import { describe, it, expect } from 'vitest';
import { parseToolCalls } from '../toolCallParser';
import { mapToolCallToActionCard } from '../toolCallMapper';
import { classifyIntent } from '../intentClassifier';

describe('parseToolCalls', () => {
  it('解析单个 tool_call 块', () => {
    const input = '好的，我来帮你创建计划：\n```tool_call\n{"tool":"create_plan","data":{"title":"Q3 OKR"}}\n```\n';
    const result = parseToolCalls(input);
    expect(result.toolCalls).toEqual([
      { tool: 'create_plan', data: { title: 'Q3 OKR' } },
    ]);
    expect(result.parseErrors).toEqual([]);
    expect(result.textContent).toBe('好的，我来帮你创建计划：');
  });

  it('无效 JSON 归入 parseErrors', () => {
    const input = '```tool_call\n{"tool":\n```';
    const result = parseToolCalls(input);
    expect(result.toolCalls).toEqual([]);
    expect(result.parseErrors).toHaveLength(1);
  });

  it('无 tool_call 时 textContent 与原文本一致', () => {
    const input = '你好';
    const result = parseToolCalls(input);
    expect(result.toolCalls).toEqual([]);
    expect(result.textContent).toBe('你好');
  });

  it('多个 tool_call 全部解析', () => {
    const input = '```tool_call\n{"tool":"create_plan","data":{"title":"A"}}\n```中间```tool_call\n{"tool":"create_blog","data":{"title":"B"}}\n```';
    const result = parseToolCalls(input);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].tool).toBe('create_plan');
    expect(result.toolCalls[1].tool).toBe('create_blog');
  });
});

describe('mapToolCallToActionCard', () => {
  it('create_plan → plan_preview', () => {
    const card = mapToolCallToActionCard({ tool: 'create_plan', data: { title: 'X' } });
    expect(card.type).toBe('plan_preview');
  });
  it('create_blog → blog_preview', () => {
    const card = mapToolCallToActionCard({ tool: 'create_blog', data: { title: 'X' } });
    expect(card.type).toBe('blog_preview');
  });
  it('create_template → template_preview', () => {
    const card = mapToolCallToActionCard({ tool: 'create_template', data: { name: 'X' } });
    expect(card.type).toBe('template_preview');
  });
  it('get_plans → data_query', () => {
    const card = mapToolCallToActionCard({ tool: 'get_plans', data: { status: 'doing' } });
    expect(card.type).toBe('data_query');
    if (card.type === 'data_query') expect(card.tool).toBe('get_plans');
  });
  it('未知 tool → unknown', () => {
    const card = mapToolCallToActionCard({ tool: 'delete_everything', data: {} });
    expect(card.type).toBe('unknown');
  });
});

describe('classifyIntent', () => {
  it('从 <intent> 标签提取', () => {
    expect(classifyIntent('<intent>create_plan</intent>\n好的', '随便')).toBe('create_plan');
  });
  it('关键词 fallback', () => {
    expect(classifyIntent('好的', '帮我建一个计划')).toBe('create_plan');
  });
  it('默认 chat', () => {
    expect(classifyIntent('你好', '在吗')).toBe('chat');
  });
});