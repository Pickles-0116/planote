/**
 * useDebouncedCallback - 通用 debounce hook（add-blog-tiptap-editor 增量）
 *
 * 用法：
 * ```tsx
 * const debounced = useDebouncedCallback((v: string) => save(v), 500);
 * debounced('hello'); // 500ms 后触发 save
 * ```
 *
 * 关键点：
 * - ref 持有最新 fn：调用方传新闭包不会让 useCallback 重新创建
 * - 每次新调用 clearTimeout 重置定时器
 * - unmount 时清理未触发的 timer（防写入脏数据）
 */

import { useEffect, useMemo, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载清理
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // useMemo 比 useCallback 更适合此处：返回值是个返回函数
  // （避免 eslint 对 useCallback 内部匿名函数体的依赖分析）
  return useMemo(() => {
    return ((...args: Parameters<T>) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
        timerRef.current = null;
      }, delay);
    }) as T;
  }, [delay]);
}
