/**
 * SearchBar - 框架库抽屉搜索框
 *
 * props：
 * - value: 当前输入
 * - onChange: 输入变化回调
 *
 * 视觉：高 36px，rounded-xl，左 Search icon，右 X 清除按钮（value 非空时显）
 * a11y：aria-label="搜索框架"
 */

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBar({ value, onChange }: Props): JSX.Element {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索框架名、章节或描述…"
        aria-label="搜索框架"
        className={cn(
          'w-full h-9 pl-9 pr-9 text-sm',
          'bg-stone-50 border border-stone-200 rounded-xl',
          'focus:bg-white focus:border-brand-500 focus:outline-none',
          'transition placeholder:text-brand-300',
        )}
      />
      {value !== '' && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清除搜索"
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'w-6 h-6 rounded-lg flex items-center justify-center',
            'text-brand-400 hover:text-brand-900 hover:bg-stone-100 transition',
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
