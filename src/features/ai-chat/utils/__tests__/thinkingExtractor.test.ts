import { describe, it, expect } from 'vitest';
import { splitThinking, createThinkingStream, mergeThinking } from '../thinkingExtractor';

describe('thinkingExtractor', () => {
  it('无标签时 content 原样、thinking 为空', () => {
    const raw = '这是一段普通回复。';
    const res = splitThinking(raw);
    expect(res.content).toBe(raw);
    expect(res.thinking).toBe('');
    expect(res.unclosed).toBe(false);
  });

  it('单段 thinking 正确分离', () => {
    const raw = '结论：<thinking>我需要先分析意图。</thinking>最终答案是 42。';
    const res = splitThinking(raw);
    expect(res.content).toBe('结论：最终答案是 42。');
    expect(res.thinking).toBe('我需要先分析意图。');
    expect(res.unclosed).toBe(false);
  });

  it('多段 thinking 用换行拼接', () => {
    const raw = 'A<thinking>思考1</thinking>B<thinking>思考2</thinking>C';
    const res = splitThinking(raw);
    expect(res.content).toBe('ABC');
    expect(res.thinking).toBe('思考1\n\n思考2');
  });

  it('未闭合 thinking 全部计入 thinking', () => {
    const raw = '可见内容<thinking>未闭合的推理';
    const res = splitThinking(raw);
    expect(res.content).toBe('可见内容');
    expect(res.thinking).toBe('未闭合的推理');
    expect(res.unclosed).toBe(true);
  });

  it('跨 chunk 切割不泄漏标签碎片', () => {
    const ts = createThinkingStream();
    const r1 = ts.push('可见内容<thi');
    expect(r1.content).toBe('可见内容');
    expect(r1.thinking).toBe('');

    const r2 = ts.push('nking>思考</thinking>');
    expect(r2.content).toBe('');
    expect(r2.thinking).toBe('思考');

    const r3 = ts.flush();
    expect(r3.content).toBe('可见内容');
    expect(r3.thinking).toBe('思考');
    expect(r3.unclosed).toBe(false);
  });

  it('大写 THINKING 与 think 别名均识别', () => {
    const raw = 'A<THINKING>大写</THINKING>B<think>别名</think>C';
    const res = splitThinking(raw);
    expect(res.content).toBe('ABC');
    expect(res.thinking).toBe('大写\n\n别名');
  });

  it('thinking 内含 tool_call 代码块不进入 content', () => {
    const raw = '结论：<thinking>```tool_call\n{}\n```</thinking>完成。';
    const res = splitThinking(raw);
    expect(res.content).toBe('结论：完成。');
    expect(res.thinking).toBe('```tool_call\n{}\n```');
  });

  it('mergeThinking 去重', () => {
    expect(mergeThinking('abc', 'abc')).toBe('abc');
    expect(mergeThinking('abc', 'bc')).toBe('abc');
    expect(mergeThinking('a', 'b')).toBe('a\n\nb');
    expect(mergeThinking('', 'x')).toBe('x');
  });

  it('流式未闭合 flush 标记 unclosed', () => {
    const ts = createThinkingStream();
    const pushed = ts.push('<thinking>还在想');
    expect(pushed.thinking).toBe('还在想');
    const flushed = ts.flush();
    expect(flushed.thinking).toBe('还在想');
    expect(flushed.unclosed).toBe(true);
    expect(flushed.content).toBe('');
  });
});
