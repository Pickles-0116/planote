/**
 * TemplateEditor - 博客模板创建/编辑页
 *
 * 路由：/templates/new → mode='create'
 *       /templates/:id/edit → mode='edit'（通过 useTemplate 加载）
 *
 * 表单字段：
 * - 基本信息：name / description / category / icon
 * - 章节列表：sections[]（heading / guide / placeholder，增删 + 上下移动）
 * - AI 参数：style / tone / audience / minWords / maxWords
 *
 * 操作：Save（createTemplate / updateTemplate）→ 返回列表
 *       Cancel → navigate(-1)
 */

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTemplate } from '../hooks/useTemplates';
import { useBlogTemplateStore } from '../hooks/useBlogTemplateStore';
import type {
  TemplateCategory,
  AIStyleParams,
  FrameworkSection,
} from '@/types/domain';

// ========== 常量 ==========

const CATEGORY_OPTIONS: { label: string; value: TemplateCategory }[] = [
  { label: '复盘', value: 'review' },
  { label: '笔记', value: 'note' },
  { label: '总结', value: 'summary' },
  { label: '习惯', value: 'habit' },
  { label: '决策', value: 'decision' },
  { label: '分析', value: 'analysis' },
  { label: '自定义', value: 'custom' },
];

const STYLE_OPTIONS: { label: string; value: AIStyleParams['style'] }[] = [
  { label: '专业', value: 'professional' },
  { label: '轻松', value: 'casual' },
  { label: '学术', value: 'academic' },
  { label: '叙事', value: 'narrative' },
  { label: '自定义', value: 'custom' },
];

const TONE_OPTIONS: { label: string; value: AIStyleParams['tone'] }[] = [
  { label: '积极', value: 'positive' },
  { label: '中性', value: 'neutral' },
  { label: '反思', value: 'reflective' },
  { label: '自定义', value: 'custom' },
];

const AUDIENCE_OPTIONS: { label: string; value: AIStyleParams['audience'] }[] = [
  { label: '自己', value: 'self' },
  { label: '团队', value: 'team' },
  { label: '公开', value: 'public' },
  { label: '自定义', value: 'custom' },
];

const EMPTY_SECTION: FrameworkSection = { heading: '', guide: '', placeholder: '' };

const DEFAULT_AI: AIStyleParams = {
  style: 'professional',
  tone: 'neutral',
  audience: 'self',
  minWords: 500,
  maxWords: 2000,
};

// ========== 共享 UI 原语 ==========

const inputCls = cn(
  'w-full px-3 py-2 text-sm rounded-xl border',
  'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700',
  'focus:border-brand-500 focus:outline-none transition',
  'placeholder:text-brand-300 dark:placeholder:text-stone-500',
);

const labelCls = 'block text-xs font-medium text-brand-600 dark:text-stone-400 mb-1';

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map(({ label: optLabel, value: optVal }) => (
          <button
            key={optVal}
            type="button"
            onClick={() => onChange(optVal)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-xl transition',
              value === optVal
                ? 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'bg-stone-100 dark:bg-stone-700 text-brand-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600',
            )}
          >
            {optLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

// ========== 主组件 ==========

export default function TemplateEditor(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mode = id ? 'edit' : 'create';
  const existing = useTemplate(id);

  const { createTemplate, updateTemplate } = useBlogTemplateStore();

  // ---- 表单状态 ----
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('review');
  const [icon, setIcon] = useState('FileText');
  const [sections, setSections] = useState<FrameworkSection[]>([{ ...EMPTY_SECTION }]);
  const [aiParams, setAiParams] = useState<AIStyleParams>({ ...DEFAULT_AI });
  const [saving, setSaving] = useState(false);

  // 编辑模式：加载已有数据
  const loaded = useMemo(() => mode === 'edit' && !!existing, [mode, existing]);
  useEffect(() => {
    if (loaded) {
      setName(existing!.name);
      setDescription(existing!.description);
      setCategory(existing!.category);
      setIcon(existing!.icon);
      setSections(existing!.sections.length > 0 ? existing!.sections.map((s) => ({ ...s })) : [{ ...EMPTY_SECTION }]);
      setAiParams({ ...existing!.aiParams });
    }
  }, [loaded, existing]);

  // ---- 章节操作 ----
  const updateSection = (idx: number, field: keyof FrameworkSection, val: string) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));
  };
  const addSection = () => setSections((prev) => [...prev, { ...EMPTY_SECTION }]);
  const removeSection = (idx: number) =>
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // ---- 校验 ----
  const nameValid = name.trim().length >= 1 && name.length <= 50;
  const descValid = description.length <= 200;
  const canSave = nameValid && descValid && !saving;

  // ---- 提交 ----
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        icon,
        sections: sections.filter((s) => s.heading.trim()),
        aiParams,
        tagIds: existing?.tagIds ?? [],
        builtin: mode === 'edit' ? existing!.builtin : false,
      };
      if (mode === 'create') {
        const created = await createTemplate(payload);
        navigate(`/templates/${created.id}/edit`);
      } else {
        await updateTemplate(id!, payload);
        navigate('/templates');
      }
    } catch {
      // 错误已由 store 处理（toast / error state）
    } finally {
      setSaving(false);
    }
  };

  // ---- 加载中 ----
  if (mode === 'edit' && !existing) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* ── 顶部栏 ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-200 transition"
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <h1 className="text-lg font-bold text-brand-900 dark:text-stone-100">
          {mode === 'create' ? '新建模板' : '编辑模板'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 text-brand-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700 transition"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-xl transition shadow-sm',
              canSave
                ? 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-brand-800 dark:hover:bg-stone-200'
                : 'bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </div>

      {/* ── 基本信息 ── */}
      <section className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100">基本信息</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* 名称 */}
          <div>
            <label className={labelCls}>
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="如：项目复盘"
              className={cn(inputCls, !nameValid && name.length > 0 && 'border-red-400')}
            />
            <span className="text-[10px] text-brand-400 dark:text-stone-500 mt-0.5 block">
              {name.length}/50
            </span>
          </div>
          {/* 图标 */}
          <div>
            <label className={labelCls}>图标名称</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="lucide 图标名，如 FileText"
              className={inputCls}
            />
          </div>
        </div>

        {/* 描述 */}
        <div>
          <label className={labelCls}>描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="一句话说明此模板的用途…"
            className={cn(inputCls, 'resize-none')}
          />
          <span className={cn('text-[10px] mt-0.5 block', descValid ? 'text-brand-400 dark:text-stone-500' : 'text-red-500')}>
            {description.length}/200
          </span>
        </div>

        {/* 分类 */}
        <div>
          <label className={labelCls}>分类</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map(({ label: optLabel, value: optVal }) => (
              <button
                key={optVal}
                type="button"
                onClick={() => setCategory(optVal)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-xl transition',
                  category === optVal
                    ? 'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900'
                    : 'bg-stone-100 dark:bg-stone-700 text-brand-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600',
                )}
              >
                {optLabel}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 章节列表 ── */}
      <section className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100">章节结构</h2>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-200 transition"
          >
            <Plus size={12} /> 添加章节
          </button>
        </div>

        <div className="space-y-3">
          {sections.map((sec, idx) => (
            <div
              key={idx}
              className="border border-stone-200 dark:border-stone-700 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-500 dark:text-stone-400">
                  章节 {idx + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => moveSection(idx, -1)} disabled={idx === 0}
                    className="p-1 rounded-lg text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition">
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}
                    className="p-1 rounded-lg text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-30 transition">
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" onClick={() => removeSection(idx)} disabled={sections.length <= 1}
                    className="p-1 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={sec.heading}
                  onChange={(e) => updateSection(idx, 'heading', e.target.value)}
                  placeholder="章节标题"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={sec.guide}
                  onChange={(e) => updateSection(idx, 'guide', e.target.value)}
                  placeholder="引导问题"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={sec.placeholder}
                  onChange={(e) => updateSection(idx, 'placeholder', e.target.value)}
                  placeholder="占位提示"
                  className={inputCls}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI 参数 ── */}
      <section className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100">AI 写作参数</h2>

        <RadioGroup
          label="写作风格"
          options={STYLE_OPTIONS}
          value={aiParams.style}
          onChange={(v) => setAiParams((p) => ({ ...p, style: v, styleDescription: v === 'custom' ? p.styleDescription : undefined }))}
        />
        {aiParams.style === 'custom' && (
          <input
            type="text"
            value={aiParams.styleDescription ?? ''}
            onChange={(e) => setAiParams((p) => ({ ...p, styleDescription: e.target.value }))}
            placeholder="描述你想要的写作风格…"
            className={inputCls}
          />
        )}

        <RadioGroup
          label="语气"
          options={TONE_OPTIONS}
          value={aiParams.tone}
          onChange={(v) => setAiParams((p) => ({ ...p, tone: v }))}
        />

        <RadioGroup
          label="目标读者"
          options={AUDIENCE_OPTIONS}
          value={aiParams.audience}
          onChange={(v) => setAiParams((p) => ({ ...p, audience: v }))}
        />

        {/* 字数范围 */}
        <div>
          <span className={labelCls}>字数范围</span>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-brand-400 dark:text-stone-500">最少</label>
              <input
                type="number"
                min={100}
                max={aiParams.maxWords}
                step={100}
                value={aiParams.minWords}
                onChange={(e) => setAiParams((p) => ({ ...p, minWords: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <span className="text-brand-400 dark:text-stone-500 pt-4">—</span>
            <div className="flex-1">
              <label className="text-[10px] text-brand-400 dark:text-stone-500">最多</label>
              <input
                type="number"
                min={aiParams.minWords}
                max={10000}
                step={100}
                value={aiParams.maxWords}
                onChange={(e) => setAiParams((p) => ({ ...p, maxWords: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
