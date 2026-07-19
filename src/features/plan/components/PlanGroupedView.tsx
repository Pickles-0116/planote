/**
 * PlanGroupedView - 计划分组视图（默认视图）
 *
 * 行为（add-plan-list-view/spec.md Requirement: 分组视图按 level 分组）：
 * - 按 `Plan.level` 分 3 组：短期 / 中期 / 长期
 * - 0 元素的组不渲染（spec §Scenario 隐藏空分组）
 * - 每组内复用 useSortedPlans 的排序结果（由父 PlanList 传入）
 * - 每组用 PlanGroupCollapse 包裹（前 5 + 展开剩余 N）
 *
 * 入参：`plans` 已是智能排序后的数组；本组件只负责按 level 分桶。
 */

import PlanGroupCollapse from './PlanGroupCollapse';
import PlanCard from './PlanCard';
import type { Plan, PlanLevel } from '@/types/domain';

interface Props {
  plans: Plan[];
}

interface GroupDef {
  level: PlanLevel;
  title: string;
  subtitle: string;
  color: 'emerald' | 'blue' | 'purple';
}

const GROUPS: GroupDef[] = [
  { level: 'short', title: '短期目标', subtitle: '1-4 周', color: 'emerald' },
  { level: 'mid', title: '中期计划', subtitle: '1-6 个月', color: 'blue' },
  { level: 'long', title: '长期规划', subtitle: '1-3 年', color: 'purple' },
];

export default function PlanGroupedView({ plans }: Props) {
  // 按 level 分桶
  const grouped: Record<PlanLevel, Plan[]> = {
    short: [],
    mid: [],
    long: [],
  };
  for (const p of plans) {
    grouped[p.level].push(p);
  }

  return (
    <div className="space-y-8">
      {GROUPS.map((g, idx) => {
        const items = grouped[g.level];
        if (items.length === 0) return null;
        return (
          <PlanGroupCollapse
            key={g.level}
            title={g.title}
            subtitle={g.subtitle}
            color={g.color}
            count={items.length}
            delayClass={`animate-delay-${idx * 50}`}
          >
            {items.map((plan) => (
              <PlanCard key={plan.id} plan={plan} density="full" />
            ))}
          </PlanGroupCollapse>
        );
      })}
    </div>
  );
}
