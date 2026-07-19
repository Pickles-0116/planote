/**
 * planTableConstants - 表格视图的常量 / 类型 / 列定义
 *
 * 本文件不导出任何 React 组件（仅类型 + 纯数据 + 排序键取值函数），
 * 以满足 react-refresh 的「单文件只导出组件」约束。
 * 实际 JSX 渲染见 `planTableColumns.tsx`。
 *
 * 排序覆盖说明：表格列头点击切换 asc/desc 覆盖 useSortedPlans 的智能排序
 * （add-plan-list-view/spec.md Requirement: 表格视图 6 列 + 排序覆盖）。
 */

import type { Plan, PlanLevel, PlanStatus, PlanTimeDim, UrgencyLevel } from '@/types/domain';

/** 排序方向。 */
export type SortDir = 'asc' | 'desc';

/** 表格列定义（id + 渲染器 + 排序取值）。 */
export interface PlanTableColumn {
  id: 'title' | 'level' | 'urgency' | 'progress' | 'endDate' | 'blogCount';
  label: string;
  /** 排序键取值函数：返回 string | number 用于比较。 */
  sortValue: (p: Plan) => string | number;
  /** 列宽（Tailwind class）。undefined → 自适应。 */
  width?: string;
  /** 右对齐。 */
  align?: 'right' | 'left' | 'center';
}

const LEVEL_RANK: Record<PlanLevel, number> = { short: 0, mid: 1, long: 2 };
const URGENCY_RANK: Record<UrgencyLevel, number> = { red: 0, orange: 1, yellow: 2, none: 3 };

export const PLAN_TABLE_COLUMNS: PlanTableColumn[] = [
  { id: 'title', label: '计划', sortValue: (p) => p.title },
  { id: 'level', label: '层级', sortValue: (p) => LEVEL_RANK[p.level] },
  { id: 'urgency', label: '紧急度', sortValue: (p) => URGENCY_RANK[p.urgency] },
  { id: 'progress', label: '进度', sortValue: (p) => p.progress, width: 'w-32' },
  {
    id: 'endDate',
    label: '截止',
    sortValue: (p) => p.endDate ?? '9999-12-31', // 无 endDate 排最后
  },
  {
    id: 'blogCount',
    label: '博客',
    sortValue: (p) => p.blogIds.length,
    width: 'w-16',
    align: 'right',
  },
];

/** 紧急度颜色（用于表格内 cell 着色）。 */
export const URGENCY_CELL_COLOR: Record<UrgencyLevel, string> = {
  red: 'text-red-600',
  orange: 'text-orange-600',
  yellow: 'text-amber-600',
  none: 'text-brand-500',
};

export const URGENCY_CELL_LABEL: Record<UrgencyLevel, string> = {
  red: '今天',
  orange: '1-3 天',
  yellow: '4-7 天',
  none: '—',
};

export const LEVEL_CELL_LABEL: Record<PlanLevel, string> = {
  short: '短期',
  mid: '中期',
  long: '长期',
};

export const LEVEL_CELL_BG: Record<PlanLevel, string> = {
  short: 'bg-emerald-50 text-emerald-600',
  mid: 'bg-blue-50 text-blue-600',
  long: 'bg-purple-50 text-purple-600',
};

export const TIME_DIM_LABEL: Record<PlanTimeDim, string> = {
  daily: '每日',
  monthly: '每月',
  yearly: '每年',
  once: '一次性',
};

export const STATUS_CELL_LABEL: Record<PlanStatus, string> = {
  todo: '未开始',
  doing: '进行中',
  done: '已完成',
  paused: '已搁置',
};
