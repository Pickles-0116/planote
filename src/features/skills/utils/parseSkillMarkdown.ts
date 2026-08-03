/**
 * parseSkillMarkdown.ts · F2 Markdown 导入解析器
 *
 * 手写轻量 frontmatter 解析（字段白名单 + 受控格式，不引入 yaml 依赖）。
 * 支持：
 *   - 单文件多条，按独立成行的 `---` 分隔
 *   - `key: value` 顶层字段（值可带单/双引号，行尾 ` # 注释` 剥离）
 *   - `params:` 单层列表（缩进 + `- key: value`）
 *   - 正文整体作为 promptTemplate
 *
 * 缺省：type → 'custom'；folder → '全部技能'；description → undefined；params → []
 * 字段白名单：name/type/folder/description/params
 */

export interface ParsedSkillRecord {
  /** 已填默认值的原始记录（尚未经 validateSkillRecord / fromExportSkill）。 */
  raw: Record<string, unknown>;
  /** 记录序号（0-based，错误定位用，展示时 +1）。 */
  index: number;
}

export interface ParseError {
  index: number;
  message: string;
}

const ALLOWED_KEYS = ['name', 'type', 'folder', 'description', 'params'];
export const DEFAULT_FOLDER_NAME = '全部技能';

export function parseSkillMarkdown(text: string): { records: ParsedSkillRecord[]; errors: ParseError[] } {
  const records: ParsedSkillRecord[] = [];
  const errors: ParseError[] = [];

  const normalized = String(text).replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  if (normalized.trim() === '') return { records, errors };

  // 按独立成行的 --- 切块：[fm1, body1, fm2, body2, ...]（开头 --- 前内容进 parts[0]）
  const parts = normalized.split(/^---[ \t]*$/m);

  if (parts[0] && parts[0].trim() !== '') {
    errors.push({ index: 0, message: '文件开头存在非空内容，但未以 --- frontmatter 起始符包裹' });
  }

  let recordNo = 0;
  for (let i = 1; i < parts.length; i += 2) {
    const fmText = parts[i] ?? '';
    const bodyText = i + 1 < parts.length ? parts[i + 1] ?? '' : '';

    if (fmText.trim() === '' && bodyText.trim() === '') {
      // 悬空的 --- 分隔（末尾多余或连续），不生成记录
      continue;
    }
    if (fmText.trim() === '') {
      errors.push({ index: recordNo, message: '缺少 frontmatter（--- 与 --- 之间没有字段）' });
      recordNo++;
      continue;
    }

    const raw = parseFrontmatter(fmText, bodyText);
    records.push({ raw, index: recordNo });
    recordNo++;
  }

  return { records, errors };
}

/** 解析一块 frontmatter 文本 + 正文，产出填好默认值的 raw 记录。 */
function parseFrontmatter(fmText: string, bodyText: string): Record<string, unknown> {
  const fm = parseFrontmatterLines(fmText);

  const raw: Record<string, unknown> = {
    name: typeof fm.name === 'string' && fm.name.trim() !== '' ? fm.name.trim() : undefined,
    type: fm.type ?? 'custom',
    folder: fm.folder ?? DEFAULT_FOLDER_NAME,
    description: typeof fm.description === 'string' && fm.description.trim() !== ''
      ? fm.description.trim()
      : undefined,
    params: Array.isArray(fm.params) ? fm.params : [],
    promptTemplate: bodyText.trim(),
  };
  return raw;
}

function parseFrontmatterLines(fmText: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = fmText.split('\n');

  let activeList: Record<string, unknown>[] | null = null;
  let currentItem: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // 列表项：`  - key: value`（缩进 + 连字符）
    const itemMatch = line.match(/^\s+-\s+(.+)$/);
    if (itemMatch && activeList) {
      const kv = parseKV(itemMatch[1]);
      if (kv) {
        currentItem = {};
        currentItem[kv.key] = kv.value;
        activeList.push(currentItem);
      }
      continue;
    }

    // 列表项内的子字段：`    key: value`（缩进大于顶层，仅列表上下文中）
    const listFieldMatch = line.match(/^(\s{2,})([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (listFieldMatch && activeList && currentItem) {
      const kv = parseKV(listFieldMatch[2], listFieldMatch[3]);
      if (kv) currentItem[kv.key] = kv.value;
      continue;
    }

    // 顶层字段：`key: value` 或 `key:`（开启列表）
    const topMatch = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (topMatch) {
      const kv = parseKV(topMatch[1], topMatch[2]);
      if (!kv) continue;
      if (kv.value === undefined) {
        // 无值 → 进入列表模式（仅 params 使用）
        activeList = [];
        currentItem = null;
        out[kv.key] = activeList;
      } else {
        activeList = null;
        currentItem = null;
        out[kv.key] = kv.value;
      }
      continue;
    }

    // 未知行：静默忽略（frontmatter 容忍脏行）
  }

  // 字段白名单收口：只保留允许的字段
  const kept: Record<string, unknown> = {};
  for (const k of ALLOWED_KEYS) {
    if (out[k] !== undefined) kept[k] = out[k];
  }
  return kept;
}

/** 剥离引号与行尾注释，返回清洗后的 value 字符串。 */
function cleanValue(valueStr: string): string {
  let v = valueStr;
  if (v.startsWith('"') || v.startsWith("'")) {
    const quote = v[0];
    const close = v.slice(1).indexOf(quote);
    if (close >= 0) {
      v = v.slice(1, 1 + close);
    } else {
      v = v.slice(1);
    }
  } else {
    // 行尾注释：`value  # comment`（# 前有空格）
    const hashIdx = v.indexOf(' #');
    if (hashIdx > 0) v = v.slice(0, hashIdx).trim();
  }
  return v;
}

/** 解析 `key: value`（单引号/双引号剥离 + 行尾注释剥离）。 */
function parseKV(rawLine: string, rawValue?: string): { key: string; value: unknown } | null {
  if (rawValue !== undefined) {
    // 调用方已拆好 key/value（parseFrontmatterLines 的顶层与列表字段分支，
    // 此时 rawLine 是纯 key、不含冒号，不能走下方的冒号正则）。
    const key = rawLine.trim();
    if (!key) return null;
    const valueStr = String(rawValue).trim();
    if (valueStr === '') return { key, value: undefined };
    return { key, value: cleanValue(valueStr) };
  }

  // 原逻辑：rawLine 是完整 "key: value" 行（列表项 `- key: value` 分支）
  const m = rawLine.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
  if (!m) return null;
  const key = m[1];
  const valueStr = m[2].trim();
  if (valueStr === '') return { key, value: undefined };
  return { key, value: cleanValue(valueStr) };
}
