/**
 * FrameworkGenerationDrawer - 计划侧「从计划生成博客」模板选择抽屉
 *
 * v1.4-Unify 重写：原 useFrameworks(Dexie frameworks 表) → useAllTemplates(blogTemplates 表)。
 * 导航参数从 frameworkId → templateId，与 BlogEdit create 模式对齐。
 *
 * 行为：选模板 → 跳转 /blogs/new?templateId=xxx&sourcePlanId=yyy
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Sparkles,
  FileText,
  BookOpen,
  BarChart3,
  CalendarDays,
  Lightbulb,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import Drawer from '@/components/shell/Drawer';
import { useAllTemplates } from '@/stores';
import { cn } from '@/lib/utils';
import type { ID, BlogTemplate, TemplateCategory } from '@/types/domain';

interface Props {
  sourcePlanId?: ID;
  open: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  GitPullRequest: FileText,
  CalendarDays,
  BookOpen,
  BarChart3,
  FileText,
  Lightbulb,
  Search,
  Settings,
};

const CATEGORY_LABEL: Record<TemplateCategory | 'all', string> = {
  all: '全部',
  review: '项目复盘',
  habit: '21天复盘',
  note: '读书笔记',
  summary: '月度总结',
  decision: '决策日志',
  analysis: '问题分析',
  custom: '自定义',
};

export default function FrameworkGenerationDrawer({
  sourcePlanId,
  open,
  onClose,
}: Props) {
  const allTemplates = useAllTemplates();
  const navigate = useNavigate();
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<ID | null>(null);

  const visible = useMemo(() => {
    if (!allTemplates) return [];
    if (category === 'all') return allTemplates;
    return allTemplates.filter((t) => t.category === category);
  }, [allTemplates, category]);

  const selected = useMemo(
    () => visible.find((t) => t.id === selectedId) ?? null,
    [visible, selectedId],
  );

  // 动态计算实际出现的分类（用于 Tab 栏，只显示有数据的分类）
  const activeCategories = useMemo(() => {
    if (!allTemplates) return [] as TemplateCategory[];
    const cats = new Set(allTemplates.map((t) => t.category));
    return (Object.keys(CATEGORY_LABEL) as Array<TemplateCategory | 'all'>).filter(
      (c): c is TemplateCategory => c !== 'all' && cats.has(c),
    );
  }, [allTemplates]);

  const handleApply = (tpl: BlogTemplate) => {
    const params = new URLSearchParams();
    params.set('templateId', tpl.id);
    if (sourcePlanId) {
      params.set('sourcePlanId', sourcePlanId);
    }
    onClose();
    setSelectedId(null);
    navigate(`/blogs/new?${params.toString()}`);
  };

  return (
    <Drawer
      open={open}
      onClose={() => {
        onClose();
        setSelectedId(null);
      }}
      title="选择博客模板"
      description="选一个模板，让写作有结构"
    >
      {/* 分类 Tab */}
      <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2 overflow-x-auto scrollbar-thin flex-shrink-0">
        <button
          key="all"
          type="button"
          onClick={() => setCategory('all')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition',
            category === 'all'
              ? 'bg-brand-900 text-white'
              : 'text-brand-500 hover:bg-stone-100',
          )}
        >
          全部
        </button>
        {activeCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition',
              category === c
                ? 'bg-brand-900 text-white'
                : 'text-brand-500 hover:bg-stone-100',
            )}
          >
            {CATEGORY_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      {/* 模板卡片列表 */}
      <div className="p-5 space-y-3 overflow-y-auto flex-1">
        {allTemplates === undefined ? (
          <div className="text-center text-sm text-brand-400 py-8">加载模板中…</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-sm text-brand-400 py-8">该分类下没有模板</div>
        ) : (
          visible.map((tpl) => {
            const Icon = ICON_MAP[tpl.icon] ?? Sparkles;
            const isSelected = selectedId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedId(tpl.id)}
                className={cn(
                  'w-full text-left rounded-xl p-4 transition',
                  isSelected
                    ? 'border-2 border-accent-300 bg-accent-50/30'
                    : 'border border-stone-200 hover:border-brand-300',
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        isSelected ? 'bg-accent-500 text-white' : 'bg-stone-100 text-brand-600',
                      )}
                    >
                      <Icon size={14} />
                    </div>
                    <span className="text-sm font-semibold">{tpl.name}</span>
                  </div>
                  {isSelected && <Check className="text-accent-500" size={16} />}
                </div>
                <div className="text-xs text-brand-400 mb-3">{tpl.description}</div>
                <div className="space-y-1 text-xs text-brand-600">
                  {tpl.sections.slice(0, 5).map((s) => (
                    <div key={s.heading} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-stone-300 flex-shrink-0" />
                      <span className="line-clamp-2">{s.heading}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 底部 CTA */}
      <div className="p-5 border-t border-stone-200 flex-shrink-0">
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && handleApply(selected)}
          className={cn(
            'w-full py-2.5 text-sm font-medium rounded-xl transition',
            selected
              ? 'bg-brand-900 text-white hover:bg-brand-800 shadow-sm'
              : 'bg-stone-100 text-brand-400 cursor-not-allowed',
          )}
        >
          {selected ? `应用「${selected.name}」` : '请选择一个模板'}
        </button>
      </div>
    </Drawer>
  );
}
