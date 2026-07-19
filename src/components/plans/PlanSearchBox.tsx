/**
 * PlanSearchBox - 计划列表页搜索框
 *
 * 视觉（与 prototype plans.html §1 对齐）：
 * - 白底 + 圆角 xl + 边框 stone-200
 * - 左侧 Lucide Search icon
 * - 右侧 X 清除按钮（query 非空时显示）
 *
 * 行为：
 * - 受控组件（value + onChange）
 * - 实时 onChange 触发父组件 usePlanSearch（无 debounce，useMemo 缓存足够）
 * - a11y：type="search" + aria-label
 *
 * 全局搜索特性（add-plan-list-view 范围）：
 * - 监听 input 事件用 onChange 透传（无特殊全局键盘绑定，⌘K 留 v1.1）
 */

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** 受控 input 类名（外层布局父级决定，本组件不限制宽度） */
  className?: string;
}

export default function PlanSearchBox({
  value,
  onChange,
  placeholder = '搜索计划标题或描述…',
  className,
}: Props) {
  const hasValue = value.length > 0;
  return (
    <div className={cn('relative flex-1', className)}>
      <Search
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
        size={14}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="搜索计划"
        className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-brand-900 transition"
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清除搜索"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-brand-400 hover:text-brand-900 hover:bg-stone-100 transition"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
