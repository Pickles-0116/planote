import { describe, it, expect } from 'vitest';
import { validateSkillRecord, VALID_SKILL_TYPES } from '../validateSkill';

describe('validateSkillRecord', () => {
  it('合法记录 → ok:true', () => {
    const result = validateSkillRecord({
      name: '周报总结',
      type: 'summary',
      promptTemplate: '请总结：{{text}}',
      params: [
        { key: 'text', label: '正文', type: 'textarea' },
        { key: 'maxWords', label: '字数', type: 'number', default: '200' },
      ],
    });
    expect(result).toEqual({ ok: true });
  });

  it('name 缺失 → 报错含「name」', () => {
    const result = validateSkillRecord({ type: 'summary' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('name');
  });

  it('name 为空字符串 → 报错含「name」', () => {
    const result = validateSkillRecord({ name: '   ', type: 'summary' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('name');
  });

  it('type 非法值 → 报错含「type」和合法值列表', () => {
    const result = validateSkillRecord({ name: 'x', type: 'translate_to_chinese' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('type');
      expect(result.message).toContain(VALID_SKILL_TYPES.join('/'));
    }
  });

  it('type 缺省 → 通过（归一化时取 custom）', () => {
    expect(validateSkillRecord({ name: 'x' })).toEqual({ ok: true });
  });

  it('params 非数组 → 报错含「params」', () => {
    const result = validateSkillRecord({ name: 'x', params: { key: 'a' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('params');
  });

  it('params 元素 key 非法（数字开头 1abc）→ 报错含「params[0].key」', () => {
    const result = validateSkillRecord({
      name: 'x',
      params: [{ key: '1abc', label: 'x', type: 'text' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('params[0].key');
      expect(result.message).toContain('1abc');
    }
  });

  it('params 元素 key 非法（含连字符 a-b）→ 报错含「params[0].key」', () => {
    const result = validateSkillRecord({
      name: 'x',
      params: [{ key: 'a-b', label: 'x', type: 'text' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('params[0].key');
  });

  it('params 元素缺 label → 报错含「label」', () => {
    const result = validateSkillRecord({
      name: 'x',
      params: [{ key: 'topic', type: 'text' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('label');
  });
});
