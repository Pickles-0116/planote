/**
 * ImitateGenerator - 风格仿写模式 UI
 *
 * 两步生成：
 * 1. 从选中的历史博客提取风格特征
 * 2. 基于风格 + 新主题/素材生成博客
 */

import { useState, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useBlogs } from '@/stores';
import { useTemplates } from '@/features/templates/hooks/useTemplates';
import { useAIGenerate } from '../hooks/useAIGenerate';
import { buildStyleAnalysisPrompt, buildImitatePrompt } from '../prompts';
import { markdownToTiptapJSON } from '@/features/blog/utils/markdownToTiptap';
import { cn } from '@/lib/utils';

interface Props {
  editor?: Editor | null;
}

type Phase = 'idle' | 'analyzing' | 'generating' | 'done' | 'error';

export default function ImitateGenerator({ editor }: Props): JSX.Element {
  const blogs = useBlogs();
  const templates = useTemplates();

  const [selectedBlogIds, setSelectedBlogIds] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { generate } = useAIGenerate('imitate');

  const toggleBlog = useCallback((id: string) => {
    setSelectedBlogIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  }, []);

  const canGenerate =
    selectedBlogIds.length >= 1 &&
    topic.trim().length >= 10 &&
    topic.trim().length <= 200 &&
    phase !== 'analyzing' &&
    phase !== 'generating';

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !blogs) return;

    try {
      // Step 1: 风格分析
      setPhase('analyzing');
      setErrorMsg(null);
      const refTexts = selectedBlogIds
        .map((id) => blogs.find((b) => b.id === id)?.contentText ?? '')
        .filter(Boolean);

      const analysis = buildStyleAnalysisPrompt({ refBlogTexts: refTexts });
      const styleJson = await generate([
        { role: 'system', content: analysis.system },
        { role: 'user', content: analysis.user },
      ]);
      if (!styleJson) {
        setPhase('error');
        setErrorMsg('风格分析失败，请重试');
        return;
      }

      // Step 2: 仿写生成
      setPhase('generating');
      const tpl = templates?.find((t) => t.id === templateId);
      const imitate = buildImitatePrompt({
        styleProfile: styleJson,
        topic: topic.trim(),
        keyPoints: keyPoints.trim() || undefined,
        templateSections: tpl?.sections.map((s) => ({ heading: s.heading, guide: s.guide })),
      });
      const md = await generate([
        { role: 'system', content: imitate.system },
        { role: 'user', content: imitate.user },
      ]);

      if (md && editor) {
        const json = markdownToTiptapJSON(md);
        editor.commands.setContent(json as never);
      }
      setPhase('done');
    } catch (err) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : '生成失败');
    }
  }, [canGenerate, blogs, selectedBlogIds, topic, keyPoints, templateId, templates, generate, editor]);

  return (
    <div className="p-5 space-y-4">
      {/* 博客选择 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          选择参考博客 <span className="text-stone-400">（1-10 篇）</span>
        </label>
        <div className="max-h-52 overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-600 divide-y divide-stone-100 dark:divide-stone-700">
          {blogs?.slice(0, 50).map((blog) => (
            <label
              key={blog.id}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700/50"
            >
              <input
                type="checkbox"
                checked={selectedBlogIds.includes(blog.id)}
                onChange={() => toggleBlog(blog.id)}
                disabled={!selectedBlogIds.includes(blog.id) && selectedBlogIds.length >= 10}
                className="rounded border-stone-300 dark:border-stone-500 text-brand-900 focus:ring-brand-900/20"
              />
              <span className="text-sm text-stone-700 dark:text-stone-300 truncate">
                {blog.title}
              </span>
            </label>
          ))}
          {(!blogs || blogs.length === 0) && (
            <p className="text-xs text-stone-400 dark:text-stone-500 px-3 py-4 text-center">
              暂无博客
            </p>
          )}
        </div>
      </div>

      {/* 主题 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          新博客主题
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value.slice(0, 200))}
          placeholder="输入主题（10-200 字）"
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-300 dark:placeholder:text-stone-500"
        />
        <p className="text-[11px] text-stone-400 mt-1 text-right">{topic.length} / 200</p>
      </div>

      {/* 核心要点 */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          核心要点 <span className="text-stone-400">（可选）</span>
        </label>
        <textarea
          value={keyPoints}
          onChange={(e) => setKeyPoints(e.target.value)}
          placeholder="新博客需要涵盖的关键信息…"
          rows={3}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-900/20 placeholder:text-stone-300 dark:placeholder:text-stone-500"
        />
      </div>

      {/* 模板叠加（可选） */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
          叠加模板结构 <span className="text-stone-400">（可选）</span>
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm text-stone-800 dark:text-stone-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-900/20"
        >
          <option value="">不使用模板</option>
          {templates?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* 状态 */}
      {(phase === 'analyzing' || phase === 'generating') && (
        <div className="flex items-center gap-2 text-sm text-brand-900 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded-xl px-4 py-3">
          <Loader2 size={16} className="animate-spin" />
          {phase === 'analyzing' ? '正在分析写作风格…' : '正在仿写生成…'}
        </div>
      )}
      {phase === 'error' && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
          <button type="button" onClick={handleGenerate} className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline">
            <RefreshCw size={12} /> 重试
          </button>
        </div>
      )}
      {phase === 'done' && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-400">仿写完成，已插入编辑器</p>
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
        {phase === 'analyzing' || phase === 'generating' ? '生成中…' : '仿写生成'}
      </button>
    </div>
  );
}
