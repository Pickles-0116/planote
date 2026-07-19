/**
 * 通用工具函数
 * - cn: 合并 className（classnames 替代品，零依赖）
 */
export function cn(...classes: Array<string | undefined | false | null>): string {
  return classes.filter(Boolean).join(' ');
}

/** 简单的日期格式化：yyyy年M月d日 · 周X · 农历（农历占位） */
export function formatChineseDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${y}年${m}月${d}日 · ${weekdays[date.getDay()]}`;
}

/** 简单的问候语（按小时） */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '凌晨好';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
