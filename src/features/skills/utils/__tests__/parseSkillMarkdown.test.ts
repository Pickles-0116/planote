import { describe, it, expect } from 'vitest';
import { parseSkillMarkdown, DEFAULT_FOLDER_NAME } from '../parseSkillMarkdown';

describe('parseSkillMarkdown', () => {
  it('单条 frontmatter + 正文 → 正确拆出 name/type/promptTemplate', () => {
    const md = `---
name: 周报总结
type: summary
---
请帮我总结本周工作，重点：{{text}}`;

    const { records, errors } = parseSkillMarkdown(md);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].index).toBe(0);
    expect(records[0].raw.name).toBe('周报总结');
    expect(records[0].raw.type).toBe('summary');
    expect(records[0].raw.promptTemplate).toBe('请帮我总结本周工作，重点：{{text}}');
  });

  it('多条（--- 分隔）→ 全部解析', () => {
    const md = `---
name: 技能A
---
正文A
---
name: 技能B
---
正文B`;

    const { records, errors } = parseSkillMarkdown(md);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(2);
    expect(records[0].raw.name).toBe('技能A');
    expect(records[0].raw.promptTemplate).toBe('正文A');
    expect(records[1].raw.name).toBe('技能B');
    expect(records[1].raw.promptTemplate).toBe('正文B');
  });

  it('缺 type → 默认 custom；缺 folder → 默认「全部技能」', () => {
    const md = `---
name: 自定义技能
---
正文`;

    const { records, errors } = parseSkillMarkdown(md);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].raw.type).toBe('custom');
    expect(records[0].raw.folder).toBe(DEFAULT_FOLDER_NAME);
    expect(records[0].raw.params).toEqual([]);
  });

  it('params 列表解析 → SkillParam[] 正确', () => {
    const md = `---
name: 带参数技能
params:
  - key: topic
    label: 主题
    type: text
  - key: length
    label: 字数
    type: number
---
正文`;

    const { records, errors } = parseSkillMarkdown(md);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    const params = records[0].raw.params as Array<Record<string, unknown>>;
    expect(params).toHaveLength(2);
    expect(params[0]).toEqual({ key: 'topic', label: '主题', type: 'text' });
    expect(params[1]).toEqual({ key: 'length', label: '字数', type: 'number' });
  });

  it('注释剥离（key: value # 注释）→ value 正确', () => {
    const md = `---
name: 注释技能 # 这是技能名
type: custom # 类型
---
正文`;

    const { records, errors } = parseSkillMarkdown(md);
    expect(errors).toEqual([]);
    expect(records[0].raw.name).toBe('注释技能');
    expect(records[0].raw.type).toBe('custom');
  });

  it('正文为空 → promptTemplate 为空字符串', () => {
    const md = `---
name: 无正文技能
---`;

    const { records } = parseSkillMarkdown(md);
    expect(records).toHaveLength(1);
    expect(records[0].raw.promptTemplate).toBe('');
  });
});
