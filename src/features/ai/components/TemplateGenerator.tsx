/**
 * TemplateGenerator - 模板生成模式 UI
 *
 * 选择博客模板 → 可选引用已有博客作为素材 → 填写各章节素材 → 一键生成博客。
 * 生成完成后自动将 Markdown 转为 TiptapJSON 注入编辑器。
 *
 * 引用博客功能：选择 1-10 篇已有博客，AI 会综合这些博客内容撰写新博客。
 * 典型场景：10 篇 LeetCode 刷题博客 → 生成一篇周总结。
 */

import { useState, useCallback, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { Blog, BlogTemplate } from '@/types/domain';
import { useBlogs } from '@/stores';
import { useTemplates } from '@/features/templates/hooks/useTemplates';
import { useAIGenerate } from '../hooks/useAIGenerate';
import AIStatusBar from './AIStatusBar';
import { buildTemplatePrompt } from '../prompts';
import type { ReferenceBlog } from '../prompts/templatePrompt';
import { markdownToTiptapJSON } from '@/features/blog/utils/markdownToTiptap';
import { cn } from '@/lib/utils';

interface Props {
  editor?: Editor | null;
  /** 预填补充信息（从计划跳转时注入计划事项清单）。 */
  initialGlobalNotes?: string;
}

const MAX_REF_BLOGS = 10;

export default function TemplateGenerator({ editor, initialGlobalNotes }: Props): JSX.Element {
  const templates = useTemplates();
  const blogs = useBlogs();

  const [selectedId, setSelectedId] = useState('');
  const [sectionInputs, setSectionInputs] = useState<Record<string, string>>({});
  const [globalNotes, setGlobalNotes] = useState(initialGlobalNotes ?? '');
  const [specialReqs, setSpecialReqs] = useState('');
  const [refBlogIds, setRefBlogIds] = useState<string[]>([]);
  const [refBlogExpanded, setRefBlogExpanded] = useState(false);

  const { status, generatedText, errorMessage, generate, cancel } = useAIGenerate('template');

  // 取消标记：停止后避免把不完整片段写入编辑器（V1.2 B10 统一防护）
  const cancelledRef = useRef(false);
  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    cancel();
  }, [cancel]);

  const selectedTemplate = templates?.find((t) => t.id === selectedId);
  const hasAnyInput =
    Object.values(sectionInputs).some((v) => v.trim().length > 0) ||
    refBlogIds.length > 0;
  const canGenerate = !!selectedTemplate && hasAnyInput && status !== 'generating';

  const handleSectionChange = useCallback((heading: string, value: string) => {
    setSectionInputs((prev) => ({ ...prev, [heading]: value }));
  }, []);

  const toggleRefBlog = useCallback((id: string) => {
    setRefBlogIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_REF_BLOGS) return prev;
      return [...prev, id];
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    cancelledRef.current = false;

    // 组装引用博客素材
    const referenceBlogs: ReferenceBlog[] | undefined =
      refBlogIds.length > 0 && blogs
        ? refBlogIds
            .map((id) => blogs.find((b: Blog) => b.id === id))
            .filter((b): b is Blog => !!b)
            .map((b) => ({ title: b.title, contentText: b.contentText ?? '' }))
        : undefined;

    const { system, user } = buildTemplatePrompt({
      template: selectedTemplate,
      sectionInputs,
      globalNotes: globalNotes.trim() || undefined,
      specialRequirements: specialReqs.trim() || undefined,
      referenceBlogs,
    });
    const md = await generate([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    // 取消后不写入编辑器：用户点停止时 cancelledRef 置 true，跳过 setContent
    if (cancelledRef.current) return;
    if (md && editor) {
      const json = markdownToTiptapJSON(md);
      editor.commands.setContent(json as never);
    }
  }, [selectedTemplate, sectionInputs, globalNotes, specialReqs, refBlogIds, blogs, generate, editor]);

  return (
    <div className="p-5 space-y-4">
      {/* 模板选择 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          选择模板
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setSectionInputs({});
          }}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-900/20"
        >
          <option value="">-- 请选择 --</option>
          {templates?.map((t: BlogTemplate) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* 引用博客（可折叠） */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-600 overflow-hidden">
        <button
          type="button"
          onClick={() => setRefBlogExpanded(!refBlogExpanded)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-stone-50 dark:bg-stone-700/50 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-brand-600 dark:text-brand-400" />
            <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
              引用已有博客作为素材
            </span>
            {refBlogIds.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold bg-brand-900 text-white rounded-full">
                {refBlogIds.length}
              </span>
            )}
          </div>
          {refBlogExpanded ? (
            <ChevronDown size={14} className="text-stone-400" />
          ) : (
            <ChevronRight size={14} className="text-stone-400" />
          )}
        </button>
        {refBlogExpanded && (
          <div className="border-t border-stone-200 dark:border-stone-600">
            <p className="text-[11px] text-stone-400 dark:text-stone-500 px-3.5 pt-2.5 pb-1.5">
              选择 {refBlogIds.length}/{MAX_REF_BLOGS} 篇博客，AI 会综合其内容生成新博客（如：多篇刷题博客 → 周总结）
            </p>
            <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-700">
              {blogs?.slice(0, 50).map((blog: Blog) => (
                <label
                  key={blog.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-colors',
                    refBlogIds.includes(blog.id)
                      ? 'bg-brand-50/50 dark:bg-brand-900/10'
                      : 'hover:bg-stone-50 dark:hover:bg-stone-700/50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={refBlogIds.includes(blog.id)}
                    onChange={() => toggleRefBlog(blog.id)}
                    disabled={!refBlogIds.includes(blog.id) && refBlogIds.length >= MAX_REF_BLOGS}
                    className="rounded border-stone-300 dark:border-stone-500 text-brand-900 focus:ring-brand-900/20"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-stone-700 dark:text-stone-300 truncate block">
                      {blog.title}
                    </span>
                    {blog.excerpt && (
                      <span className="text-[11px] text-stone-400 dark:text-stone-500 truncate block">
                        {blog.excerpt}
                      </span>
                    )}
                  </div>
                </label>
              ))}
              {(!blogs || blogs.length === 0) && (
                <p className="text-xs text-stone-400 dark:text-stone-500 px-3.5 py-4 text-center">
                  暂无已有博客
                </p>
              )}
            </div>
            {refBlogIds.length > 0 && (
              <div className="px-3.5 py-2 border-t border-stone-100 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setRefBlogIds([])}
                  className="text-[11px] text-red-500 hover:text-red-600 hover:underline"
                >
                  清除全部选择
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 各章节素材输入 */}
      {selectedTemplate?.sections.map((section) => (
        <div key={section.heading}>
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
            {section.heading}
          </label>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mb-1.5">{section.guide}</p>
          <textarea
            value={sectionInputs[section.heading] ?? ''}
            onChange={(e) => handleSectionChange(section.heading, e.target.value)}
            placeholder={section.placeholder}
            rows={3}
            className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-300 dark:placeholder:text-stone-500"
          />
        </div>
      ))}

      {/* 补充信息 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          补充信息 <span className="text-stone-400">（可选）</span>
        </label>
        <textarea
          value={globalNotes}
          onChange={(e) => setGlobalNotes(e.target.value)}
          placeholder="背景、上下文等补充信息…"
          rows={2}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-300 dark:placeholder:text-stone-500"
        />
      </div>

      {/* 特殊要求 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          特殊要求 <span className="text-stone-400">（可选）</span>
        </label>
        <textarea
          value={specialReqs}
          onChange={(e) => setSpecialReqs(e.target.value)}
          placeholder="如：避免使用专业术语、增加案例…"
          rows={2}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-300 dark:placeholder:text-stone-500"
        />
      </div>

      {/* V1.2 B10：共享生成状态条 + 停止按钮（复用既有 AIStatusBar / cancel） */}
      <AIStatusBar status={status === 'generating' ? 'generating' : 'idle'} onCancel={handleCancel} />

      {status === 'error' && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            <RefreshCw size={12} />
            重试
          </button>
        </div>
      )}

      {status === 'done' && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            生成完成（{generatedText.length} 字），已插入编辑器
          </p>
        </div>
      )}

      {/* 生成按钮 */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={cn(
          'w-full py-2.5 rounded-xl text-sm font-medium transition-colors',
          canGenerate
            ? 'bg-brand-900 text-white hover:bg-brand-800 dark:bg-brand-700 dark:hover:bg-brand-600'
            : 'bg-stone-100 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed',
        )}
      >
        {status === 'generating' ? '生成中…' : '生成博客'}
      </button>
    </div>
  );
}
