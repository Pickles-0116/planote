/**
 * PlanBlogsSection - 计划详情页底部关联博客区
 *
 * 行为（design.md §2.6 + spec Requirement: 关联博客区）：
 * - props: `{ blogIds, onGenerateBlog }`
 * - 入参：useLiveQuery 一次性拉 (blogRepo.listByIds)
 * - 卡片网格 3 列（与 Dashboard「最近博客」一致）
 * - 空态：EmptyState compact + 「生成总结博客」CTA
 * - 单卡：封面占位（gradient）+ 标题（line-clamp-2）+ 日期
 * - 点击 → /blogs/:id
 */

import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PenLine, Wand2, Newspaper } from 'lucide-react';
import { blogRepo } from '@/db/repos';
import EmptyState from '@/components/shell/EmptyState';
import { cn } from '@/lib/utils';
import type { ID, Blog } from '@/types/domain';
import { formatRelativeTime } from '@/shared/utils/format';

interface Props {
  blogIds: ID[];
  onGenerateBlog?: () => void;
}

export default function PlanBlogsSection({ blogIds, onGenerateBlog }: Props) {
  const blogs = useLiveQuery<Blog[] | undefined>(
    async () => {
      if (blogIds.length === 0) return [];
      return await blogRepo.listByIds(blogIds);
    },
    [blogIds.join(',')],
  );

  // 加载态
  if (blogs === undefined) {
    return (
      <section className="bg-white rounded-2xl border border-stone-200 p-6 animate-fadeUp animate-delay-250">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold">关联博客</h2>
            <p className="text-xs text-brand-400 mt-1">从本计划衍生的内容</p>
          </div>
        </div>
        <div className="h-32 bg-stone-100 rounded-xl animate-pulse" />
      </section>
    );
  }

  return (
    <section
      className="bg-white rounded-2xl border border-stone-200 p-6 animate-fadeUp animate-delay-250"
      data-blogs-section
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold">关联博客</h2>
          <p className="text-xs text-brand-400 mt-1">
            从本计划衍生的内容 · 共 {blogs.length} 篇
          </p>
        </div>
      </div>

      {blogs.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="还没有关联博客"
          description="基于此计划选择框架，让 AI 帮你生成博客大纲"
          action={
            onGenerateBlog
              ? {
                  label: '选择框架并生成',
                  onClick: onGenerateBlog,
                  variant: 'primary',
                }
              : undefined
          }
          variant="compact"
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {blogs.map((b) => {
            const dateStr = (b.publishedAt ?? b.updatedAt).slice(0, 10);
            return (
              <Link
                key={b.id}
                to={`/blogs/${b.id}`}
                className="group block"
              >
                <div
                  className={cn(
                    'aspect-[4/3] rounded-xl overflow-hidden mb-3',
                    'bg-gradient-to-br from-stone-100 to-stone-200',
                    'flex items-center justify-center',
                    'group-hover:from-accent-50 group-hover:to-amber-50 transition',
                  )}
                >
                  <PenLine className="text-stone-300 group-hover:text-accent-500 transition" size={28} />
                </div>
                <div className="text-[10px] text-brand-400 mb-1">
                  {formatRelativeTime(dateStr)}
                </div>
                <div className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-brand-700">
                  {b.title}
                </div>
              </Link>
            );
          })}

          {/* 「生成博客」引导卡（hover 时显示） */}
          {onGenerateBlog && (
            <button
              type="button"
              onClick={onGenerateBlog}
              className={cn(
                'aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2',
                'border-2 border-dashed border-stone-200 text-brand-400',
                'hover:border-accent-300 hover:bg-accent-50/30 hover:text-accent-600 transition',
                'text-xs',
              )}
            >
              <Wand2 size={20} />
              <span>选择框架并生成</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
