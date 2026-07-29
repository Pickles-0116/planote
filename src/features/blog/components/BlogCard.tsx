/**
 * BlogCard - 博客列表卡片（add-blog-list-and-detail 增量）
 *
 * density 取值：
 * - 'grid'（默认）卡片网格：标题 + 摘要 + 状态 badge + 标签 chips + 框架名 + 相对时间
 * - 'list' 列表紧凑行：单行 + 标题 + 状态 badge + 框架名 + 相对时间
 *
 * 视觉规范（design.md §2.6）：复用 PlanCard 设计语言
 * - rounded-2xl + shadow-soft + hover 上浮
 * - 状态 badge 颜色：draft 灰 / published 绿 / archived 琥珀
 *
 * onClick → navigate('/blogs/{id}')
 * a11y：<article> + <h3> + role="link" + tabIndex
 */

import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Copy, FileText, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBlogStore, useToastStore } from '@/stores';
import type { Blog, BlogTemplate, Framework } from '@/types/domain';
import { formatRelativeTime } from '../utils/formatRelativeTime';

export type BlogCardDensity = 'grid' | 'list';

interface Props {
  blog: Blog;
  density?: BlogCardDensity;
  /** 模板 / 框架名映射（避免每次 find） */
  framework?: BlogTemplate | Framework | undefined;
  /** V1.2 B4：全文检索命中片段（优先于 excerpt 展示）。 */
  snippet?: string;
}

export default function BlogCard({ blog, density = 'grid', framework, snippet }: Props) {
  const navigate = useNavigate();
  const duplicateBlog = useBlogStore((s) => s.duplicateBlog);
  const pushToast = useToastStore((s) => s.push);
  const relTime = formatRelativeTime(blog.updatedAt);

  const handleDuplicate = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const dup = await duplicateBlog(blog.id);
        pushToast('success', `已创建副本`);
        navigate(`/blogs/${dup.id}/edit`);
      } catch {
        pushToast('error', '复制失败');
      }
    },
    [blog.id, duplicateBlog, pushToast, navigate],
  );

  // list 密度：单行紧凑横排
  if (density === 'list') {
    return (
      <Link
        to={`/blogs/${blog.id}`}
        data-searchable
        className={cn(
          'group flex items-center gap-3 bg-white rounded-xl p-3 border border-stone-200',
          'hover:border-brand-300 hover:shadow-sm transition',
        )}
      >
        <FileText className="text-brand-400 flex-shrink-0" size={16} />
        <h3 className="text-sm font-semibold text-brand-900 truncate flex-1 min-w-0 group-hover:text-brand-700">
          {blog.title}
        </h3>
        {framework && (
          <span className="text-[10px] text-brand-500 font-medium bg-stone-100 px-1.5 py-0.5 rounded flex-shrink-0">
            {framework.name}
          </span>
        )}
        <span className="text-[10px] text-brand-400 flex items-center gap-1 flex-shrink-0 w-20 justify-end">
          <Calendar size={10} />
          {relTime}
        </span>
      </Link>
    );
  }

  // grid 密度：完整卡片
  return (
    <Link
      to={`/blogs/${blog.id}`}
      data-searchable
      className={cn(
        'group block bg-white rounded-2xl p-5 border border-stone-200 shadow-soft',
        'hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition',
      )}
    >
      <article className="space-y-3">
        {/* 标题 */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-brand-900 line-clamp-2 flex-1 min-w-0 group-hover:text-brand-700">
            {blog.title}
          </h3>
        </div>

        {/* 摘要 / 检索命中片段（line-clamp-2） */}
        {(snippet || blog.excerpt) && (
          <p className="text-xs text-brand-500 line-clamp-2 leading-relaxed">
            {snippet || blog.excerpt}
          </p>
        )}

        {/* 标签 chips（0 标签不渲染区） */}
        {blog.tagIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {blog.tagIds.slice(0, 4).map((tagId) => (
              <span
                key={tagId}
                className="inline-flex items-center gap-0.5 text-[10px] text-brand-600 bg-stone-100 px-1.5 py-0.5 rounded"
              >
                <Hash size={8} />
                {tagId}
              </span>
            ))}
            {blog.tagIds.length > 4 && (
              <span className="text-[10px] text-brand-400 px-1.5 py-0.5">
                +{blog.tagIds.length - 4}
              </span>
            )}
          </div>
        )}

        {/* 框架名 + 复制按钮 + 相对时间 */}
        <div className="flex items-center justify-between text-[10px] text-brand-400 pt-1 border-t border-stone-100">
          {framework ? (
            <span className="font-medium text-brand-600 truncate max-w-[40%]">
              {framework.name}
            </span>
          ) : (
            <span className="text-brand-300">未选框架</span>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleDuplicate}
              title="复制博客"
              className="text-brand-400 hover:text-brand-700 transition p-0.5 rounded hover:bg-stone-100"
            >
              <Copy size={11} />
            </button>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {relTime}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
