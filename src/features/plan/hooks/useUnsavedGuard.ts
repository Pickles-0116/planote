/**
 * useUnsavedGuard - 表单未保存离开守卫
 *
 * 设计要点（design.md §2.4）：
 * - 监听 `beforeunload` 事件（关闭 tab / 刷新）
 * - 暴露 `confirmLeave()` 函数（路由变化 / 返回按钮调用）
 * - `when=true` 时弹浏览器原生 confirm
 *
 * v1.0 简化：仅在 unmount 时弹 confirm + 关闭 tab 时浏览器原生 confirm。
 * 完整 useBlocker 留 v1.1。
 */

import { useEffect } from 'react';

interface UseUnsavedGuardReturn {
  /** 主动调用：返回 true 表示允许离开，false 表示用户取消。 */
  confirmLeave: () => boolean;
}

export function useUnsavedGuard(when: boolean): UseUnsavedGuardReturn {
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome 要求 returnValue 非空才显示原生提示
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  const confirmLeave = (): boolean => {
    if (!when) return true;
    // 浏览器原生 confirm（仅在用户主动触发时生效）
    return window.confirm('离开后未保存的内容将丢失，确定离开？');
  };

  return { confirmLeave };
}
