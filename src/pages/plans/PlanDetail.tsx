/**
 * PlanDetail - 计划详情页（/plans/:id）
 *
 * 整合所有子组件（add-plan-detail-view）：
 * 1. 顶栏 PlanDetailTopBar（返回 + 标题 + badges + 编辑）
 * 2. 完成横幅 CompletionBanner（100% 触发）
 * 3. Hero 区：左侧大进度环 + 右侧关键数据
 * 4. 事项清单 ItemChecklist（核心交互）
 * 5. 关联博客区 PlanBlogsSection
 *
 * 数据流（spec §「勾选联动 Plan.progress」）：
 * - usePlan(id) 订阅 plan 实时数据
 * - useItemsForPlan(planId) 订阅 items 列表
 * - useToggleItem 包装 toggle + setStatus，触发 recomputeProgress
 * - Plan.progress 字段更新 → useLiveQuery 推送 → ProgressRing 自动重算
 *
 * 加载 / 错误态：
 * - 加载中（liveQuery 首帧 undefined）→ PlanDetailSkeleton
 * - ID 不存在：items 已 settle（数组，不是 undefined）+ plan 仍为 undefined → EmptyState
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import ProgressRing from '@/components/plans/ProgressRing';
import PlanDetailTopBar from '@/features/plan/components/PlanDetailTopBar';
import CompletionBanner from '@/features/plan/components/CompletionBanner';
import PlanKeyMetrics from '@/features/plan/components/PlanKeyMetrics';
import ItemChecklist from '@/features/plan/components/ItemChecklist';
import PlanBlogsSection from '@/features/plan/components/PlanBlogsSection';
import PlanSubPlansSection from '@/features/plan/components/PlanSubPlansSection';
import { useCompletionBanner } from '@/features/plan/hooks/useCompletionBanner';
import { useToggleItem } from '@/features/plan/hooks/useToggleItem';
import { useItemCRUD } from '@/features/plan/hooks/useItemCRUD';
import { useItemHashHighlight } from '@/features/plan/hooks/useItemHashHighlight';
import PlanDetailSkeleton from './PlanDetailSkeleton';
import { usePlan, useItemsForPlan } from '@/stores';

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const plan = usePlan(id);
  const items = useItemsForPlan(id);
  const { shouldShow, dismiss } = useCompletionBanner(plan);
  const { toggle, setStatus } = useToggleItem(id ?? '');
  // v1.1 修：用 useItemCRUD 提供 add/update/remove（修复「+ 添加事项」永远 disabled 的 bug）
  const { add: addItem, update: updateItem, remove: removeItem } = useItemCRUD(id ?? '');
  // 监听 #item-{id} 锚点：滚动 + 1.5s 高亮（add-kanban-board 增量）
  useItemHashHighlight();

  // 完成事项数（从 items 实时算，不依赖 plan.progress）
  const completedItems = useMemo(
    () => (items ?? []).filter((i) => i.status === 'done').length,
    [items],
  );
  const totalItems = items?.length ?? 0;

  // 加载中：liveQuery 首帧返回 undefined（plan 和 items 都未就绪）
  if (plan === undefined || items === undefined) {
    return <PlanDetailSkeleton />;
  }

  // ID 不存在：items 已 settle（listByPlan 返回 []），但 plan 仍为 undefined
  if (plan === undefined) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="找不到该计划"
        description="该计划可能已被删除"
        action={{
          label: '返回计划列表',
          onClick: () => navigate('/plans'),
        }}
        variant="default"
      />
    );
  }

  const handleGenerateBlog = () => {
    // 直接跳转新建博客页，自动打开 AI 写作面板
    const params = new URLSearchParams();
    params.set('sourcePlanId', plan.id);
    params.set('autoOpenAI', 'true');
    navigate(`/blogs/new?${params.toString()}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PlanDetailTopBar plan={plan} />

      {/* 100% 完成横幅 */}
      <CompletionBanner
        visible={shouldShow}
        onDismiss={dismiss}
        onGenerateBlog={handleGenerateBlog}
      />

      {/* Hero 区：左进度环 + 右关键数据 */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <section className="col-span-2 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 animate-fadeUp animate-delay-50 flex flex-col items-center justify-center text-center">
          <ProgressRing value={plan.progress} size={180} />
          <div className="mt-4 text-sm font-semibold text-brand-900 dark:text-stone-100">
            {plan.progress >= 100 ? '完美达成' : '继续推进'}
          </div>
          <div className="text-xs text-brand-400 dark:text-stone-500 mt-1">
            {completedItems} / {totalItems} 事项
          </div>
        </section>

        <PlanKeyMetrics
          plan={plan}
          completedItems={completedItems}
          totalItems={totalItems}
        />
      </div>

      {/* 事项清单 + 关联博客（2 列） */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ItemChecklist
            items={items}
            onToggle={toggle}
            onSetStatus={setStatus}
            onAdd={async ({ title }) => {
              await addItem({ title });
            }}
            onUpdate={async (itemId, patch) => {
              await updateItem(itemId, patch);
            }}
            onRemove={async (itemId) => {
              await removeItem(itemId);
            }}
          />
        </div>
        <div className="col-span-1">
          <PlanBlogsSection
            blogIds={plan.blogIds}
            onGenerateBlog={handleGenerateBlog}
          />
          <PlanSubPlansSection childPlanIds={plan.childPlanIds} />
        </div>
      </div>
    </div>
  );
}
