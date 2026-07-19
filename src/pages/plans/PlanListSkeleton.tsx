/**
 * PlanListSkeleton - 计划列表页骨架屏
 *
 * 与原 mock 视觉布局对齐：
 * - 顶部：标题 + 副标题 + 按钮（h-8 / h-3 占位）
 * - 工具栏：搜索框 + 视图切换器
 * - 3 个分组各 3 张卡片占位
 *
 * 复用 add-app-shell 的 <Skeleton /> 通用组件。
 */

import Skeleton from '@/components/shell/Skeleton';

export default function PlanListSkeleton() {
  return (
    <div className="space-y-6 animate-fadeUp">
      {/* 标题 */}
      <div className="flex items-end justify-between">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-64" />
      </div>

      {/* 排序说明条 */}
      <Skeleton className="h-9 w-full" />

      {/* 3 组分组 × 3 张卡片 */}
      {Array.from({ length: 3 }).map((_, groupIdx) => (
        <div key={groupIdx} className="space-y-3">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 3 }).map((_, cardIdx) => (
            <Skeleton key={cardIdx} className="h-24" />
          ))}
        </div>
      ))}
    </div>
  );
}
