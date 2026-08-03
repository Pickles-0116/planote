/**
 * Export · /export 导出中心（v1.3 X 模块）
 *
 * 两栏：上排博客导出（MD/HTML 实时预览 + 下载），下排技能导出（多选 → JSON 导出，剔除 id/createdAt）。
 * 与 SkillRepo 导入互逆。
 */

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Boxes, Eye, Check } from 'lucide-react';
import { blogRepo, skillRepo, toExportSkill } from '@/db/repos';
import { tiptapToMarkdown, tiptapToHtml, safeFileName } from '@/lib/tiptapExport';
import type { Blog, Skill } from '@/types/domain';
import { cn } from '@/lib/utils';

const download = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function SectionCard({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-brand-700 dark:text-brand-300">{icon}</span>
        <h2 className="text-lg font-bold text-brand-900 dark:text-stone-100">{title}</h2>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">{desc}</p>
      {children}
    </section>
  );
}

function BlogExport() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [format, setFormat] = useState<'md' | 'html'>('md');

  useEffect(() => {
    blogRepo.list().then(setBlogs).catch(console.error);
  }, []);

  const filtered = useMemo(
    () => blogs.filter((b) => !search || (b.title ?? '').toLowerCase().includes(search.toLowerCase())),
    [blogs, search],
  );

  const previewBlog = blogs.find((b) => b.id === previewId) ?? null;
  const previewText = useMemo(() => {
    if (!previewBlog) return '';
    return format === 'md' ? tiptapToMarkdown(previewBlog.content) : tiptapToHtml(previewBlog.content);
  }, [previewBlog, format]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exportSelected = () => {
    const chosen = blogs.filter((b) => selected.has(b.id));
    chosen.forEach((b) => {
      const md = tiptapToMarkdown(b.content);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${b.title ?? '未命名'}</title></head><body>${tiptapToHtml(b.content)}</body></html>`;
      download(`${safeFileName(b.title ?? 'untitled')}.md`, md, 'text/markdown');
      download(`${safeFileName(b.title ?? 'untitled')}.html`, html, 'text/html');
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* 左：选择 */}
      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索博客标题…"
          className="w-full mb-3 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-900/20"
        />
        <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-1">
          {filtered.map((b) => (
            <label
              key={b.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm border transition',
                selected.has(b.id)
                  ? 'border-brand-900/30 bg-brand-50 dark:bg-stone-700'
                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700/50',
              )}
            >
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="accent-brand-900" />
              <span className="flex-1 truncate text-brand-900 dark:text-stone-100">{b.title ?? '未命名'}</span>
              <button
                type="button"
                onClick={() => setPreviewId(b.id)}
                className="text-stone-400 hover:text-brand-700"
                aria-label="预览"
              >
                <Eye size={14} />
              </button>
            </label>
          ))}
          {filtered.length === 0 && <div className="text-sm text-stone-400 py-6 text-center">没有匹配的博客</div>}
        </div>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={exportSelected}
          className={cn(
            'mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition',
            selected.size > 0 ? 'bg-brand-900 hover:bg-brand-800 text-white' : 'bg-stone-100 text-stone-400 cursor-not-allowed',
          )}
        >
          <Download size={14} /> 下载所选（{selected.size}）MD + HTML
        </button>
      </div>

      {/* 右：预览 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-stone-500">预览格式</span>
          {(['md', 'html'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition',
                format === f ? 'bg-brand-900 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300',
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <pre className="h-80 overflow-y-auto scrollbar-thin rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 p-3 text-xs leading-relaxed text-stone-700 dark:text-stone-200 whitespace-pre-wrap">
          {previewBlog ? previewText : '← 选择左侧博客并点「眼睛」图标预览导出内容'}
        </pre>
      </div>
    </div>
  );
}

function SkillExport() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    skillRepo.list().then(setSkills).catch(console.error);
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exportSelected = () => {
    const chosen = skills.filter((s) => selected.has(s.id));
    const payload = chosen.map(toExportSkill);
    const json = JSON.stringify(payload, null, 2);
    download('planote-skills.json', json, 'application/json');
  };

  const copyAsCustom = async (s: Skill) => {
    const clone: Skill = { ...s, id: '', name: `${s.name}（副本）`, builtin: false, useCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await skillRepo.create({
      name: clone.name,
      description: clone.description,
      type: clone.type,
      folderId: clone.folderId,
      builtin: false,
      promptTemplate: clone.promptTemplate,
      params: clone.params,
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    skillRepo.list().then(setSkills).catch(console.error);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-1">
        {skills.map((s) => (
          <label
            key={s.id}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm border transition',
              selected.has(s.id)
                ? 'border-brand-900/30 bg-brand-50 dark:bg-stone-700'
                : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700/50',
            )}
          >
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="accent-brand-900" />
            <span className="flex-1 truncate text-brand-900 dark:text-stone-100">{s.name}</span>
            {s.builtin && (
              <button type="button" onClick={() => copyAsCustom(s)} className="text-[11px] text-amber-600 hover:underline">
                复制为自定义
              </button>
            )}
          </label>
        ))}
        {skills.length === 0 && <div className="text-sm text-stone-400 py-6 text-center">还没有技能，去「技能」页创建</div>}
      </div>
      <div className="flex flex-col">
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 p-4 text-sm text-stone-600 dark:text-stone-300 flex-1">
          <p className="mb-2 font-medium text-brand-900 dark:text-stone-100">导出说明</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>选中 {selected.size} 个技能，导出为合并 JSON。</li>
            <li>导出自动剔除 <code>id / createdAt / updatedAt</code>，与导入互逆。</li>
            <li>内置技能（标注）不可直接导出，请先「复制为自定义」。</li>
          </ul>
          {copied && (
            <div className="mt-3 inline-flex items-center gap-1 text-xs text-green-600">
              <Check size={12} /> 已复制为自定义技能
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={exportSelected}
          className={cn(
            'mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition',
            selected.size > 0 ? 'bg-brand-900 hover:bg-brand-800 text-white' : 'bg-stone-100 text-stone-400 cursor-not-allowed',
          )}
        >
          <Download size={14} /> 导出 JSON（{selected.size}）
        </button>
      </div>
    </div>
  );
}

export default function ExportPage(): JSX.Element {
  return (
    <div className="max-w-7xl mx-auto px-8 py-8 animate-fadeUp">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">导出</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">一键备份与迁移：博客导出 MD/HTML，技能导出可复用 JSON。</p>
      </div>
      <div className="space-y-6">
        <SectionCard icon={<FileText size={18} />} title="博客导出" desc="勾选博客，实时预览并下载 Markdown / HTML。">
          <BlogExport />
        </SectionCard>
        <SectionCard icon={<Boxes size={18} />} title="技能导出" desc="多选技能，导出剔除内部字段的 JSON（与导入互逆）。">
          <SkillExport />
        </SectionCard>
      </div>
    </div>
  );
}
