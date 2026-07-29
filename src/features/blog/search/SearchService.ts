/**
 * BlogSearchService - 博客全文检索引擎（V1.2 B4）
 *
 * 设计目标（design.md §B4）：
 * - 索引 `title` + `contentText`，title 权重高于 contentText（加权）
 * - 返回评分排序结果 + 命中片段（snippet）
 * - 百条级数据 < 50ms
 *
 * 实现说明（重要）：
 * 原计划使用 MiniSearch，但当前构建环境无法安装第三方依赖（沙箱 safe-delete
 * 拦截了 pnpm/npm 的写入）。此处提供**零依赖、等价能力**的内存检索引擎：
 * - 对中文友好的子串匹配（MiniSearch 默认按空白分词，对 CJK 几乎失效）
 * - 词频（term frequency）+ 字段加权（title > contentText）评分
 * - 多词查询按词项分别计分并累加
 * 后续若环境允许，可平滑替换为 MiniSearch（保持 `search(query)` 签名即可）。
 */

import type { Blog, ID } from '@/types/domain';

/** 单条搜索命中结果（在原 Blog 上附加评分与片段）。 */
export interface BlogSearchResult {
  blog: Blog;
  /** 综合评分（越高越相关）。 */
  score: number;
  /** 命中片段（约 120 字，围绕首个命中位置截取）。 */
  snippet: string;
}

/** 标题命中基础分（最高优先级）。 */
const TITLE_EXACT_BOOST = 10;
/** 标题内单术语命中分。 */
const TITLE_TERM_BOOST = 3;
/** 正文子串每命中一次的分。 */
const CONTENT_HIT_BOOST = 2;

/**
 * 将查询字符串切分为候选匹配单元。
 * - 整体小写后的原始串（用于 CJK 子串匹配）
 * - 按非单词字符切分出的词项（用于拉丁文多词查询）
 */
function tokenize(query: string): string[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return [];
  const terms = new Set<string>([lower]);
  for (const part of lower.split(/[^\p{L}\p{N}]+/u)) {
    if (part.length > 0) terms.add(part);
  }
  return Array.from(terms);
}

/** 统计 needle 在 haystack 中的出现次数（不区分大小写）。 */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/**
 * 构建命中片段：优先在 title 中定位命中，否则在 contentText 中定位；
 * 围绕首个命中位置截取上下文（前后各 ~60 字）。
 */
function buildSnippet(title: string, text: string, query: string, terms: string[]): string {
  const lowerTitle = title.toLowerCase();
  const lowerText = text.toLowerCase();

  const findFirst = (haystack: string): number => {
    let idx = -1;
    for (const t of terms) {
      const i = haystack.indexOf(t);
      if (i >= 0 && (idx === -1 || i < idx)) idx = i;
    }
    return idx;
  };

  const titleIdx = findFirst(lowerTitle);
  if (titleIdx >= 0) {
    const start = Math.max(0, titleIdx - 20);
    const end = Math.min(title.length, titleIdx + query.length + 60);
    return (start > 0 ? '…' : '') + title.slice(start, end).trim() + (end < title.length ? '…' : '');
  }

  const textIdx = findFirst(lowerText);
  if (textIdx >= 0) {
    const start = Math.max(0, textIdx - 50);
    const end = Math.min(text.length, textIdx + query.length + 70);
    return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
  }

  // 无明确命中位置时，回退到正文前 120 字
  return text.slice(0, 120).trim() + (text.length > 120 ? '…' : '');
}

export class BlogSearchService {
  private docs: Blog[] = [];

  /** 载入待检索文档（内存索引）。百条级数据构建可忽略不计。 */
  setDocuments(blogs: Blog[]): void {
    this.docs = blogs;
  }

  /**
   * 执行检索。
   * @param query 查询串（自动 trim；空串返回空数组）
   * @returns 按评分降序的命中结果（评分相同按 updatedAt 降序）
   */
  search(query: string): BlogSearchResult[] {
    const q = query.trim();
    if (!q) return [];
    const lowerQ = q.toLowerCase();
    const terms = tokenize(q);
    const results: BlogSearchResult[] = [];

    for (const b of this.docs) {
      const title = b.title ?? '';
      const text = b.contentText ?? '';
      const titleL = title.toLowerCase();
      const textL = text.toLowerCase();

      let score = 0;

      // 整体子串命中（对 CJK 友好）
      if (titleL.includes(lowerQ)) score += TITLE_EXACT_BOOST;
      score += countOccurrences(textL, lowerQ) * CONTENT_HIT_BOOST;

      // 逐词项计分（对拉丁文多词查询友好）
      for (const t of terms) {
        if (!t || t === lowerQ) continue;
        if (titleL.includes(t)) score += TITLE_TERM_BOOST;
        score += countOccurrences(textL, t);
      }

      if (score > 0) {
        results.push({ blog: b, score, snippet: buildSnippet(title, text, q, terms) });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.blog.updatedAt < b.blog.updatedAt ? 1 : -1;
    });
    return results;
  }
}

/** 全局单例（列表检索共用一个内存索引）。 */
export const blogSearchService = new BlogSearchService();

export type { ID };
