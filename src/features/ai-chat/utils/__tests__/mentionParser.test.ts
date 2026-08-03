import { describe, it, expect } from 'vitest';
import { parseMentions, stripMentions, MENTION_RE } from '../mentionParser';

describe('mentionParser', () => {
  it('解析单个 @skill 引用', () => {
    expect(parseMentions('@skill 月度总结')).toEqual([{ kind: 'skill', keyword: '月度总结' }]);
  });

  it('解析单个 @plan 引用', () => {
    expect(parseMentions('@plan 我的月报')).toEqual([{ kind: 'plan', keyword: '我的月报' }]);
  });

  it('一条消息内 @plan 与 @skill 连用，剩余文本作为需求', () => {
    expect(parseMentions('@plan 月报 @skill SEO 写月报')).toEqual([
      { kind: 'plan', keyword: '月报' },
      { kind: 'skill', keyword: 'SEO' },
    ]);
    expect(stripMentions('@plan 月报 @skill SEO 写月报')).toBe('写月报');
  });

  it('多条 @skill 连用（取所有）', () => {
    expect(parseMentions('@skill A @skill B 做点事')).toEqual([
      { kind: 'skill', keyword: 'A' },
      { kind: 'skill', keyword: 'B' },
    ]);
  });

  it('名称按单 token 截取（名称含空格时取首个词）', () => {
    expect(parseMentions('@skill 月度 总结 写文章')).toEqual([{ kind: 'skill', keyword: '月度' }]);
    expect(stripMentions('@skill 月度 总结 写文章')).toBe('总结 写文章');
  });

  it('stripMentions 处理各种形态', () => {
    expect(stripMentions('写月报 @skill SEO')).toBe('写月报');
    expect(stripMentions('@skill SEO')).toBe('');
    expect(stripMentions('帮我写一篇月报')).toBe('帮我写一篇月报');
  });

  it('无引用时 parseMentions 返回空', () => {
    expect(parseMentions('帮我写一篇月报')).toEqual([]);
  });

  it('MENTION_RE 为全局正则，可重复 matchAll', () => {
    const a = 'x @skill A y @plan B'.matchAll(MENTION_RE);
    const b = 'x @skill A y @plan B'.matchAll(MENTION_RE);
    expect([...a].length).toBe(2);
    expect([...b].length).toBe(2);
  });
});
