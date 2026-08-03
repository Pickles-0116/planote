/**
 * SkillEditorPage · 技能创建/编辑独立页（v1.3 P0-4）
 *
 * 路由：
 * - `/skills/new`      → mode='create'
 * - `/skills/:id/edit` → mode='edit'（useParams 取 :id 加载）
 *
 * 取代原 Skills.tsx 内的 fixed 遮罩弹窗：纯整宽表单，无左侧文件夹树，
 * 技能所属文件夹用下拉选择（保留原 `folderId` 字段语义）。
 * 版式参照已验证的 TemplateEditor：顶部返回 / 标题 / 取消·保存，提交后 navigate('/skills')。
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { skillRepo, skillFolderRepo, ROOT_SKILL_FOLDER_ID } from '@/db/repos';
import type { Skill, SkillFolder, SkillParam, SkillType } from '@/types/domain';
import { cn } from '@/lib/utils';

// ========== 常量 ==========

const TYPE_OPTIONS: Array<{ label: string; value: SkillType }> = [
  { label: '总结', value: 'summary' },
  { label: '写作', value: 'writing' },
  { label: '仿写', value: 'imitate' },
  { label: '改写', value: 'translate' },
  { label: '自定义', value: 'custom' },
];

const PARAM_TYPES: Array<SkillParam['type']> = ['text', 'textarea', 'number', 'select'];

/** 参数 key 命名规则（字母开头，字母/数字/下划线）。 */
const VALID_KEY = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** 预览用的全局占位符示例值。 */
const SAMPLE_CTX: Record<string, string> = {
  blogs: '[示例博客内容…共 N 篇]',
  topic: '示例主题',
  text: '[待处理文本]',
  instruction: '[指令]',
  target: 'English',
};

const sampleFor = (key: string): string => `<示例:${key}>`;

/** 占位符闭合校验：`{{` 与 `}}` 数量必须一致。 */
function validateTemplate(tpl: string): string | null {
  const open = (tpl.match(/\{\{/g) ?? []).length;
  const close = (tpl.match(/\}\}/g) ?? []).length;
  if (open !== close) {
    return `占位符未闭合：{{ 与 }} 数量不一致（${open} vs ${close}），保存将被拦截。`;
  }
  return null;
}

/** 用示例值渲染模板预览。 */
function renderPreview(tpl: string, params: SkillParam[]): string {
  const ctx: Record<string, string> = { ...SAMPLE_CTX };
  params.forEach((p) => {
    if (p.key) ctx[p.key] = p.default ? `<${p.label || p.key}:${p.default}>` : sampleFor(p.key);
  });
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k in ctx ? ctx[k] : `{{${k}}}`));
}

// ========== 共享 UI 原语 ==========

const inputCls = cn(
  'w-full px-3 py-2 text-sm rounded-xl border',
  'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700',
  'text-brand-900 dark:text-stone-100',
  'focus:border-brand-500 focus:outline-none transition',
  'placeholder:text-brand-300 dark:placeholder:text-stone-500',
);

const labelCls = 'block text-xs font-medium text-brand-600 dark:text-stone-400 mb-1';

// ========== 主组件 ==========

export default function SkillEditorPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mode: 'create' | 'edit' = id ? 'edit' : 'create';

  const [folders, setFolders] = useState<SkillFolder[]>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- 表单状态 ----
  const [name, setName] = useState('');
  const [type, setType] = useState<SkillType>('summary');
  const [folderId, setFolderId] = useState('');
  const [description, setDescription] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [params, setParams] = useState<SkillParam[]>([]);
  const [builtin, setBuiltin] = useState(false);
  const [useCount, setUseCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(true);

  // ---- 加载文件夹 ----
  useEffect(() => {
    skillFolderRepo
      .list()
      .then(setFolders)
      .catch((err) => console.error('[SkillEditorPage] 加载技能文件夹失败', err));
  }, []);

  // ---- 编辑模式：加载已有技能 ----
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    setLoading(true);
    skillRepo
      .get(id)
      .then((skill: Skill | undefined) => {
        if (cancelled) return;
        if (!skill) {
          setLoadError('技能不存在或已被删除');
          setLoading(false);
          return;
        }
        setName(skill.name);
        setType(skill.type);
        setFolderId(skill.folderId === ROOT_SKILL_FOLDER_ID ? '' : skill.folderId);
        setDescription(skill.description ?? '');
        setPromptTemplate(skill.promptTemplate);
        setParams(skill.params.map((p) => ({ ...p })));
        setBuiltin(skill.builtin);
        setUseCount(skill.useCount);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[SkillEditorPage] 加载技能失败', err);
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, id]);

  // ---- 派生 ----
  const warn = useMemo(() => validateTemplate(promptTemplate), [promptTemplate]);
  const preview = useMemo(() => renderPreview(promptTemplate, params), [promptTemplate, params]);
  const nameValid = name.trim().length > 0;
  const canSave = nameValid && !warn && !saving && !loading;

  // ---- 参数操作 ----
  const addParam = (): void =>
    setParams((prev) => [...prev, { key: '', label: '', type: 'text', default: '' }]);
  const updateParam = (idx: number, patch: Partial<SkillParam>): void =>
    setParams((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const removeParam = (idx: number): void =>
    setParams((prev) => prev.filter((_, i) => i !== idx));

  // ---- 提交 ----
  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || '未命名技能',
        description: description.trim() || undefined,
        type,
        folderId: folderId || ROOT_SKILL_FOLDER_ID,
        builtin,
        promptTemplate,
        params: params.filter((p) => p.key.trim()),
      };
      if (mode === 'create') {
        await skillRepo.create({ ...payload, useCount: 0 });
      } else {
        await skillRepo.update(id!, { ...payload, useCount });
      }
      navigate('/skills');
    } catch (err) {
      console.error('[SkillEditorPage] 保存失败', err);
      alert(`保存失败：${err instanceof Error ? err.message : String(err)}\n（按 F12 看完整堆栈）`);
    } finally {
      setSaving(false);
    }
  };

  // ---- 加载中 / 加载失败 ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto py-24 text-center">
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate('/skills')}
          className="px-4 py-2 rounded-xl bg-brand-900 hover:bg-brand-800 text-white text-sm font-medium transition"
        >
          返回技能列表
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl mx-auto animate-fadeUp">
      {/* ── 顶部栏 ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/skills')}
          className="inline-flex items-center gap-1.5 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-200 transition"
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <h1 className="text-lg font-bold text-brand-900 dark:text-stone-100">
          {mode === 'create' ? '新建技能' : '编辑技能'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/skills')}
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

        <div>
          <label className={labelCls}>
            技能名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：月度总结"
            className={cn(inputCls, !nameValid && name.length > 0 && 'border-red-400')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SkillType)}
              className={inputCls}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>所属文件夹</label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className={inputCls}
            >
              <option value="">全部技能（未分类）</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>描述（可选）</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="一句话说明用途"
            className={inputCls}
          />
        </div>
      </section>

      {/* ── Prompt 模板 ── */}
      <section className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100">Prompt 模板</h2>
        <textarea
          value={promptTemplate}
          onChange={(e) => setPromptTemplate(e.target.value)}
          rows={12}
          placeholder="用 {{blogs}} 引用博客，{{topic}} 引用主题…"
          className={cn(inputCls, 'font-mono text-xs leading-relaxed resize-y')}
        />
        {warn && <p className="text-xs text-red-500">{warn}</p>}
      </section>

      {/* ── 参数 ── */}
      <section className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100">参数（可选）</h2>
          <button
            type="button"
            onClick={addParam}
            className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-200 transition"
          >
            <Plus size={12} /> 添加参数
          </button>
        </div>

        <div className="space-y-1.5">
          {params.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-2 sm:grid-cols-[1.2fr_1.2fr_1fr_1.2fr_auto] gap-1.5 items-center"
            >
              <input
                value={p.key}
                onChange={(e) => updateParam(i, { key: e.target.value })}
                placeholder="key"
                className={cn(inputCls, p.key && !VALID_KEY.test(p.key) && 'border-red-400')}
              />
              <input
                value={p.label}
                onChange={(e) => updateParam(i, { label: e.target.value })}
                placeholder="展示名"
                className={inputCls}
              />
              <select
                value={p.type}
                onChange={(e) => updateParam(i, { type: e.target.value as SkillParam['type'] })}
                className={inputCls}
              >
                {PARAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                value={p.default ?? ''}
                onChange={(e) => updateParam(i, { default: e.target.value })}
                placeholder="默认值"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeParam(i)}
                className="text-stone-400 hover:text-red-500 justify-self-end p-1"
                aria-label="删除参数"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {params.length === 0 && (
            <p className="text-xs text-stone-400">
              无参数时，模板直接使用 {'{{blogs}}'} 等全局占位符。
            </p>
          )}
        </div>
      </section>

      {/* ── 实时预览 ── */}
      <section className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-brand-900 dark:text-stone-100">
            实时预览 <span className="text-xs font-normal text-stone-400">{preview.length} 字符</span>
          </h2>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="inline-flex items-center gap-0.5 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition"
          >
            {previewOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {previewOpen ? '收起' : '展开'}
          </button>
        </div>
        {previewOpen && (
          <pre className="max-h-[40vh] overflow-y-auto scrollbar-thin rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-3 text-xs text-stone-700 dark:text-stone-200 whitespace-pre-wrap">
            {preview || '（模板为空）'}
          </pre>
        )}
      </section>
    </form>
  );
}
