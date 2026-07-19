/**
 * planTableColumns - 表格视图 cell 排序指示器（React 组件）
 *
 * 本文件仅包含 React 组件（SortIcon），不导出其他非组件值，
 * 以满足 react-refresh 的「单文件只导出组件」约束。
 * 实际 JSX 渲染函数（renderCell）见 `./PlanTableView.tsx` 内联实现。
 *
 * 表格列定义 / 常量 / 类型见 `./planTableConstants.ts`。
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDir } from './planTableConstants';

/** 列头排序指示器。 */
export default function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={10} className="text-brand-300" />;
  return dir === 'asc' ? (
    <ArrowUp size={10} className="text-brand-900" />
  ) : (
    <ArrowDown size={10} className="text-brand-900" />
  );
}
