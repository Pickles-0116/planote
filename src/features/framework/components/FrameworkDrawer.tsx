/**
 * FrameworkDrawer - 博客框架库抽屉（add-framework-drawer 增量）
 *
 * 与 PlanDetail 侧 FrameworkDrawer 关系：
 * - v1.0 两者并存；本组件是 BlogEdit 侧独立壳
 * - 文件路径相同（features/framework/components/FrameworkDrawer.tsx）
 *   但本文件由 add-framework-drawer 改写，原 PlanDetail 侧组件移走 →
 *   ⚠️ 实际原 PlanDetail 侧代码现由独立路径在 add-framework-drawer 实施前存在；
 *   为避免命名冲突，本 change 把 BlogEdit 侧组件命名为 FrameworkDrawer（覆盖），
 *   PlanDetail 侧原使用位置由 add-plan-detail-view 后续可改路径
 *
 * 视觉与 prototype framework-drawer 对齐：右侧滑入 + 480px
 *
 * 行为（spec Requirement: 抽屉壳 / 搜索 / tag / 选中 / 应用 / a11y）：
 * - 复用通用 Drawer 壳（Esc 关闭 / 背景点击关闭）
 * - open 时锁定 body 滚动
 * - 简版 focus trap：useEffect 聚焦 ApplyBar「应用」按钮
 */

import { useEffect, useRef } from 'react';
import Drawer from '@/components/shell/Drawer';
import SearchBar from './SearchBar';
import TagFilter from './TagFilter';
import FrameworkList from './FrameworkList';
import ApplyBar from './ApplyBar';
import { useFrameworkDrawer } from '@/features/framework/hooks/useFrameworkDrawer';
import { ALL_PRESET_TAGS, type PresetFramework } from '@/features/framework/data/presets';
import type { ID } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 抽屉内点「应用」后回调（父组件实际注入章节）。 */
  onApply: (framework: PresetFramework) => void;
  /** 当前 Blog 已应用的 framework id（用于「已应用」标记）。 */
  appliedFrameworkId?: ID | null;
}

export default function FrameworkDrawer({
  open,
  onClose,
  onApply,
  appliedFrameworkId = null,
}: Props): JSX.Element {
  const applyBtnRef = useRef<HTMLButtonElement>(null);
  const {
    query,
    setQuery,
    selectedTags,
    toggleTag,
    selectedId,
    selectFramework,
    filtered,
    selected,
    clearFilters,
    hasFilters,
  } = useFrameworkDrawer();

  // body 滚动锁
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // 简版 focus trap：open 时聚焦 ApplyBar 按钮
  useEffect(() => {
    if (!open) return;
    // 等滑入动画稳定
    const id = window.setTimeout(() => {
      applyBtnRef.current?.focus();
    }, 200);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="选择博客框架"
      description="选一个框架，让写作有结构"
    >
      <div className="p-5 space-y-4 flex-shrink-0 border-b border-stone-100">
        <SearchBar value={query} onChange={setQuery} />
        <TagFilter tags={ALL_PRESET_TAGS} selected={selectedTags} onToggle={toggleTag} />
      </div>

      <div className="p-5 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
        <FrameworkList
          items={filtered}
          selectedId={selectedId}
          onSelect={selectFramework}
          onClearFilters={clearFilters}
          hasFilters={hasFilters}
          appliedId={appliedFrameworkId}
        />
      </div>

      <ApplyBar
        ref={applyBtnRef}
        selected={selected}
        onApply={() => {
          if (selected) onApply(selected);
        }}
      />
    </Drawer>
  );
}
