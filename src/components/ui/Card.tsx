import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** 是否带 hover 抬升效果 */
  interactive?: boolean;
}

/** 通用卡片容器：白底 + 圆角 + 柔和阴影 + 边框 */
export default function Card({ children, className, interactive }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 animate-fadeUp',
        interactive && 'hover:shadow-md transition cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}
