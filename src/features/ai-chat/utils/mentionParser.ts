/**
 * mentionParser · 解析一条消息里所有 `@plan xxx` / `@skill xxx` 引用
 *
 * 支持一条消息内多个引用、@plan 与 @skill 连用（如 `@plan 月报 @skill SEO 写月报`）。
 * 引用名称按「单词（不含空格）」截取（标准 @mention 语法），遇到下一个 @ 引用或空格即结束；
 * 引用之后的普通文本作为「需求/内容」保留。
 *
 * 说明：技能/计划名称若本身含空格，会被当作首个词截取（如 `@skill 月度 总结` → 名称「月度」），
 * 这是自由文本 mention 语法无定界符的固有取舍；下拉选择插入的名称多为无空格标识，可正常解析。
 */

export type MentionKind = 'plan' | 'skill';

export interface ParsedMention {
  kind: MentionKind;
  /** 已 trim 的关键词（计划标题 / 技能名称，单 token）。 */
  keyword: string;
}

/** 全局正则：匹配 `@(plan|skill) 名称`（名称为不含空格的单词）。 */
export const MENTION_RE = /@(plan|skill)\s+(\S+)/g;

/** 提取一条消息里的所有 @plan / @skill 引用（按出现顺序）。 */
export function parseMentions(raw: string): ParsedMention[] {
  return [...raw.matchAll(MENTION_RE)].map((m) => ({
    kind: m[1] as MentionKind,
    keyword: m[2].trim(),
  }));
}

/** 从消息中剥离所有 @plan/@skill 片段，返回剩余文本（已折叠空白并 trim）。 */
export function stripMentions(raw: string): string {
  let s = raw;
  for (const m of raw.matchAll(MENTION_RE)) {
    s = s.replace(m[0], ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}
