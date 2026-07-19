/**
 * PlanDetailSkeleton - 计划详情页骨架屏
 *
 * 与详情页布局对应（useLiveQuery 首帧 undefined 时显示）：
 * - 顶栏：返回 + 标题 + badges
 * - 计划概览：图标 + 标题 + 描述 + 元数据
 * - 进度环 + 关键数据
 * - 事项清单（5 行）
 * - 关联博客
 *
 * 复用 add-app-shell 的 <Skeleton /> 通用组件。
 */

import Skeleton from '@/components/shell/Skeleton';

export default function PlanDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 顶栏 */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* 计划概览 */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-start gap-5">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-3 w-full max-w-xl" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </div>

      {/* 进度环 + 关键数据 + 事项 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 左 2/3 事项 */}
        <div className="col-span-2 bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
        {/* 右 1/3 */}
        <div className="space-y-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      </div>

      {/* 关联博客 */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
