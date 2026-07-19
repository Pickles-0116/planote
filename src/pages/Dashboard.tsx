/**
 * Dashboard - 计划与博客一体化主页
 *
 * 本页所有数据均通过 useLiveQuery hook 实时订阅 IndexedDB（add-data-binding-dashboard）：
 * - 4 个数字卡 → useDashboardStats
 * - 今日聚焦   → useTodayFocus + useItemsForPlan
 * - 即将到期   → useUpcomingPlans
 * - 最近博客   → useRecentBlogs
 * - 最近活动   → useRecentActivity
 *
 * mock 数据（v1.0 Sprint 1 第 1 步的 STATS / TODAYS_FOCUS / RECENT_BLOGS / UPCOMING / ACTIVITIES 常量）
 * 已于本 change 移除——见 openspec/changes/add-data-binding-dashboard/proposal.md。
 */

import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ListChecks,
  Flame,
  PenLine,
  Target,
  Sparkles,
  ChevronRight,
  Wand2,
  Notebook,
  Calendar,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/shell/Skeleton';
import EmptyState from '@/components/shell/EmptyState';
import { formatChineseDate, greeting } from '@/lib/utils';
import { useDashboardStats } from '@/stores/hooks/useDashboardStats';
import { useTodayFocus } from '@/stores/hooks/useTodayFocus';
import { useItemsForPlan } from '@/stores/hooks/useItemsForPlan';
import { useUpcomingPlans } from '@/stores/hooks/useUpcomingPlans';
import { useRecentBlogs } from '@/stores/hooks/useRecentBlogs';
import { useRecentActivity } from '@/stores/hooks/useRecentActivity';
import type { ItemStatus, UrgencyLevel } from '@/types/domain';

/* ============================================================
 * 颜色 / 样式常量（与原 mock 视觉 100% 一致）
 * ============================================================ */

const COLOR_MAP: Record<string, { bg: string; text: string; bar: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-300', bar: 'bg-blue-500' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-300', bar: 'bg-purple-500' },
};

const URGENCY_BAR: Record<UrgencyLevel, string> = {
  red: 'bg-red-400',
  orange: 'bg-amber-400',
  yellow: 'bg-yellow-400',
  none: 'bg-blue-400',
};

const URGENCY_DAYS: Record<UrgencyLevel, string> = {
  red: '今天截止',
  orange: '1-3 天',
  yellow: '4-7 天',
  none: '未来',
};

const ACTIVITY_BG: Record<string, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
};

/* ============================================================
 * 子组件
 * ============================================================ */

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: typeof TrendingUp;
  color: keyof typeof COLOR_MAP;
  badge: string;
  delayClass: string;
  progress?: number;
  footer?: string;
}

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
  badge,
  delayClass,
  progress,
  footer,
}: StatCardProps) {
  const c = COLOR_MAP[color]!;
  return (
    <div
      className={`bg-white dark:bg-stone-800 rounded-2xl p-5 border border-stone-200 dark:border-stone-700 hover:shadow-md transition animate-fadeUp ${delayClass}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={c.text} size={16} />
        </div>
        <span className={`text-[10px] ${c.text} font-semibold ${c.bg} px-1.5 py-0.5 rounded`}>
          {badge}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">
        {value}
        {unit && <span className="text-sm text-brand-400 dark:text-stone-500 font-normal ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-brand-500 dark:text-stone-400 mt-1">{label}</div>

      {progress !== undefined && (
        <div className="mt-3 h-1 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${progress}%` }} />
        </div>
      )}

      {footer && <div className="text-[10px] text-brand-400 dark:text-stone-500 mt-2">{footer}</div>}
    </div>
  );
}

function TodoRow({ item }: { item: { id: string; title: string; status: ItemStatus } }) {
  const cls = {
    done: { wrap: 'bg-white/5', title: 'line-through text-white/50', tag: 'text-white/40', tagText: '已完成' },
    doing: { wrap: 'bg-accent-500/20 border border-accent-500/30', title: '', tag: 'text-accent-500 font-semibold', tagText: '进行中' },
    todo: { wrap: 'bg-white/5', title: 'text-white/70', tag: 'text-white/40', tagText: '待办' },
  }[item.status];

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl ${cls.wrap}`}>
      {item.status === 'done' ? (
        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px]">
          ✓
        </span>
      ) : item.status === 'doing' ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-accent-500" />
      ) : (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40" />
      )}
      <span className={`text-sm flex-1 ${cls.title}`}>{item.title}</span>
      <span className={`text-[10px] ${cls.tag}`}>{cls.tagText}</span>
    </div>
  );
}

/* ============================================================
 * 骨架屏（首帧 undefined 时显示）
 *
 * add-app-shell change：移除内嵌的 SkeletonBlock / EmptyDashboard，
 * 改用 src/components/shell/ 下的通用 Skeleton / EmptyState 组件。
 * 视觉与原实现保持一致（白底 / 圆角 / 柔和阴影）。
 * ============================================================ */

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-36" />
          <Skeleton className="h-56" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 空状态（无任何 plan 时显示）
 * ============================================================ */

function DashboardEmpty() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Notebook}
      title="欢迎来到 Planote 👋"
      description="创建你的第一个计划，让目标开始流动"
      action={{
        label: '新建计划',
        onClick: () => navigate('/plans/new'),
      }}
      variant="default"
    />
  );
}

/* ============================================================
 * 主页面
 * ============================================================ */

export default function Dashboard() {
  // 5 个派生 hook：任一未就绪 → 骨架屏
  const stats = useDashboardStats();
  const focus = useTodayFocus();
  const focusItems = useItemsForPlan(focus?.plan.id);
  const upcoming = useUpcomingPlans(3);
  const recentBlogs = useRecentBlogs(3);
  const activities = useRecentActivity(4);

  const isLoading =
    stats === undefined ||
    focus === undefined ||
    focusItems === undefined ||
    upcoming === undefined ||
    recentBlogs === undefined ||
    activities === undefined;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // 空状态：没有任何 plan（不论进行中还是已完成）时，引导用户创建
  const hasAnyPlan =
    stats.activePlans + stats.completedItems > 0 ||
    upcoming.length > 0 ||
    focus !== undefined;
  if (!hasAnyPlan) {
    return <DashboardEmpty />;
  }

  // 「即将到期」section 显示的真实数量
  const dueSoonCount = upcoming.length;

  return (
    <div className="space-y-8">
      {/* 欢迎语 */}
      <div className="flex items-end justify-between animate-fadeUp">
        <div>
          <p className="text-sm text-brand-500 dark:text-stone-400 mb-1">
            {greeting()}，梓浩 <span className="ml-1">👋</span>
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 dark:text-stone-100">今天是个适合推进的好日子</h1>
          <p className="text-sm text-brand-400 dark:text-stone-500 mt-2">{formatChineseDate()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/plans/new"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700 transition flex items-center gap-2 text-brand-900 dark:text-stone-100"
          >
            <Target className="text-brand-500 dark:text-stone-400" size={14} />
            新建计划
          </Link>
          <Link
            to="/blogs/new"
            className="px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition flex items-center gap-2 shadow-sm"
          >
            <PenLine size={14} />
            写博客
          </Link>
        </div>
      </div>

      {/* 关键数字 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="本月完成率"
          value={`${stats.monthlyCompletionRate}%`}
          icon={TrendingUp}
          color="emerald"
          badge="+0%"
          progress={stats.monthlyCompletionRate}
          delayClass="animate-delay-0"
        />
        <StatCard
          label="进行中的计划"
          value={String(stats.activePlans)}
          icon={ListChecks}
          color="blue"
          badge="活跃"
          footer={`${dueSoonCount} 项即将到期`}
          delayClass="animate-delay-50"
        />
        <StatCard
          label="已完成计划"
          value={String(stats.completedItems)}
          unit="个"
          icon={Flame}
          color="amber"
          badge="累计"
          progress={
            stats.activePlans + stats.completedItems > 0
              ? Math.round(
                  (stats.completedItems /
                    (stats.activePlans + stats.completedItems)) *
                    100,
                )
              : 0
          }
          delayClass="animate-delay-100"
        />
        <StatCard
          label="已发布博客"
          value={String(stats.publishedBlogs)}
          icon={PenLine}
          color="purple"
          badge="本月"
          delayClass="animate-delay-150"
        />
      </div>

      {/* 主体两列 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 左 2/3 */}
        <div className="col-span-2 space-y-6">
          {/* 今日聚焦（仅在 focus 存在时显示） */}
          {focus && (
            <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 rounded-2xl p-6 text-white relative overflow-hidden animate-fadeUp animate-delay-200">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-accent-500/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold bg-white/10 px-2 py-0.5 rounded-md tracking-wider">
                    今日聚焦
                  </span>
                  <span className="text-[10px] text-white/60">
                    {URGENCY_DAYS[focus.plan.urgency]}
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-1">{focus.plan.title}</h2>
                <p className="text-sm text-white/70 mb-5">
                  {focus.plan.description || '关注此计划以推进进度'} · 还剩{' '}
                  {focusItems.filter((i) => i.status !== 'done').length} 项事项
                </p>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full"
                      style={{ width: `${focus.plan.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{focus.plan.progress}%</span>
                </div>

                <div className="space-y-2">
                  {focusItems.slice(0, 4).map((item) => (
                    <TodoRow
                      key={item.id}
                      item={{
                        id: item.id,
                        title: item.title,
                        status: item.status,
                      }}
                    />
                  ))}
                  {focusItems.length === 0 && (
                    <div className="text-xs text-white/50 py-2">
                      该计划还没有事项
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 最近博客 */}
          <Card className="animate-delay-300">
            <div className="flex items-center justify-between mb-5 -mt-2">
              <h3 className="text-base font-semibold">最近博客</h3>
              <Link
                to="/blogs"
                className="text-xs text-brand-500 hover:text-brand-900 flex items-center gap-1"
              >
                查看全部 <ChevronRight size={12} />
              </Link>
            </div>
            {recentBlogs.length === 0 ? (
              <Link
                to="/blogs/new"
                className="block text-center py-10 text-sm text-brand-500 dark:text-stone-400 hover:text-brand-900 dark:hover:text-stone-100 transition"
              >
                还没有发布的博客，去写一篇 →
              </Link>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {recentBlogs.map((b) => {
                  const dateStr = (b.publishedAt ?? b.updatedAt).slice(0, 10);
                  return (
                    <Link key={b.id} to={`/blogs/${b.id}`} className="group block">
                      <div className="aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-700 dark:to-stone-800 flex items-center justify-center">
                        <PenLine className="text-stone-300 dark:text-stone-500" size={32} />
                      </div>
                      <div className="text-[10px] text-brand-400 dark:text-stone-500 mb-1">
                        {dateStr}
                      </div>
                      <div className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-brand-700 dark:text-stone-100 dark:group-hover:text-stone-300">
                        {b.title}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* 右 1/3 */}
        <div className="space-y-6">
          {/* 完成提醒（v1.0 仍为静态；Sprint 2 接计划模块后改为数据驱动） */}
          <section className="bg-gradient-to-br from-accent-50 to-amber-50 dark:from-accent-900/20 dark:to-amber-900/20 border border-accent-200 dark:border-accent-800/40 rounded-2xl p-5 animate-fadeUp animate-delay-250">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="text-white" size={14} />
              </div>
              <div>
                <div className="text-sm font-semibold text-accent-900 dark:text-accent-200">可以总结一下了 ✨</div>
                <div className="text-xs text-accent-700/80 dark:text-accent-300/80 mt-0.5">
                  完成计划后，把这段经历变成博客
                </div>
              </div>
            </div>
            <p className="text-xs text-accent-800/80 dark:text-accent-200/80 mb-3 leading-relaxed">
              写博客是一个很好的复盘方式，让完成计划的过程沉淀为可分享的内容。
            </p>
            <Link
              to="/blogs/new"
              className="w-full py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
            >
              <Wand2 size={14} />
              写一篇博客
            </Link>
          </section>

          {/* 即将到期 */}
          <Card className="animate-delay-350">
            <h3 className="text-sm font-semibold mb-4 flex items-center justify-between text-brand-900 dark:text-stone-100">
              <span>即将到期</span>
              <span className="text-[10px] text-brand-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded">
                {upcoming.length} 项
              </span>
            </h3>
            {upcoming.length === 0 ? (
              <div className="text-xs text-brand-400 dark:text-stone-500 text-center py-6 flex flex-col items-center gap-1">
                <Calendar size={20} className="text-stone-300 dark:text-stone-600" />
                近期没有要到期的事
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((u) => (
                  <Link
                    key={u.plan.id}
                    to={`/plans/${u.plan.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <div className={`w-1 h-10 rounded-full ${URGENCY_BAR[u.urgency]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-brand-700 dark:text-stone-100 dark:group-hover:text-stone-300">
                        {u.plan.title}
                      </div>
                      <div className="text-[10px] text-brand-400 dark:text-stone-500">
                        {u.daysLeft === 0
                          ? '今天截止'
                          : u.daysLeft === 1
                            ? '明天截止'
                            : `${u.daysLeft} 天后截止`}
                      </div>
                    </div>
                    <ChevronRight className="text-brand-300 dark:text-stone-600" size={14} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* 活动流 */}
          <Card className="animate-delay-400">
            <h3 className="text-sm font-semibold mb-4 text-brand-900 dark:text-stone-100">最近活动</h3>
            {activities.length === 0 ? (
              <div className="text-xs text-brand-400 dark:text-stone-500 text-center py-4">
                还没有活动记录
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-2.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_BG[a.color]} mt-1.5 flex-shrink-0`}
                    />
                    <div>
                      <div className="text-brand-700 dark:text-stone-200">{a.text}</div>
                      <div className="text-[10px] text-brand-400 dark:text-stone-500 mt-0.5">
                        {a.relativeTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
