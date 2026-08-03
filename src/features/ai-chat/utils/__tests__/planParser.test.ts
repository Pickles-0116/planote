import { describe, it, expect } from 'vitest';
import {
  normalizePlanInput,
  buildFallbackPlan,
  parseExecutionPlanFromText,
} from '../planParser';

describe('normalizePlanInput', () => {
  it('合法 steps → 每步有 id 且 status=todo', () => {
    const plan = normalizePlanInput(
      {
        title: 'Q3 复盘',
        description: '季度复盘计划',
        steps: [
          { title: '读取博客数据', type: 'query', description: '读数据' },
          { title: '生成总结' },
        ],
      },
      '目标',
    );

    expect(plan.title).toBe('Q3 复盘');
    expect(plan.description).toBe('季度复盘计划');
    expect(plan.steps).toHaveLength(2);
    for (const step of plan.steps) {
      expect(typeof step.id).toBe('string');
      expect(step.id.length).toBeGreaterThan(0);
      expect(step.status).toBe('todo');
    }
  });

  it('type 缺省 → custom', () => {
    const plan = normalizePlanInput({ steps: [{ title: '无类型步骤' }] }, '目标');
    expect(plan.steps[0].type).toBe('custom');
  });

  it('type 非法值 → custom', () => {
    const plan = normalizePlanInput(
      { steps: [{ title: '非法类型', type: 'delete_everything' }] },
      '目标',
    );
    expect(plan.steps[0].type).toBe('custom');
  });

  it('title 缺失/空白的 step 被丢弃', () => {
    const plan = normalizePlanInput(
      {
        steps: [
          { title: '合法步骤' },
          { title: '' },
          { title: '   ' },
          { noTitle: true },
        ],
      },
      '目标',
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].title).toBe('合法步骤');
  });

  it('steps 缺失 → throw', () => {
    expect(() => normalizePlanInput({ title: '无步骤' }, '目标')).toThrow();
  });

  it('steps 为空数组 → throw', () => {
    expect(() => normalizePlanInput({ steps: [] }, '目标')).toThrow();
  });

  it('steps 全部非法 → throw', () => {
    expect(() =>
      normalizePlanInput({ steps: [{ title: '  ' }, {}] }, '目标'),
    ).toThrow();
  });

  it('title 缺失 → 用 goal 截断 30 字', () => {
    const longGoal = '这是一个非常非常非常非常非常非常非常长的目标描述用于测试标题截断';
    const plan = normalizePlanInput({ steps: [{ title: '步骤' }] }, longGoal);
    expect(plan.title).toBe(longGoal.slice(0, 30));
    expect(plan.title.length).toBeLessThanOrEqual(30);
  });
});

describe('buildFallbackPlan', () => {
  it('返回 3 步', () => {
    const plan = buildFallbackPlan('写一篇周报');
    expect(plan.steps).toHaveLength(3);
  });

  it('title = goal 截断 30 字', () => {
    const longGoal = '这是一个非常非常非常非常非常非常非常长的目标描述用于测试标题截断';
    const plan = buildFallbackPlan(longGoal);
    expect(plan.title).toBe(longGoal.slice(0, 30));
    expect(plan.title.length).toBeLessThanOrEqual(30);
  });

  it('steps 非空且每步合法', () => {
    const plan = buildFallbackPlan('写一篇周报');
    expect(plan.steps.length).toBeGreaterThan(0);
    for (const step of plan.steps) {
      expect(step.title).toBeTruthy();
      expect(typeof step.id).toBe('string');
      expect(step.status).toBe('todo');
    }
    expect(plan.createdAt).toBeTruthy();
    expect(plan.updatedAt).toBeTruthy();
  });
});

describe('parseExecutionPlanFromText 三级降级', () => {
  it('主路径：tool_call 块解析成功', () => {
    const text = `好的，计划如下：
\`\`\`tool_call
{"tool":"execution_plan","data":{"title":"Q3 复盘","steps":[{"title":"读取数据","type":"query"},{"title":"输出总结"}]}}
\`\`\`
请确认是否执行。`;

    const { plan, parseErrors } = parseExecutionPlanFromText(text, '帮我复盘 Q3');
    expect(plan).not.toBeNull();
    expect(parseErrors).toEqual([]);
    expect(plan!.title).toBe('Q3 复盘');
    expect(plan!.steps).toHaveLength(2);
  });

  it('兜底 A：无 tool_call 但有 JSON 片段（含 steps）', () => {
    const text = `我生成了一个计划：{"title":"阅读计划","steps":[{"title":"读第一章"},{"title":"做笔记"}]} 请查收。`;

    const { plan, parseErrors } = parseExecutionPlanFromText(text, '帮我制定阅读计划');
    expect(plan).not.toBeNull();
    expect(plan!.title).toBe('阅读计划');
    expect(plan!.steps).toHaveLength(2);
    expect(parseErrors).toEqual([]);
  });

  it('兜底 B：乱文本 → plan 非 null + parseErrors 非空', () => {
    const text = '你好呀，这里是无法解析的乱文本，没有 JSON 也没有 tool_call。';

    const { plan, parseErrors } = parseExecutionPlanFromText(text, '随便的目标');
    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBeGreaterThan(0);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parseErrors[parseErrors.length - 1]).toContain('降级');
  });
});
