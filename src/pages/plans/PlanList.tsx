/**
 * PlanList - 计划列表页（/plans 路由）
 *
 * 顶层 hooks pipeline（spec §2.1 共享数据流）：
 *   useLiveQuery → useSortedPlans → usePlanSearch → [GroupedView|AllView|TableView]
 *
 * V1.2 B5：多维筛选改用统一 `useEntityFilters`（状态 / 时间维度 / 层级 / 标签 / 日期），
 * 并把 `tags` 传入 PlanFilterPanel 渲染标签筛选 UI。
 *
 * 视图切换：
 *   视图模式从 useUIStore.planListView 读取（持久化到 localStorage）
 *
 * 空状态 / 加载态：
 *   - 加载中（undefined）→ PlanListSkeleton
 *   - 全部数据为空 + 无 query → illustration variant EmptyState
 *   - 搜索无结果 + query 非空 → compact variant EmptyState + 清除筛选
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Notebook, SearchX, Filter } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import PlanSearchBox from '@/components/plans/PlanSearchBox';
import PlanSortDropdown from '@/components/plans/PlanSortDropdown';
import PlanViewSwitcher from '@/components/plans/PlanViewSwitcher';
import { usePlans } from '@/stores/hooks/usePlans';
import { useSortedPlans } from '@/stores/hooks/useSortedPlans';
import { usePlanSearch } from '@/stores/hooks/usePlanSearch';
import { useUIStore } from '@/stores/uiStore';
import PlanGroupedView from '@/features/plan/components/PlanGroupedView';
import PlanListAllView from '@/features/plan/components/PlanListAllView';
import PlanTableView from '@/features/plan/components/PlanTableView';
import PlanTreeView from '@/features/plan/components/PlanTreeView';
import PlanFilterPanel from '@/features/plan/components/PlanFilterPanel';
import { useEntityFilters } from '@/features/filters/useEntityFilters';
import { useTags } from '@/stores';
import type { Plan } from '@/types/domain';
import PlanListSkeleton from './PlanListSkeleton';
import SortHint from './SortHint';
import { DEFAULT_SORT_KEY } from '@/shared/sort';
import type { SortKey } from '@/shared/sort';

export default function PlanList() {
  const navigate = useNavigate();
  const view = useUIStore((s) => s.planListView);
  const setView = useUIStore((s) => s.setPlanListView);
  const sort = useUIStore((s) => s.planListSort);
  const setSort = useUIStore((s) => s.setPlanListSort);

  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // V1.2 B5：统一多维筛选（状态 / 时间维度 / 层级 / 标签 / 日期）
  const { filters, setFilters, apply, hasActiveFilters, reset } = useEntityFilters<Plan>();
  const tags = useTags();

  // 1) 原始数据（实时订阅）
  const rawPlans = usePlans();
  // 2) 智能排序（add-smart-sort 增量：传入 planListSort 切换）
  const sortedPlans = useSortedPlans(rawPlans, sort);
  // 3) 多维筛选（useEntityFilters.apply）
  const filteredByPanel = useMemo(() => apply(sortedPlans ?? []), [sortedPlans, apply]);
  // 4) 搜索过滤
  const filteredPlans = usePlanSearch(filteredByPanel, query);

  // 加载态：liveQuery 首帧 undefined
  if (rawPlans === undefined || sortedPlans === undefined || filteredPlans === undefined) {
    return <PlanListSkeleton />;
  }

  // 全部数据为空 + 无 query → 引导创建
  if (rawPlans.length === 0 && query === '') {
    return (
      <EmptyState
        icon={Notebook}
        title="还没有计划，从一个目标开始 ✨"
        description="创建你的第一个计划，让目标开始流动"
        action={{
          label: '新建计划',
          onClick: () => navigate('/plans/new'),
        }}
        variant="illustration"
      />
    );
  }

  // 搜索无结果
  if (filteredPlans.length === 0 && query !== '') {
    return (
      <div className="space-y-6 animate-fadeUp">
        <PageHeader count={rawPlans.length} />
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          sort={sort}
          onSortChange={setSort}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          hasActiveFilters={hasActiveFilters}
        />
        <EmptyState
          icon={SearchX}
          title="没找到匹配的计划"
          description={`没有 plan 包含「${query}」`}
          action={{
            label: '清除筛选',
            onClick: () => {
              setQuery('');
              reset();
            },
            variant: 'secondary',
          }}
          variant="compact"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader count={rawPlans.length} />
      <Toolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        sort={sort}
        onSortChange={setSort}
        filterOpen={filterOpen}
        onToggleFilter={() => setFilterOpen((v) => !v)}
        hasActiveFilters={hasActiveFilters}
      />
      {filterOpen && (
        <PlanFilterPanel
          filters={filters}
          onChange={setFilters}
          matchCount={filteredPlans?.length ?? 0}
          tags={tags ?? []}
        />
      )}
      {view === 'group' && sort === DEFAULT_SORT_KEY && <SortHint />}
      {view === 'group' && <PlanGroupedView plans={filteredPlans} />}
      {view === 'all' && <PlanListAllView plans={filteredPlans} />}
      {view === 'table' && <PlanTableView plans={filteredPlans} />}
      {view === 'tree' && <PlanTreeView plans={filteredPlans} />}
    </div>
  );
}

/* ============================================================
 * 标题栏
 * ============================================================ */
function PageHeader({ count }: { count: number }) {
  return (
    <div className="flex items-end justify-between animate-fadeUp">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">我的计划</h1>
        <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
          管理你的短期目标、中期计划与长期规划 · 共{' '}
          <span className="font-semibold text-brand-900 dark:text-stone-100">{count}</span> 项
        </p>
      </div>
      <Link
        to="/plans/new"
        className="px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition flex items-center gap-2 shadow-sm"
      >
        新建计划
      </Link>
    </div>
  );
}

/* ============================================================
 * 工具栏（搜索 + 排序 + 视图切换器）
 * ============================================================ */
function Toolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  sort,
  onSortChange,
  filterOpen,
  onToggleFilter,
  hasActiveFilters,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  view: 'group' | 'all' | 'table' | 'tree';
  onViewChange: (v: 'group' | 'all' | 'table' | 'tree') => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 animate-fadeUp animate-delay-25"
      data-toolbar="plan-list"
    >
      <PlanSearchBox value={query} onChange={onQueryChange} />
      <PlanSortDropdown value={sort} onChange={onSortChange} />
      <button
        type="button"
        onClick={onToggleFilter}
        className={`relative p-2 rounded-xl border transition ${
          filterOpen || hasActiveFilters
            ? 'bg-brand-900 text-white border-brand-900'
            : 'bg-white dark:bg-stone-800 text-brand-500 border-stone-200 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-700'
        }`}
        title="筛选"
      >
        <Filter size={16} />
        {hasActiveFilters && !filterOpen && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
        )}
      </button>
      <PlanViewSwitcher value={view} onChange={onViewChange} />
    </div>
  );
}
