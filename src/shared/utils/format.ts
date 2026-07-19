/**
 * 时间 / 字符串格式化工具
 *
 * 设计原则：
 * - 零依赖（不引 dayjs / date-fns）
 * - 纯函数，便于单测
 * - 中文文案与 prototype 视觉风格保持一致
 */

import type { ISODate } from '@/types/domain';

/**
 * 相对时间格式化。
 *
 * 文案规范（与 prototype mock 视觉保持一致）：
 * - 未来时间 / < 1 分钟：刚刚
 * - < 60 分钟          ：N 分钟前
 * - < 24 小时          ：N 小时前
 * - 1 天（昨天内）     ：昨天 HH:mm
 * - < 30 天            ：N 天前
 * - ≥ 30 天            ：M月D日
 *
 * @param iso ISO 8601 时间字符串
 * @param now 当前时间（毫秒），默认 `Date.now()`，便于测试注入
 * @returns 形如「刚刚」「30 分钟前」「2 小时前」「昨天 21:30」「7月16日」的相对时间字符串
 *
 * @example
 *   formatRelativeTime('2026-07-19T01:00:00Z') // → '30 分钟前'
 *   formatRelativeTime('2026-07-18T01:00:00Z') // → '昨天 01:00'
 */
export function formatRelativeTime(iso: ISODate, now: number = Date.now()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '刚刚';
  const diff = now - ts;
  if (diff < 0) return '刚刚';

  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;

  const day = Math.floor(hour / 24);
  if (day === 1) {
    const d = new Date(ts);
    return `昨天 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  if (day < 30) return `${day} 天前`;

  // ≥ 30 天降级为「M月D日」
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 补 0：9 → '09'。 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
