/**
 * SkillPickPanel · 博客多选 → AI 总结 Skill 面板（v1.3-fix F3 · T12）
 *
 * 复用组件：/blogs 列表 与 /folders 详情页 共用。
 * 流程：选技能（类型筛选 + 搜索）→ 填参（SkillParam schema）→ 流式生成 → 复制。
 *
 * Props：
 * - blogIds：已选博客 id（调用方传入，≤10 篇由调用方约束）
 * - open：控制显示/隐藏
 * - onClose：关闭回调（关闭时若在生成中会自动 cancel）
 */

import { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Search, Sparkles, Square, X } from 'lucide-react';
import { skillRepo, blogRepo } from '@/db/repos';
import { useAIGenerate } from '@/features/ai/hooks/useAIGenerate';
import { cn } from '@/lib/utils';
import type { Blog, ID, Skill, SkillParam, SkillType } from '@/types/domain';

const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  summary: '总结',
  writing: '写作',
  imitate: '仿写',
  translate: '改写',
  custom: '自定义',
};

const TYPE_CHIPS: Array<{ value: SkillType | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'summary', label: '总结' },
  { value: 'writing', label: '写作' },
  { value: 'imitate', label: '仿写' },
  { value: 'translate', label: '改写' },
  { value: 'custom', label: '自定义' },
];

/** 单篇博客注入字数上限（与 executeStep.ts 对齐）。 */
const BLOG_CHAR_LIMIT = 1500;
/** 注入博客篇数上限。 */
const BLOG_COUNT_LIMIT = 10;

/** select 类型参数：SkillParam 无 options 字段，选项取自 default（支持逗号/顿号/竖线分隔）。 */
function splitSelectOptions(def?: string): string[] {
  if (!def) return [''];
  const parts = def
    .split(/[,，、|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [def];
}

const inputCls =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-brand-900/50 focus:ring-2 focus:ring-brand-900/10 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100';

interface SkillPickPanelProps {
  open: boolean;
  blogIds: ID[];
  onClose: () => void;
}

export default function SkillPickPanel({ open, blogIds, onClose }: SkillPickPanelProps): JSX.Element | null {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<SkillType | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // 复用现有 AI 生成 hook（与编辑器 AI 一致的流式体验）
  const { status, generatedText, errorMessage, generate, cancel, reset } = useAIGenerate('chat');

  // 打开时：重置状态 + 加载技能
  useEffect(() => {
    if (!open) return;
    let alive = true;
    reset();
    setSelectedSkill(null);
    setParamValues({});
    setCopied(false);
    setSkills(null);
    skillRepo.list().then((list) => {
      if (alive) setSkills(list);
    });
    return () => {
      alive = false;
    };
  }, [open, reset]);

  // 关闭时若在生成中则停止
  useEffect(() => {
    if (!open && status === 'generating') {
      cancel();
    }
  }, [open, status, cancel]);

  const visibleSkills = useMemo(() => {
    if (!skills) return [];
    const kw = keyword.trim().toLowerCase();
    return skills.filter((s) => {
      const okType = typeFilter === 'all' || s.type === typeFilter;
      const okKw =
        !kw ||
        s.name.toLowerCase().includes(kw) ||
        (s.description ?? '').toLowerCase().includes(kw);
      return okType && okKw;
    });
  }, [skills, typeFilter, keyword]);

  const handleSelectSkill = (skill: Skill): void => {
    setSelectedSkill(skill);
    const init: Record<string, string> = {};
    for (const p of skill.params) init[p.key] = p.default ?? '';
    setParamValues(init);
  };

  const buildPrompt = async (skill: Skill): Promise<string> => {
    let prompt = skill.promptTemplate;
    // 注入 {{blogs}}：blogRepo.listByIds → contentText 每篇截断 1500 字
    if (prompt.includes('{{blogs}}')) {
      const blogs = await blogRepo.listByIds(blogIds.slice(0, BLOG_COUNT_LIMIT));
      if (blogs.length > 0) {
        const injected = blogs
          .map(
            (b: Blog, i: number) =>
              `${i + 1}. ${b.title}\n${(b.contentText ?? '').slice(0, BLOG_CHAR_LIMIT)}`,
          )
          .join('\n\n---\n\n');
        prompt = prompt.split('{{blogs}}').join(injected);
      } else {
        prompt = prompt.split('{{blogs}}').join('（未找到所选博客内容）');
      }
    }
    // 注入参数占位符
    for (const p of skill.params) {
      const v = paramValues[p.key] ?? p.default ?? '';
      prompt = prompt.split(`{{${p.key}}}`).join(v);
    }
    return prompt;
  };

  const handleGenerate = async (): Promise<void> => {
    if (!selectedSkill) return;
    const prompt = await buildPrompt(selectedSkill);
    await generate([
      { role: 'system', content: '你是 Planote 的 AI 助手，请严格按用户模板执行。' },
      { role: 'user', content: prompt },
    ]);
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩：点击关闭 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[86vh] w-[min(680px,94vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-stone-900">
        {/* 顶部：标题 + 关闭 */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5 dark:border-stone-700">
          <h3 className="flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
            <Sparkles size={16} className="text-brand-900 dark:text-brand-400" />
            AI 总结
            <span className="text-xs font-normal text-stone-400">已选 {blogIds.length} 篇</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* 类型筛选 chips */}
          <div className="flex flex-wrap gap-2">
            {TYPE_CHIPS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setTypeFilter(c.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  typeFilter === c.value
                    ? 'border-brand-900 bg-brand-900 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-stone-900'
                    : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索技能名称…"
              className={cn(inputCls, 'pl-9')}
            />
          </div>

          {/* 技能列表 */}
          {skills === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-400">
              <Loader2 size={14} className="animate-spin" />
              加载技能中…
            </div>
          ) : visibleSkills.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-400">没有匹配的技能</p>
          ) : (
            <div className="space-y-2">
              {visibleSkills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSkill(s)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition',
                    selectedSkill?.id === s.id
                      ? 'border-brand-900/60 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20'
                      : 'border-stone-200 bg-white hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800/50 dark:hover:border-stone-600',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{s.name}</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-700 dark:text-stone-300">
                      {SKILL_TYPE_LABELS[s.type]}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{s.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 参数表单 + 生成 */}
          {selectedSkill && (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-700 dark:bg-stone-800/40">
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                参数填写 <span className="text-xs font-normal text-stone-400">（{selectedSkill.name}）</span>
              </p>
              {selectedSkill.params.length === 0 ? (
                <p className="text-xs text-stone-400">该技能无需填写参数</p>
              ) : (
                selectedSkill.params.map((p: SkillParam) => {
                  const value = paramValues[p.key] ?? p.default ?? '';
                  const setValue = (v: string): void =>
                    setParamValues((prev) => ({ ...prev, [p.key]: v }));
                  return (
                    <div key={p.key} className="space-y-1">
                      <label className="text-xs font-medium text-stone-600 dark:text-stone-300">
                        {p.label}
                      </label>
                      {p.type === 'textarea' ? (
                        <textarea
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          rows={3}
                          className={cn(inputCls, 'resize-none')}
                        />
                      ) : p.type === 'number' ? (
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className={inputCls}
                        />
                      ) : p.type === 'select' ? (
                        <select
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className={inputCls}
                        >
                          {splitSelectOptions(p.default).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className={inputCls}
                        />
                      )}
                    </div>
                  );
                })
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={status === 'generating'}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition',
                    status === 'generating'
                      ? 'cursor-not-allowed bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
                      : 'bg-brand-900 text-white hover:bg-brand-800 dark:bg-brand-400 dark:text-stone-900 dark:hover:bg-brand-300',
                  )}
                >
                  <Sparkles size={14} />
                  {status === 'generating' ? '生成中…' : '生成'}
                </button>
                {status === 'generating' && (
                  <button
                    type="button"
                    onClick={cancel}
                    className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <Square size={12} fill="currentColor" />
                    停止
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 生成错误 */}
          {status === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {errorMessage || '生成失败，请重试'}
            </div>
          )}

          {/* 流式结果区 */}
          {(status === 'generating' || status === 'done' || status === 'cancelled') && (
            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-700 dark:bg-stone-800/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  {status === 'cancelled' ? '已停止（部分结果）' : '生成结果'}
                </p>
                {status === 'done' && (
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className={cn(
                      'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition',
                      copied
                        ? 'border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
                    )}
                  >
                    <Copy size={12} />
                    {copied ? '已复制' : '复制'}
                  </button>
                )}
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs leading-relaxed text-stone-700 dark:bg-stone-900 dark:text-stone-200">
                {generatedText || (status === 'generating' ? 'AI 正在写作…' : '')}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
