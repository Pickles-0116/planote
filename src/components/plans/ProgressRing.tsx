/**
 * ProgressRing - SVG 圆形进度环
 *
 * 用途：详情页 Hero 区中央大环。
 *
 * 算法（design.md §2.3）：
 * - C = 2πR（周长）
 * - offset = C × (1 - pct/100)
 * - strokeDasharray=C + strokeDashoffset=offset 实现 0% → 100% 顺时针
 * - 顶层 circle rotate(-90deg) 让起点在 12 点钟方向
 *
 * 颜色（按百分比切换）：
 * - 0-49%   → stone-700
 * - 50-99%  → brand-900
 * - 100%    → emerald-500（+ 动画）
 *
 * 视觉细节：中心数字 + "完成度" 副标题。
 */

import { cn } from '@/lib/utils';

interface Props {
  /** 0-100 整数百分比；越界会被 clamp。 */
  value: number;
  /** 直径像素；默认 160。 */
  size?: number;
  /** 圆环粗细；默认 8。 */
  strokeWidth?: number;
  /** 是否在中心显示百分比文字 + "完成度"；默认 true。 */
  showLabel?: boolean;
  /** 100% 时是否触发 0→360° 入场动画；默认 true。 */
  animate?: boolean;
}

function colorFor(pct: number): string {
  if (pct >= 100) return '#10b981'; // emerald-500
  if (pct >= 50) return '#0f172a'; // brand-900
  return '#334155'; // stone-700 (slate-700)
}

export default function ProgressRing({
  value,
  size = 160,
  strokeWidth = 8,
  showLabel = true,
  animate = true,
}: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const R = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);
  const stroke = colorFor(pct);
  const isComplete = pct >= 100;
  const center = size / 2;

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`完成进度 ${pct}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* 底层静态圆 */}
        <circle
          cx={center}
          cy={center}
          r={R}
          fill="none"
          stroke="#e7e5e4" // stone-200
          strokeWidth={strokeWidth}
        />
        {/* 顶层进度圆 */}
        <circle
          cx={center}
          cy={center}
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-500 ease-out',
            isComplete && animate && 'animate-progress-complete',
          )}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className={cn(
              'text-3xl font-bold tracking-tight',
              isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-900 dark:text-stone-100',
            )}
          >
            {pct}%
          </div>
          <div className="text-[10px] text-brand-500 dark:text-stone-400 mt-0.5">完成度</div>
        </div>
      )}
    </div>
  );
}
