/**
 * DataQueryCard · 数据查询结果卡片（真实渲染）
 *
 * 来源：openspec/changes/ai-chat-smart-qa/spec.md。
 * 组件自己负责调 interceptor 拿数据（解耦 useAIChat）。
 */

import { useEffect, useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import CardShell from './CardShell';
import { interceptDataQuery, type QueryResult } from '../../utils/queryInterceptor';

interface Props {
  tool: 'get_plans' | 'get_blogs' | 'get_templates' | 'get_stats';
  filter?: Record<string, unknown>;
}

const TOOL_TITLES: Record<string, string> = {
  get_plans: '查询结果 - 计划',
  get_blogs: '查询结果 - 博客',
  get_templates: '查询结果 - 模板',
  get_stats: '统计摘要',
};

const MAX_ROWS = 50;

export default function DataQueryCard({ tool, filter }: Props): JSX.Element {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    interceptDataQuery(tool, filter)
      .then((r) => {
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '查询失败');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tool, JSON.stringify(filter)]);

  const title = TOOL_TITLES[tool] ?? `查询结果 - ${tool}`;
  const rows = result?.displayRows ?? [];
  const summary = result?.summary;
  const total = result?.total ?? rows.length;
  const overflow = rows.length > MAX_ROWS ? rows.length - MAX_ROWS : 0;
  const visibleRows = rows.slice(0, MAX_ROWS);
  /** 无法识别、已被忽略的查询条件（提示用户为何结果范围与预期不同）。 */
  const ignoredKeys = result?.ignoredKeys ?? [];

  return (
    <CardShell
      title={title}
      icon={<Database size={14} className="text-brand-700 dark:text-brand-400" />}
      hideActions
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Loader2 size={12} className="animate-spin" />
          查询中…
        </div>
      ) : error ? (
        <p className="text-xs text-red-600 dark:text-red-400">查询失败：{error}</p>
      ) : summary ? (
        <pre className="text-xs whitespace-pre-wrap font-sans text-stone-700 dark:text-stone-200">
          {summary}
        </pre>
      ) : visibleRows.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">没有匹配的数据</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="border-b border-stone-100 dark:border-stone-600/50 last:border-0"
                >
                  {row.cells.map((cell, j) => (
                    <td key={j} className="py-1.5 pr-3 align-top">
                      <span className="text-stone-400 dark:text-stone-500 mr-1">
                        {cell.label}:
                      </span>
                      {cell.href ? (
                        <a
                          href={cell.href}
                          className="text-brand-700 dark:text-brand-400 hover:underline"
                        >
                          {cell.value}
                        </a>
                      ) : (
                        <span>{cell.value}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
            共命中 {total} 条{overflow > 0 ? `，还有 ${overflow} 条未显示` : ''}
          </p>
        </div>
      )}
      {ignoredKeys.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          已忽略无法识别的查询条件：{ignoredKeys.join('、')}
        </p>
      )}
      {filter && Object.keys(filter).length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-stone-400 dark:text-stone-500 cursor-pointer">
            查询条件
          </summary>
          <pre className="text-[10px] mt-1 text-stone-500 dark:text-stone-400 whitespace-pre-wrap">
            {JSON.stringify(filter, null, 2)}
          </pre>
        </details>
      )}
    </CardShell>
  );
}