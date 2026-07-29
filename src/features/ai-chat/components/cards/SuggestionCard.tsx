/**
 * SuggestionCard · 操作建议卡片（真实渲染）
 *
 * 来源：openspec/changes/ai-chat-smart-qa/spec.md。
 */

import { Lightbulb } from 'lucide-react';
import CardShell from './CardShell';
import type { SuggestionData, Plan, Blog } from '@/types/domain';
import { planRepo, blogRepo } from '@/db/repos';
import { useEffect, useState } from 'react';

interface Props {
  data: SuggestionData;
}

interface ResolvedEntity {
  id: string;
  title: string;
  href: string;
  extra?: string;
}

function useResolveEntities(data: SuggestionData): ResolvedEntity[] {
  const [rows, setRows] = useState<ResolvedEntity[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (data.entityIds.length === 0) {
        setRows([]);
        return;
      }
      const ids = data.entityIds;
      if (data.type === 'overdue_plans' || data.type === 'paused_too_long') {
        // PlanRepo 没有 listByIds，用 list + filter
        const allPlans = await planRepo.list();
        const idSet = new Set(ids);
        const plans: Plan[] = allPlans.filter((p) => idSet.has(p.id));
        if (!cancelled) {
          setRows(
            plans.map((p) => ({
              id: p.id,
              title: p.title,
              href: `/plans/${p.id}`,
              extra: `${p.status} · ${p.progress}%`,
            })),
          );
        }
      } else {
        // stale_drafts
        const blogs: Blog[] = await blogRepo.listByIds(ids).catch(() => [] as Blog[]);
        if (!cancelled) {
          setRows(
            blogs.map((b) => ({
              id: b.id,
              title: b.title,
              href: `/blogs/${b.id}/edit`,
              extra: `更新于 ${b.updatedAt.slice(0, 10)}`,
            })),
          );
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return rows;
}

export default function SuggestionCard({ data }: Props): JSX.Element {
  const rows = useResolveEntities(data);

  return (
    <CardShell
      title="操作建议"
      icon={<Lightbulb size={14} className="text-amber-600 dark:text-amber-400" />}
      hideActions
    >
      <div className="space-y-2">
        <p className="text-xs text-stone-700 dark:text-stone-200">{data.title}</p>
        {rows.length > 0 && (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.id} className="text-xs flex items-center justify-between gap-2">
                <a
                  href={row.href}
                  className="text-brand-700 dark:text-brand-400 hover:underline truncate flex-1"
                >
                  {row.title}
                </a>
                {row.extra && (
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    {row.extra}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardShell>
  );
}