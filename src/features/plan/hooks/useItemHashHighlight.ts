/**
 * useItemHashHighlight - 监听 URL hash `#item-{id}`，进入页面时滚动 + 1.5s 高亮
 *
 * 用法：在 PlanDetail 顶层调一次即可。
 *
 * 行为（add-kanban-board 增量 / spec Requirement: 点击卡跳转详情）：
 * 1. 监听 location.hash
 * 2. 匹配 `#item-{id}` 模式 → 拿 itemId
 * 3. setTimeout(100ms) 等 ItemRow 渲染完成（liveQuery 首帧）
 * 4. document.querySelector(`[data-item-id="${itemId}"]`) 拿元素
 * 5. scrollIntoView({ behavior: 'smooth', block: 'center' })
 * 6. 加 `ring-2 ring-amber-400 rounded-xl` 高亮 class
 * 7. 1.5s 后移除（cleanup 时也移除）
 *
 * 边界：
 * - hash 不存在 / 格式错 / 元素已删除 → 静默无副作用
 * - 同一 hash 多次进入 → 每次 location 变化都重新触发
 * - 离开 PlanDetail → cleanup 立即清高亮（避免幽灵环）
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const HIGHLIGHT_MS = 1500;
const SETTLE_MS = 100;
const HIGHLIGHT_CLASSES = ['ring-2', 'ring-amber-400', 'rounded-xl'];

export function useItemHashHighlight(): void {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith('#item-')) return;
    const itemId = hash.replace('#item-', '');
    if (!itemId) return;

    // 等 ItemRow 渲染完成
    const settleTimer = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-item-id="${itemId}"]`,
      );
      if (!el) return; // hash 指向的 item 已删或不在当前 plan

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(...HIGHLIGHT_CLASSES);

      const removeTimer = window.setTimeout(() => {
        el.classList.remove(...HIGHLIGHT_CLASSES);
      }, HIGHLIGHT_MS);

      // 存到元素上供 cleanup 读取
      (el as HTMLElement & { __highlightTimer?: number }).__highlightTimer =
        removeTimer;
    }, SETTLE_MS);

    return () => {
      window.clearTimeout(settleTimer);
      // 清理可能残留的高亮
      const el = document.querySelector<HTMLElement>(
        `[data-item-id="${itemId}"]`,
      );
      if (el) {
        el.classList.remove(...HIGHLIGHT_CLASSES);
        const t = (el as HTMLElement & { __highlightTimer?: number })
          .__highlightTimer;
        if (t !== undefined) {
          window.clearTimeout(t);
        }
      }
    };
  }, [location.hash]);
}
