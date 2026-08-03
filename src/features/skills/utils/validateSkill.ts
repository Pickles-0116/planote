/**
 * validateSkill.ts · F5 schema 校验（导入前置校验器）
 *
 * 在 `fromExportSkill` 归一化**之前**执行：坏数据（name 缺失 / type 非法 /
 * params 非数组 / promptTemplate 非字符串）在此被原子拦截，错误可定位到「第 n 条」，
 * 不污染技能列表。
 *
 * 红线：不改 `fromExportSkill`，校验放在它之前。
 */

import type { SkillType, SkillParam } from '@/types/domain';

export const VALID_SKILL_TYPES: readonly SkillType[] = [
  'summary',
  'writing',
  'imitate',
  'translate',
  'custom',
];

const VALID_PARAM_TYPES = ['text', 'textarea', 'number', 'select'] as const;
const VALID_PARAM_KEY = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export type ValidateResult = { ok: true } | { ok: false; message: string };

/**
 * 校验一条导入记录（原始 Record 形态，尚未归一化）。
 * - name 非空 string
 * - type ∈ SkillType 枚举（缺省时也通过，后续归一化取 'custom'）
 * - params 为 undefined 或 SkillParam[]（key 匹配 /^[a-zA-Z][a-zA-Z0-9_]*$/、label string、type ∈ text|textarea|number|select）
 * - promptTemplate 为 string
 */
export function validateSkillRecord(raw: Record<string, unknown>): ValidateResult {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, message: '记录不是对象' };
  }

  const { name, type, params, promptTemplate } = raw;

  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, message: `name 非法：${describe(name)}（必须为非空字符串）` };
  }

  if (type !== undefined && type !== null) {
    if (typeof type !== 'string') {
      return { ok: false, message: `type 非法：${describe(type)}（必须为字符串）` };
    }
    if (!(VALID_SKILL_TYPES as readonly string[]).includes(type)) {
      return {
        ok: false,
        message: `type 非法：'${type}'（合法值：${VALID_SKILL_TYPES.join('/')}）`,
      };
    }
  }

  if (params !== undefined && params !== null) {
    const paramCheck = validateParams(params);
    if (!paramCheck.ok) return paramCheck;
  }

  if (promptTemplate !== undefined && promptTemplate !== null) {
    if (typeof promptTemplate !== 'string') {
      return { ok: false, message: `promptTemplate 非法：${describe(promptTemplate)}（必须为字符串）` };
    }
  }

  return { ok: true };
}

function validateParams(params: unknown): ValidateResult {
  if (!Array.isArray(params)) {
    return { ok: false, message: `params 非法：${describe(params)}（必须为数组）` };
  }
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === null || typeof p !== 'object') {
      return { ok: false, message: `params[${i}] 非法：${describe(p)}（必须为对象）` };
    }
    const rec = p as Record<string, unknown>;
    if (typeof rec.key !== 'string' || !VALID_PARAM_KEY.test(rec.key)) {
      return {
        ok: false,
        message: `params[${i}].key 非法：${describe(rec.key)}（必须匹配 /^[a-zA-Z][a-zA-Z0-9_]*$/）`,
      };
    }
    if (typeof rec.label !== 'string') {
      return { ok: false, message: `params[${i}].label 非法：${describe(rec.label)}（必须为字符串）` };
    }
    if (rec.type !== undefined && rec.type !== null) {
      if (typeof rec.type !== 'string' || !(VALID_PARAM_TYPES as readonly string[]).includes(rec.type)) {
        return {
          ok: false,
          message: `params[${i}].type 非法：${describe(rec.type)}（合法值：${VALID_PARAM_TYPES.join('/')}）`,
        };
      }
    }
    // default 可缺省；缺省时由 fromExportSkill / SkillParam 约定处理
  }
  return { ok: true };
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    return v === '' ? '空字符串' : `'${v}'`;
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** 供 UI 校验器复用：校验 SkillParam 是否合法（与导入校验同一套规则）。 */
export function validateSkillParam(p: SkillParam): string | null {
  if (typeof p.key !== 'string' || !VALID_PARAM_KEY.test(p.key)) {
    return `key 非法：${describe(p.key)}（必须匹配 /^[a-zA-Z][a-zA-Z0-9_]*$/）`;
  }
  if (typeof p.label !== 'string') {
    return `label 非法：${describe(p.label)}（必须为字符串）`;
  }
  if (!(VALID_PARAM_TYPES as readonly string[]).includes(p.type)) {
    return `type 非法：${describe(p.type)}（合法值：${VALID_PARAM_TYPES.join('/')}）`;
  }
  return null;
}
