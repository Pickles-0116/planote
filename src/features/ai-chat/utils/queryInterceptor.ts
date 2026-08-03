/**
 * queryInterceptor · 拦截 AI 的 get_* tool call
 *
 * 来源：openspec/changes/ai-chat-smart-qa/design.md 决策 1。
 *
 * v1.3 P0-2 修复：
 * 过去直接把 AI 给的 filter 原样丢给 `repo.list({ filter })`，而 repo 的过滤是
 * 「逐字段严格相等」的。只要 AI 给出一个非实体字段（`keyword` / `limit` / `folder`…）
 * 或一个 `$gte` 之类的操作符对象，严格相等必然不成立 → **全部记录被过滤掉**，
 * UI 上就表现为「没有匹配的数据」。
 *
 * 现在改为：repo 只负责取全量，过滤在本文件用一套容错规则完成——
 * 1. 只对「实体真实存在的字段」做匹配，无法识别的键忽略（记入 `ignoredKeys`，不清空结果）；
 * 2. `title` / `name` 等文本字段按「包含」而非「相等」匹配；
 * 3. 支持 `$in/$nin/$ne/$gt/$gte/$lt/$lte` 与数组简写；
 * 4. 支持 `keyword/q/search` 全文关键词、`since/until` 时间范围、`limit` 条数；
 * 5. 中文枚举值（草稿 / 已发布 / 进行中…）自动映射为内部值。
 * 原则：宁可多返回，也不要因为一个看不懂的条件把真实数据全部滤空。
 */

import { planRepo, blogRepo, blogTemplateRepo } from '@/db/repos';
import { computeAppStats } from './computeAppStats';

export type DataQueryTool = 'get_plans' | 'get_blogs' | 'get_templates' | 'get_stats';

export interface QueryResult {
  tool: DataQueryTool;
  /** JSON-serializable 结果（用于注入下一轮对话）。 */
  data: unknown;
  /** 用于 DataQueryCard 渲染的可读摘要。 */
  displayRows: Array<{ id: string; cells: Array<{ label: string; value: string; href?: string }> }>;
  /** 统计摘要（仅 get_stats 用）。 */
  summary?: string;
  /** 过滤前的命中总数（limit 截断前）。 */
  total?: number;
  /** 无法识别、已被忽略的查询条件键（UI 可提示，便于排查「查不到」）。 */
  ignoredKeys?: string[];
}

// ========== 过滤引擎 ==========

/** 任意实体行（过滤时按 Record 读取字段）。 */
type Row = Record<string, unknown>;

/** 实体过滤规格：哪些字段可精确匹配、哪些按包含匹配、关键词搜哪些字段。 */
interface EntitySpec {
  /** 允许参与匹配的真实字段名。 */
  fields: string[];
  /** 文本字段：按「包含」而非「相等」匹配（AI 常给片段）。 */
  fuzzyFields: string[];
  /** 关键词（keyword/q/search）搜索的字段。 */
  searchFields: string[];
  /** since/until 作用的时间字段。 */
  dateField: string;
}

const BLOG_SPEC: EntitySpec = {
  fields: [
    'id', 'title', 'excerpt', 'status', 'source', 'folderId', 'tagIds',
    'sourcePlanId', 'templateId', 'frameworkId', 'createdAt', 'updatedAt', 'publishedAt',
  ],
  fuzzyFields: ['title', 'excerpt'],
  searchFields: ['title', 'contentText', 'excerpt'],
  dateField: 'updatedAt',
};

const PLAN_SPEC: EntitySpec = {
  fields: [
    'id', 'title', 'description', 'status', 'level', 'timeDim', 'progress',
    'urgency', 'folderId', 'tagIds', 'startDate', 'endDate', 'createdAt', 'updatedAt',
  ],
  fuzzyFields: ['title', 'description'],
  searchFields: ['title', 'description'],
  dateField: 'updatedAt',
};

const TEMPLATE_SPEC: EntitySpec = {
  fields: ['id', 'name', 'description', 'category', 'builtin', 'useCount', 'createdAt', 'updatedAt'],
  fuzzyFields: ['name', 'description'],
  searchFields: ['name', 'description'],
  dateField: 'updatedAt',
};

/** 归一化键名：小写 + 去掉下划线/连字符/空格（兼容 folder_id / folderID）。 */
const normKey = (k: string): string => k.toLowerCase().replace(/[_\-\s]/g, '');

/** 控制类键（分页 / 排序 / 条数），不参与字段匹配。 */
const CONTROL_KEYS = new Set([
  'limit', 'top', 'n', 'count', 'size', 'pagesize', 'offset', 'page',
  'sort', 'sortby', 'orderby', 'order', 'desc', 'asc', 'fields', 'select', 'tool',
]);

/** 关键词（全文模糊）键。 */
const KEYWORD_KEYS = new Set(['keyword', 'keywords', 'q', 'search', 'query', 'text', 'contains', 'like']);

/** 时间下界键。 */
const SINCE_KEYS = new Set([
  'since', 'from', 'after', 'start', 'startdate', 'datefrom', 'begin',
  'updatedafter', 'createdafter', 'updatedsince', 'createdsince',
]);

/** 时间上界键。 */
const UNTIL_KEYS = new Set([
  'until', 'to', 'before', 'end', 'enddate', 'dateto',
  'updatedbefore', 'createdbefore',
]);

/** 中文枚举值 → 内部值（AI 常直接给中文）。 */
const VALUE_ALIASES: Record<string, string> = {
  草稿: 'draft',
  已发布: 'published',
  发布: 'published',
  已归档: 'archived',
  归档: 'archived',
  未开始: 'todo',
  待办: 'todo',
  进行中: 'doing',
  执行中: 'doing',
  已完成: 'done',
  完成: 'done',
  暂停: 'paused',
  已暂停: 'paused',
  手动: 'manual',
  ai生成: 'ai',
};

/** 规范化标量值用于比较（中文枚举映射 + 小写）。 */
function normValue(v: unknown): string {
  const s = String(v ?? '').trim();
  const alias = VALUE_ALIASES[s] ?? VALUE_ALIASES[s.toLowerCase()];
  return (alias ?? s).toLowerCase();
}

/** 两个标量是否相等（大小写/中文枚举无关）。 */
function looseEq(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return actual.some((a) => normValue(a) === normValue(expected));
  return normValue(actual) === normValue(expected);
}

/** 数值/日期可比较值：数字原样，ISO 字符串按字典序比较。 */
function cmpValue(actual: unknown, expected: unknown): number | null {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return actual === expected ? 0 : actual < expected ? -1 : 1;
  }
  const a = String(actual ?? '');
  const b = String(expected ?? '');
  if (!a || !b) return null;
  return a === b ? 0 : a < b ? -1 : 1;
}

/** 单字段匹配：支持标量 / 数组简写 / MongoDB 风格操作符。 */
function matchField(actual: unknown, expected: unknown, fuzzy: boolean): boolean {
  // 空条件视为「不过滤」
  if (expected === undefined || expected === null || expected === '') return true;

  if (Array.isArray(expected)) {
    return expected.length === 0 || expected.some((e) => looseEq(actual, e));
  }

  if (typeof expected === 'object') {
    const ops = expected as Record<string, unknown>;
    let ok = true;
    if ('$in' in ops && Array.isArray(ops.$in)) {
      ok = ok && (ops.$in as unknown[]).some((e) => looseEq(actual, e));
    }
    if ('$nin' in ops && Array.isArray(ops.$nin)) {
      ok = ok && !(ops.$nin as unknown[]).some((e) => looseEq(actual, e));
    }
    if ('$ne' in ops) ok = ok && !looseEq(actual, ops.$ne);
    if ('$eq' in ops) ok = ok && looseEq(actual, ops.$eq);
    for (const [op, bound] of [
      ['$gt', ops.$gt], ['$gte', ops.$gte], ['$lt', ops.$lt], ['$lte', ops.$lte],
    ] as Array<[string, unknown]>) {
      if (bound === undefined) continue;
      const c = cmpValue(actual, bound);
      if (c === null) continue; // 无法比较 → 视为不约束（避免整表被滤空）
      if (op === '$gt') ok = ok && c > 0;
      if (op === '$gte') ok = ok && c >= 0;
      if (op === '$lt') ok = ok && c < 0;
      if (op === '$lte') ok = ok && c <= 0;
    }
    if ('$contains' in ops) {
      ok = ok && String(actual ?? '').toLowerCase().includes(normValue(ops.$contains));
    }
    return ok;
  }

  if (fuzzy && typeof expected === 'string') {
    return String(actual ?? '').toLowerCase().includes(expected.trim().toLowerCase());
  }
  return looseEq(actual, expected);
}

/** 归一化后的查询条件。 */
interface NormalizedFilter {
  /** [真实字段名, 条件值, 是否模糊] */
  entries: Array<[string, unknown, boolean]>;
  keywords: string[];
  since?: string;
  until?: string;
  limit?: number;
  ignoredKeys: string[];
}

/** 把 AI 给的任意 filter 归一化为可执行条件（无法识别的键仅记录、不生效）。 */
function normalizeFilter(
  filter: Record<string, unknown> | undefined,
  spec: EntitySpec,
): NormalizedFilter {
  const out: NormalizedFilter = { entries: [], keywords: [], ignoredKeys: [] };
  if (!filter || typeof filter !== 'object') return out;

  const fieldByNorm = new Map(spec.fields.map((f) => [normKey(f), f]));
  const fuzzySet = new Set(spec.fuzzyFields.map(normKey));

  for (const [rawKey, rawValue] of Object.entries(filter)) {
    const key = normKey(rawKey);
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    if (key === 'limit' || key === 'top' || key === 'n' || key === 'count' || key === 'size' || key === 'pagesize') {
      const num = Number(rawValue);
      if (Number.isFinite(num) && num > 0) out.limit = Math.floor(num);
      continue;
    }
    if (CONTROL_KEYS.has(key)) continue;

    if (KEYWORD_KEYS.has(key)) {
      const kw = String(rawValue).trim();
      if (kw) out.keywords.push(kw);
      continue;
    }
    if (SINCE_KEYS.has(key)) {
      out.since = String(rawValue);
      continue;
    }
    if (UNTIL_KEYS.has(key)) {
      out.until = String(rawValue);
      continue;
    }

    const field = fieldByNorm.get(key);
    if (field) {
      out.entries.push([field, rawValue, fuzzySet.has(key)]);
      continue;
    }
    out.ignoredKeys.push(rawKey);
  }
  return out;
}

/** 按归一化条件过滤 + 截断，返回命中行与命中总数。 */
function applyFilter<T extends Row>(
  rows: T[],
  filter: Record<string, unknown> | undefined,
  spec: EntitySpec,
): { rows: T[]; total: number; ignoredKeys: string[] } {
  const nf = normalizeFilter(filter, spec);

  const matched = rows.filter((row) => {
    for (const [field, value, fuzzy] of nf.entries) {
      if (!matchField(row[field], value, fuzzy)) return false;
    }
    for (const kw of nf.keywords) {
      const needle = kw.toLowerCase();
      const hit = spec.searchFields.some((f) =>
        String(row[f] ?? '').toLowerCase().includes(needle),
      );
      if (!hit) return false;
    }
    if (nf.since || nf.until) {
      const dv = String(row[spec.dateField] ?? '');
      if (dv) {
        if (nf.since && dv < nf.since) return false;
        if (nf.until && dv > nf.until) return false;
      }
    }
    return true;
  });

  const limited = nf.limit ? matched.slice(0, nf.limit) : matched;
  return { rows: limited, total: matched.length, ignoredKeys: nf.ignoredKeys };
}

// ========== 拦截入口 ==========

export async function interceptDataQuery(
  tool: DataQueryTool,
  filter?: Record<string, unknown>,
): Promise<QueryResult> {
  switch (tool) {
    case 'get_plans': {
      const all = await planRepo.list();
      const { rows: plans, total, ignoredKeys } = applyFilter(
        all as unknown as Row[],
        filter,
        PLAN_SPEC,
      );
      const typed = plans as unknown as Awaited<ReturnType<typeof planRepo.list>>;
      const displayRows = typed.map((p) => ({
        id: p.id,
        cells: [
          { label: '标题', value: p.title, href: `/plans/${p.id}` },
          { label: '状态', value: p.status },
          { label: '进度', value: `${p.progress}%` },
          { label: '层级', value: p.level },
        ],
      }));
      return {
        tool,
        data: typed.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          progress: p.progress,
          level: p.level,
          timeDim: p.timeDim,
          endDate: p.endDate,
        })),
        displayRows,
        total,
        ignoredKeys,
      };
    }
    case 'get_blogs': {
      const all = await blogRepo.list();
      const { rows: blogs, total, ignoredKeys } = applyFilter(
        all as unknown as Row[],
        filter,
        BLOG_SPEC,
      );
      const typed = blogs as unknown as Awaited<ReturnType<typeof blogRepo.list>>;
      const displayRows = typed.map((b) => ({
        id: b.id,
        cells: [
          { label: '标题', value: b.title, href: `/blogs/${b.id}` },
          { label: '状态', value: b.status },
          { label: '来源', value: b.source },
          { label: '更新', value: (b.updatedAt ?? '').slice(0, 10) },
        ],
      }));
      return {
        tool,
        data: typed.map((b) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          source: b.source,
          updatedAt: b.updatedAt,
        })),
        displayRows,
        total,
        ignoredKeys,
      };
    }
    case 'get_templates': {
      const all = await blogTemplateRepo.list();
      const { rows: templates, total, ignoredKeys } = applyFilter(
        all as unknown as Row[],
        filter,
        TEMPLATE_SPEC,
      );
      const typed = templates as unknown as Awaited<ReturnType<typeof blogTemplateRepo.list>>;
      const displayRows = typed.map((t) => ({
        id: t.id,
        cells: [
          { label: '名称', value: t.name, href: `/templates/${t.id}/edit` },
          { label: '分类', value: t.category },
          { label: '使用', value: `${t.useCount} 次` },
          { label: '内置', value: t.builtin ? '是' : '否' },
        ],
      }));
      return {
        tool,
        data: typed.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          useCount: t.useCount,
          builtin: t.builtin,
        })),
        displayRows,
        total,
        ignoredKeys,
      };
    }
    case 'get_stats': {
      const stats = await computeAppStats();
      const summary = [
        `计划总数 ${stats.planCounts.total}（进行中 ${stats.planCounts.doing}，已完成 ${stats.planCounts.done}）`,
        `博客总数 ${stats.blogCounts.total}（草稿 ${stats.blogCounts.draft}，已发布 ${stats.blogCounts.published}）`,
        `事项总数 ${stats.itemCounts.total}（已完成 ${stats.itemCounts.done}）`,
        `平均进度 ${stats.overallProgress}%`,
        `本周新增：计划 ${stats.weeklyNew.plans}，博客 ${stats.weeklyNew.blogs}`,
      ].join('\n');
      return { tool, data: stats, displayRows: [], summary, total: 0, ignoredKeys: [] };
    }
  }
}

/** 把结果格式化为 system message content。 */
export function formatQueryResultForLLM(result: QueryResult): string {
  if (result.tool === 'get_stats') {
    return `[数据查询结果 - ${result.tool}]\n${result.summary}`;
  }
  const head = `[数据查询结果 - ${result.tool}] 命中 ${result.total ?? result.displayRows.length} 条`;
  return `${head}\n${JSON.stringify(result.data, null, 2)}`;
}
