/**
 * BlogDetail - 博客详情页（/blogs/:id）（add-blog-list-and-detail 增量）
 *
 * 完整流程：
 * 1. 路由拿 id 订阅 Blog
 * 2. 顶栏：返回 + breadcrumb + 「编辑」+「删除」按钮
 * 3. 标题 + 元数据条（字数 + 创建/更新时间 + 状态 badge + 标签 + 来源计划）
 * 4. 内容用 `<RichEditor readOnly>` 渲染
 * 5. 附件列表（Round 10 落地）+ 全屏预览
 *
 * 删除流程（design.md §2.8）：
 * - 复用 window.confirm 简版
 * - 确认 → useBlogStore.deleteBlog(id) + navigate('/blogs')
 * - 失败 → toast.error('删除失败')
 *
 * 加载 / 错误态：
 * - 加载中（undefined）→ 「加载博客中…」
 * - ID 不存在（null）→ EmptyState
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  FileText,
  Hash,
  Trash2,
  Type,
} from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import RichEditor from '@/features/blog/components/RichEditor';
import AttachmentList from '@/features/blog/components/AttachmentList';
import ImageLightbox from '@/shared/components/ImageLightbox';
import { useAttachments } from '@/features/blog/hooks/useAttachments';
import {
  useAttachmentStore,
  useBlog,
  useBlogStore,
  usePlan,
  useToastStore,
} from '@/stores';
import type { Attachment, TiptapJSON } from '@/types/domain';
import { countText } from '@/features/blog/utils/countText';
import { formatChineseDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

const STATUS_CLS: Record<string, string> = {
  draft: 'text-stone-600 bg-stone-100',
  published: 'text-emerald-700 bg-emerald-50',
  archived: 'text-amber-700 bg-amber-50',
};

const contentToString = (content: TiptapJSON | undefined): string =>
  content ? JSON.stringify(content) : '';

export default function BlogDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const blog = useBlog(id ?? null);
  const sourcePlan = usePlan(blog?.sourcePlanId ?? null);

  const content = useMemo(() => contentToString(blog?.content), [blog?.content]);
  const charCount = useMemo(() => countText(blog?.content), [blog?.content]);

  // 附件 + lightbox（Round 10 增量）
  const { attachments } = useAttachments(id ?? null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const revokeAll = useAttachmentStore((s) => s.revokeAll);
  const deleteBlog = useBlogStore((s) => s.deleteBlog);
  const pushToast = useToastStore((s) => s.push);

  // 卸载时释放 blob URL
  useEffect(() => {
    return () => {
      revokeAll();
    };
  }, [revokeAll]);

  const handleImageClick = useCallback(
    (att: Attachment, blobUrl: string): void => {
      setLightbox({ src: blobUrl, alt: att.filename });
    },
    [],
  );

  // 删除流程
  const handleDelete = useCallback(async () => {
    if (!id || !blog) return;
    const ok = window.confirm(
      `确认删除博客「${blog.title}」？\n附件将保留在 IndexedDB 中（孤儿数据）。`,
    );
    if (!ok) return;
    try {
      await deleteBlog(id);
      navigate('/blogs');
    } catch {
      pushToast('error', '删除失败');
    }
  }, [id, blog, deleteBlog, navigate, pushToast]);

  // 加载中
  if (blog === undefined) {
    return (
      <div className="max-w-4xl mx-auto animate-fadeUp">
        <div className="text-center text-sm text-brand-400 py-12">加载博客中…</div>
      </div>
    );
  }

  // 不存在
  if (blog === null) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="找不到该博客"
        description="该博客可能已被删除"
        action={{
          label: '返回博客列表',
          onClick: () => navigate('/blogs'),
        }}
        variant="default"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 mb-6 animate-fadeUp">
        <button
          type="button"
          onClick={() => navigate('/blogs')}
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition"
          aria-label="返回"
        >
          <ArrowLeft size={14} />
        </button>

        <nav className="flex items-center gap-2 text-sm flex-1 min-w-0">
          <Link
            to="/blogs"
            className="text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 transition flex-shrink-0"
          >
            博客
          </Link>
          <span className="text-brand-300 dark:text-stone-600 flex-shrink-0">/</span>
          <span className="text-brand-900 dark:text-stone-100 font-medium truncate">{blog.title}</span>
        </nav>

        <Link
          to={`/blogs/${blog.id}/edit`}
          className="px-3 py-1.5 text-sm font-medium text-brand-700 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition"
        >
          编辑
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          aria-label="删除博客"
          className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-300 bg-white dark:bg-stone-800 border border-red-200 dark:border-red-800/50 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-1"
        >
          <Trash2 size={12} />
          删除
        </button>
      </div>

      {/* 标题 */}
      <h1 className="text-3xl font-bold tracking-tight mb-4 animate-fadeUp text-brand-900 dark:text-stone-100">
        {blog.title}
      </h1>

      {/* 元数据条：字数 + 创建/更新时间 + 状态 + 标签 + 来源计划 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-brand-500 dark:text-stone-400 mb-6 animate-fadeUp">
        {/* 字数 */}
        <span className="inline-flex items-center gap-1.5">
          <Type size={12} />
          <span className="font-semibold text-brand-900 dark:text-stone-100">{charCount.chars}</span> 字
          {charCount.words > 0 && (
            <span className="text-brand-400 dark:text-stone-500">· {charCount.words} 词</span>
          )}
        </span>

        {/* 状态 badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded',
            STATUS_CLS[blog.status] ?? 'text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-700',
          )}
        >
          <FileText size={10} />
          {STATUS_LABEL[blog.status] ?? blog.status}
        </span>

        {/* 创建时间 */}
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={12} />
          创建：{formatChineseDate(new Date(blog.createdAt))}
        </span>

        {/* 更新时间 */}
        <span className="inline-flex items-center gap-1.5 text-brand-400 dark:text-stone-500">
          更新：{formatChineseDate(new Date(blog.updatedAt))}
        </span>

        {/* 标签 chips */}
        {blog.tagIds.length > 0 && (
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <Hash size={12} />
            {blog.tagIds.map((t) => (
              <span
                key={t}
                className="text-[10px] text-brand-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded"
              >
                {t}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* 来源计划（可选） */}
      {sourcePlan && (
        <div className="mb-6 animate-fadeUp">
          <Link
            to={`/plans/${sourcePlan.id}`}
            className="inline-flex items-center gap-2 text-xs text-brand-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 px-3 py-1.5 rounded-xl transition"
          >
            <span className="text-brand-400 dark:text-stone-500">来源计划：</span>
            <span className="font-medium text-brand-900 dark:text-stone-100">{sourcePlan.title}</span>
          </Link>
        </div>
      )}

      {/* 内容（只读模式） */}
      <div className="animate-fadeUp">
        <RichEditor value={content} readOnly placeholder="" />
      </div>

      {/* 附件列表（Round 10 落地） */}
      {attachments && attachments.length > 0 && (
        <div className="mt-8 animate-fadeUp">
          <h3 className="text-sm font-semibold text-brand-900 dark:text-stone-100 mb-3">
            附件（{attachments.length}）
          </h3>
          <AttachmentList
            attachments={attachments}
            onImageClick={handleImageClick}
          />
        </div>
      )}

      {/* 全屏图片预览（Round 9 + 10 落地） */}
      <ImageLightbox
        src={lightbox?.src ?? null}
        alt={lightbox?.alt ?? ''}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
