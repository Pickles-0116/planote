/**
 * Skeleton - 基础骨架单元
 *
 * 用途：数据未就绪时的占位元素（useLiveQuery 首帧 undefined、列表加载中等）。
 * 与 LoadingOverlay 语义互补：
 * - Skeleton：局部占位，与原内容尺寸一致，避免布局抖动
 * - LoadingOverlay：整页遮罩，提示「正在切换视图」
 *
 * 设计取舍：仅暴露 className + rounded 两个 prop；复杂尺寸/形状用 className 组合。
 * 复用原则：本组件不带业务依赖，跨页面通用。
 */
import { cn } from '@/lib/utils';

interface SkeletonProps {
  /** 自定义尺寸 / 形状（h-* w-* rounded-* 等） */
  className?: string;
  /** 是否带 rounded 圆角；默认 true */
  rounded?: boolean;
}

export default function Skeleton({ className, rounded = true }: SkeletonProps) {
  return (
    <div
      className={cn('bg-stone-200 dark:bg-stone-700 animate-pulse', rounded && 'rounded', className)}
      aria-hidden
    />
  );
}
