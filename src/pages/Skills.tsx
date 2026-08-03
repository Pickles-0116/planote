/**
 * Skills · /skills 技能管理（v1.3 S 模块）
 *
 * 左：技能文件夹树（独立 skillFolders 表，与博客 folders 隔离）
 * 右：类型 chips + 搜索 + 网格/列表切换 + 批量导入/新建
 * 编辑：v1.3 P0-4 起改为独立页 `/skills/new` 与 `/skills/:id/edit`
 *      （原 fixed 遮罩弹窗 SkillEditor 已移除，见 pages/skills/SkillEditorPage.tsx）
 * 批量导入：支持多文件 .json/.md；格式不兼容的文件照样原样收藏（status:'raw'），
 *          不卡导入、不丢文件，后续可在卡片上点「修复」就地转成可用技能。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes, Plus, Search, Grid3x3, List, FolderPlus, Upload, FileDown,
  Pencil, FileText, PenLine, Languages, Wand2, Component,
} from 'lucide-react';
import { skillRepo, skillFolderRepo, ROOT_SKILL_FOLDER_ID, toExportSkill } from '@/db/repos';
import {
  importSkillRaws,
  prepareSkillImport,
  repairSkillById,
} from '@/features/skills/utils/importSkills';
import { SkillImportRepairDialog } from '@/features/skills/components/SkillImportRepairDialog';
import type { Skill, SkillFolder, SkillType } from '@/types/domain';
import { cn } from '@/lib/utils';

const TYPE_META: Record<SkillType, { label: string; icon: React.ReactNode; color: string }> = {
  summary: { label: '总结', icon: <FileText size={12} />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  writing: { label: '写作', icon: <PenLine size={12} />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  imitate: { label: '仿写', icon: <Wand2 size={12} />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  translate: { label: '改写', icon: <Languages size={12} />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  custom: { label: '自定义', icon: <Component size={12} />, color: 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300' },
};

export default function SkillsPage(): JSX.Element {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [folders, setFolders] = useState<SkillFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<ID>(ROOT_SKILL_FOLDER_ID);
  const [type, setType] = useState<SkillType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  /** 正在修复的「原样收藏」技能（卡片上点「修复」触发）。修复对话框就地更新该记录。 */
  const [repairing, setRepairing] = useState<{ id: ID; name: string; rawText: string; errorMessage: string } | null>(null);

  const reload = () => {
    skillRepo.list().then(setSkills).catch(console.error);
    skillFolderRepo.list().then(setFolders).catch(console.error);
  };
  useEffect(reload, []);

  const visible = useMemo(
    () => skills.filter((s) => {
      if (activeFolder !== ROOT_SKILL_FOLDER_ID && s.folderId !== activeFolder) return false;
      if (type !== 'all' && s.type !== type) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [skills, activeFolder, type, search],
  );

  const toggle = (id: ID) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /** 新建技能 → 独立页 `/skills/new`（v1.3 P0-4，取代原遮罩弹窗）。 */
  const goCreate = () => navigate('/skills/new');

  /** 编辑技能 → 独立页 `/skills/:id/edit`。 */
  const goEdit = (id: ID) => navigate(`/skills/${id}/edit`);

/** 下载示例 .md（F2：给用户一个可参考的手编格式，含两条示例）。 */
const downloadSkillMdExample = () => {
  const sample = [
    [
      '---',
      'name: 月度总结',
      'type: summary',
      'folder: 总结',
      'description: 把 N 篇博客汇总成一篇月度总结',
      'params:',
      '  - key: topic',
      '    label: 主题',
      '    type: text',
      '    default: 七月',
      '---',
      '请总结以下博客内容（主题：{{topic}}）：\n{{blogs}}',
    ].join('\n'),
    [
      '---',
      'name: 周报助手',
      'type: custom',
      'folder: 全部技能',
      'description: 可省略 description / folder / params 整块',
      '---',
      '根据本周事项生成周报：{{blogs}}',
    ].join('\n'),
  ].join('\n---\n');

  const blob = new Blob([sample], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'planote-skills-example.md';
  a.click();
  URL.revokeObjectURL(url);
};

const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  let importedReady = 0;
  let collectedRaw = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      const prepared = await prepareSkillImport(file);
      if (prepared.status === 'ready') {
        const result = await importSkillRaws(prepared.raws);
        importedReady += result.imported;
        continue;
      }
      // needs-repair / fatal：照样「原样收藏」，不卡导入、不丢文件。
      const text =
        prepared.status === 'needs-repair'
          ? prepared.text
          : await file.text();
      await skillRepo.create({
        name: file.name.replace(/\.(md|markdown|json)$/i, ''),
        description: '格式不兼容，已原样收藏；点「修复」可转成可用技能',
        type: 'custom',
        folderId: ROOT_SKILL_FOLDER_ID,
        builtin: false,
        promptTemplate: '',
        params: [],
        status: 'raw',
        rawText: text,
      });
      collectedRaw += 1;
    } catch (err) {
      errors.push(`【${file.name}】${err instanceof Error ? err.message : String(err)}`);
    }
  }

  reload();
  if (errors.length > 0) {
    alert(
      `批量导入完成\n格式合规导入：${importedReady} 个\n原样收藏（待修复）：${collectedRaw} 个\n失败 ${errors.length} 项：\n${errors.join('\n')}`,
    );
  } else if (collectedRaw > 0) {
    alert(`导入完成：合规 ${importedReady} 个，原样收藏（待修复）${collectedRaw} 个。待修复的可在卡片上点「修复」。`);
  } else {
    alert(`已导入 ${importedReady} 个技能`);
  }

  if (fileRef.current) fileRef.current.value = '';
};

/** 确认 AI 修复后的文本 → 就地更新该「原样收藏」技能为可用状态。 */
const handleRepairConfirm = async (fixedText: string) => {
  if (!repairing) return;
  try {
    const result = await repairSkillById(repairing.id, fixedText);
    setRepairing(null);
    reload();
    alert(`已修复并启用 ${result.imported} 个技能`);
  } catch (err) {
    // 交给对话框内的 error 区域展示，不关闭弹窗，便于用户手动微调后重试。
    throw err;
  }
};

/** 卡片点「修复」→ 打开 AI 修复对话框（携带该技能的原始文本）。 */
const openRepair = (skill: Skill) => {
  setRepairing({
    id: skill.id,
    name: skill.name,
    rawText: skill.rawText ?? '',
    errorMessage: '该技能导入时格式不兼容，已原样收藏。点「用 AI 帮我整理」生成标准格式。',
  });
};

  const handleExport = () => {
    const chosen = selected.size > 0 ? skills.filter((s) => selected.has(s.id)) : skills;
    const payload = chosen.map(toExportSkill);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planote-skills.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full animate-fadeUp min-h-[calc(100vh-160px)]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">技能</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">像管理博客一样管理你的 AI 总结/写作模板 · 共 {skills.length} 个</p>
        </div>
        <button type="button" onClick={goCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900 hover:bg-brand-800 text-white text-sm font-medium transition">
          <Plus size={16} /> 新建技能
        </button>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-brand-50 dark:bg-stone-800 border border-brand-900/20">
          <span className="text-sm text-brand-900 dark:text-stone-100">已选 {selected.size}</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-stone-500 hover:underline">取消</button>
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-xs font-medium">导出 JSON</button>
        </div>
      )}

      <div className="grid grid-cols-[260px_1fr] gap-5 items-start">
        {/* 左：文件夹树 */}
        <aside className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">技能文件夹</h3>
          <TreeItem
            label="全部技能"
            active={activeFolder === ROOT_SKILL_FOLDER_ID}
            count={skills.length}
            onClick={() => setActiveFolder(ROOT_SKILL_FOLDER_ID)}
          />
          <div className="mt-1 space-y-0.5">
            {folders.map((f) => (
              <TreeItem
                key={f.id}
                label={f.name}
                active={activeFolder === f.id}
                count={skills.filter((s) => s.folderId === f.id).length}
                onClick={() => setActiveFolder(f.id)}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-1.5">
            <button type="button" onClick={() => { const n = prompt('文件夹名称'); if (n) skillFolderRepo.create(n).then(reload); }} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs hover:bg-stone-200">新建</button>
            {activeFolder !== ROOT_SKILL_FOLDER_ID && (
              <>
                <button type="button" onClick={() => { const f = folders.find((x) => x.id === activeFolder); const n = prompt('重命名', f?.name); if (n) skillFolderRepo.rename(activeFolder, n).then(reload); }} className="px-2 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-500 text-xs">改名</button>
                <button type="button" onClick={() => { if (confirm('删除文件夹？其下技能将移回「全部技能」。')) skillFolderRepo.remove(activeFolder).then(() => { setActiveFolder(ROOT_SKILL_FOLDER_ID); reload(); }); }} className="px-2 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-red-500 text-xs">删除</button>
              </>
            )}
          </div>
        </aside>

        {/* 右：工具栏 + 列表 */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(['all', 'summary', 'writing', 'imitate', 'translate', 'custom'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                  type === t ? 'bg-brand-900 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600',
                )}
              >
                {t === 'all' ? '全部' : TYPE_META[t].label}
              </button>
            ))}
            <span className="flex-1" />
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索技能名…"
                className="pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-brand-900/20"
              />
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs hover:bg-stone-200">
              <Upload size={13} /> 批量导入
            </button>
            <button type="button" onClick={downloadSkillMdExample} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs hover:bg-stone-200">
              <FileDown size={13} /> 下载示例 .md
            </button>
            <input ref={fileRef} type="file" multiple accept=".json,.md,application/json,text/markdown" className="hidden" onChange={handleImport} />
            <div className="flex rounded-lg overflow-hidden border border-stone-200 dark:border-stone-600">
              <button type="button" onClick={() => setView('grid')} className={cn('px-2 py-1.5', view === 'grid' ? 'bg-brand-900 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-500')}><Grid3x3 size={14} /></button>
              <button type="button" onClick={() => setView('list')} className={cn('px-2 py-1.5', view === 'list' ? 'bg-brand-900 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-500')}><List size={14} /></button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-600 py-16 text-center text-stone-400">
              <Boxes size={28} className="mx-auto mb-2 opacity-50" />
              该范围下暂无技能，点「新建技能」或「批量导入」。
            </div>
          ) : view === 'grid' ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((s) => <SkillCard key={s.id} skill={s} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} onEdit={() => goEdit(s.id)} onRepair={() => openRepair(s)} />)}
            </div>
          ) : (
            <div className="space-y-1">
              {visible.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="accent-brand-900" />
                  <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', TYPE_META[s.type].color)}>{TYPE_META[s.type].label}</span>
                  <span className="font-medium text-brand-900 dark:text-stone-100 flex-1 truncate">{s.name}</span>
                  {s.status === 'raw' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">待修复</span>}
                  {s.builtin && <span className="text-[10px] text-amber-600">内置</span>}
                  {s.status === 'raw' && (
                    <button type="button" onClick={() => openRepair(s)} title="用 AI 整理为标准格式" className="text-amber-600 hover:text-amber-700"><Wand2 size={14} /></button>
                  )}
                  <button type="button" onClick={() => goEdit(s.id)} className="text-stone-400 hover:text-brand-700"><Pencil size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 卡片点「修复」→ AI 修复对话框（就地更新该原样收藏技能） */}
      <SkillImportRepairDialog
        open={repairing !== null}
        rawText={repairing?.rawText ?? ''}
        errorMessage={repairing?.errorMessage ?? ''}
        fileName={repairing?.name ?? ''}
        onCancel={() => setRepairing(null)}
        onConfirm={handleRepairConfirm}
      />
    </div>
  );
}

type ID = string;

function TreeItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition text-left',
        active ? 'bg-brand-900 text-white font-medium' : 'text-brand-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700',
      )}
    >
      <FolderPlus size={14} className={active ? 'text-white' : 'text-stone-400'} />
      <span className="flex-1 truncate">{label}</span>
      <span className={cn('text-xs', active ? 'text-white/70' : 'text-stone-400')}>{count}</span>
    </button>
  );
}

function SkillCard({ skill, selected, onToggle, onEdit, onRepair }: { skill: Skill; selected: boolean; onToggle: () => void; onEdit: () => void; onRepair: () => void }) {
  const isRaw = skill.status === 'raw';
  return (
    <div className={cn('rounded-2xl border p-4 bg-white dark:bg-stone-800/50 transition hover:shadow-card', selected ? 'border-brand-900/40' : 'border-stone-200 dark:border-stone-700')}>
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 accent-brand-900" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-brand-900 dark:text-stone-100 truncate">{skill.name}</h4>
            <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium shrink-0', TYPE_META[skill.type].color)}>{TYPE_META[skill.type].label}</span>
            {isRaw && <span className="px-2 py-0.5 rounded-md text-xs font-medium shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">待修复</span>}
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mb-2">{skill.description || skill.promptTemplate.slice(0, 60) || '（暂无描述）'}</p>
          <div className="flex items-center gap-2 text-[11px] text-stone-400">
            {skill.builtin && <span className="text-amber-600">内置</span>}
            <span>用 {skill.useCount} 次</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isRaw && (
            <button type="button" onClick={onRepair} title="用 AI 整理为标准格式" className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300">
              <Wand2 size={12} /> 修复
            </button>
          )}
          <button type="button" onClick={onEdit} className="text-stone-400 hover:text-brand-700"><Pencil size={14} /></button>
        </div>
      </div>
    </div>
  );
}

