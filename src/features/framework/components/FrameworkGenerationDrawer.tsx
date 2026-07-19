/**
 * FrameworkGenerationDrawer - 计划侧「从计划生成博客」框架抽屉
 *
 * 历史：原 features/framework/components/FrameworkDrawer.tsx
 * 改名原因：add-framework-drawer 增量把同路径让给 BlogEdit 侧新抽屉，
 *          PlanDetail 侧按 design.md §2.1 命名约定改为 FrameworkGenerationDrawer。
 * 视觉（与 prototype plan-detail.html framework-drawer 对齐）：
 * - 标题「选择博客框架」+ 副标题「选一个框架，让写作有结构」
 * - 分类 Tab：全部 / 项目复盘 / 21天复盘 / 读书笔记 / 月度总结
 * - 4 张框架卡片（icon + 名称 + 描述 + 章节预览）
 * - 底部 CTA「应用《框架名》」
 *
 * 行为（spec Requirement: 框架抽屉入口）：
 * - 选框架 → console.log + onClose
 * - v1.0 不实现真实博客创建（add-blog-generation-flow 接手）
 */

import { useMemo, useState } from 'react';
import {
  GitPullRequest,
  CalendarDays,
  BookOpen,
  BarChart3,
  Check,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import Drawer from '@/components/shell/Drawer';
import { useFrameworks } from '@/stores';
import { cn } from '@/lib/utils';
import type { ID, Framework, FrameworkCategory } from '@/types/domain';

interface Props {
  sourcePlanId?: ID;
  open: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  GitPullRequest,
  CalendarDays,
  BookOpen,
  BarChart3,
};

const CATEGORY_LABEL: Record<FrameworkCategory | 'all', string> = {
  all: '全部',
  review: '项目复盘',
  habit: '21天复盘',
  note: '读书笔记',
  summary: '月度总结',
};

export default function FrameworkGenerationDrawer({
  sourcePlanId,
  open,
  onClose,
}: Props) {
  const allFrameworks = useFrameworks();
  const [category, setCategory] = useState<FrameworkCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<ID | null>(null);

  const visible = useMemo(() => {
    if (!allFrameworks) return [];
    if (category === 'all') return allFrameworks;
    return allFrameworks.filter((f) => f.category === category);
  }, [allFrameworks, category]);

  const selected = useMemo(
    () => visible.find((f) => f.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const handleApply = (fw: Framework) => {
    // v1.0 简化：选框架 → console.log + 关闭抽屉
    // eslint-disable-next-line no-console
    console.log(
      `[v1.1] generate blog from plan ${sourcePlanId ?? '(none)'} with framework ${fw.id} (${fw.name})`,
    );
    onClose();
    setSelectedId(null);
  };

  return (
    <Drawer
      open={open}
      onClose={() => {
        onClose();
        setSelectedId(null);
      }}
      title="选择博客框架"
      description="选一个框架，让写作有结构"
    >
      {/* 分类 Tab */}
      <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2 overflow-x-auto scrollbar-thin flex-shrink-0">
        {(Object.keys(CATEGORY_LABEL) as Array<FrameworkCategory | 'all'>).map((c) => (
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
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* 框架卡片列表 */}
      <div className="p-5 space-y-3">
        {allFrameworks === undefined ? (
          <div className="text-center text-sm text-brand-400 py-8">加载框架中…</div>
        ) : visible.length === 0 ? (
          <div className="text-center text-sm text-brand-400 py-8">该分类下没有框架</div>
        ) : (
          visible.map((fw) => {
            const Icon = ICON_MAP[fw.icon] ?? Sparkles;
            const isSelected = selectedId === fw.id;
            return (
              <button
                key={fw.id}
                type="button"
                onClick={() => setSelectedId(fw.id)}
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
                    <span className="text-sm font-semibold">{fw.name}</span>
                  </div>
                  {isSelected && <Check className="text-accent-500" size={16} />}
                </div>
                <div className="text-xs text-brand-400 mb-3">{fw.description}</div>
                <div className="space-y-1 text-xs text-brand-600">
                  {fw.sections.slice(0, 5).map((s) => (
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
          {selected ? `应用「${selected.name}」` : '请选择一个框架'}
        </button>
      </div>
    </Drawer>
  );
}
