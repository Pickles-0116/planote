/**
 * PlanEditSkeleton - 计划编辑页骨架屏
 *
 * 与 PlanEdit.tsx 布局对应（useLiveQuery 首帧 undefined 时显示）：
 * - 顶栏（返回 + breadcrumb + 标题）
 * - 步骤指示器（3 段）
 * - 表单卡片（标题 + 描述 + 2 个日期 + 标签）
 * - 底部按钮
 *
 * 复用 add-app-shell 的 <Skeleton /> 通用组件。
 */

import Skeleton from '@/components/shell/Skeleton';

export default function PlanEditSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 顶栏 */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="w-3 h-3" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="w-3 h-3" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* 表单卡片 */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="w-6 h-6 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-8 w-1/2" />
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}
