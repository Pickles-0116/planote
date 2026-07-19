/**
 * useDragDrop - HTML5 drag/drop 抽象（add-kanban-board 增量）
 *
 * 4 个事件 handler 绑 React.DragEvent<HTMLDivElement>：
 * - handleDragStart(itemId)   卡片 onDragStart：setData + effectAllowed
 * - handleDragOver            列 onDragOver：preventDefault + dropEffect='move'（必须）
 * - handleDragLeave           列 onDragLeave：留空（视觉态由组件自己管 isDragOver state）
 *
 * 选择 HTML5 而非 @dnd-kit：4 列固定、零依赖；v1.1 评估 @dnd-kit 增强 a11y。
 *
 * 边界：
 * - drop 到同 status 列：onDrop 回调内部早返回（见 Kanban 页面）
 * - 拖拽失败：onDrop 抛错由调用方 catch + toast
 */

import { useCallback } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { ID } from '@/types/domain';

export interface UseDragDropResult {
  handleDragStart: (itemId: ID) => (e: ReactDragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: ReactDragEvent<HTMLDivElement>) => void;
  /** 从 dataTransfer 读 itemId；返回 null 表示无数据。 */
  readItemId: (e: ReactDragEvent<HTMLDivElement>) => ID | null;
}

export function useDragDrop(): UseDragDropResult {
  const handleDragStart = useCallback(
    (itemId: ID) => (e: ReactDragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('text/plain', itemId);
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      // 必须 preventDefault，否则 onDrop 不触发
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [],
  );

  const handleDragLeave = useCallback(
    (_e: ReactDragEvent<HTMLDivElement>) => {
      // 视觉态由 KanbanColumn 内部 isDragOver state 切，hook 留空
    },
    [],
  );

  const readItemId = useCallback(
    (e: ReactDragEvent<HTMLDivElement>): ID | null => {
      const id = e.dataTransfer.getData('text/plain');
      return id || null;
    },
    [],
  );

  return { handleDragStart, handleDragOver, handleDragLeave, readItemId };
}
