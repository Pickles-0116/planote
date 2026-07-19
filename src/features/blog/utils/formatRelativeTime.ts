/**
 * formatRelativeTime - 相对时间格式化（add-blog-list-and-detail 增量）
 *
 * 规则：
 * - < 1min：刚刚
 * - < 1h：N 分钟前
 * - < 24h：N 小时前
 * - < 7d：N 天前
 * - 否则：返回入参（让 caller 决定 fallback 形式）
 *
 * 设计：
 * - 纯函数，无副作用
 * - 入参接受 ISO 字符串或 Date（便于跨数据源复用）
 * - 失败时回退到入参原始字符串（不抛错）
 */

import { formatChineseDate } from '@/lib/utils';

export function formatRelativeTime(input: string | Date): string {
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else {
    date = new Date(input);
  }
  if (Number.isNaN(date.getTime())) {
    // 入参无效：返回原始字符串形式
    return typeof input === 'string' ? input : '';
  }
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0) {
    // 未来时间（数据异常或时钟漂移）
    return '刚刚';
  }
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  // 7 天以上：显绝对日期
  return formatChineseDate(date);
}
