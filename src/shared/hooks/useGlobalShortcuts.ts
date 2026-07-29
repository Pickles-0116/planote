/**
 * useGlobalShortcuts - 全局键盘快捷键
 *
 * 快捷键映射（PRD §全局交互）：
 * - Cmd/Ctrl + Z → 撤销
 * - Cmd/Ctrl + Shift + Z → 重做
 * - Cmd/Ctrl + N → 新建计划（/plans/new）
 * - Cmd/Ctrl + B → 新建博客（/blogs/new）
 * - Cmd/Ctrl + K → 跳转计划列表并聚焦搜索（/plans）
 * - Cmd/Ctrl + \ → 折叠/展开侧边栏
 *
 * 约束：
 * - undo/redo (Z) 在所有场景下响应（包括输入框内）
 * - 导航快捷键 (N/B/K/\) 在输入框内不响应，避免干扰编辑
 * - 不阻止编辑器内 Cmd+S（由 useAutoSave 各自处理）
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useUndoStore } from '@/stores/undoStore';
import { useToastStore } from '@/stores/toastStore';

/** 判断当前焦点是否在输入类元素内。 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts(): void {
  const navigate = useNavigate();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const undo = useUndoStore((s) => s.undo);
  const redo = useUndoStore((s) => s.redo);
  const stackLen = useUndoStore((s) => s.stack.length);
  const redoLen = useUndoStore((s) => s.redoStack.length);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd+Z / Cmd+Shift+Z：undo/redo（在所有场景下响应）
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (redoLen > 0) {
            void redo().then(() => pushToast('success', '已重做'));
          }
        } else {
          if (stackLen > 0) {
            void undo().then(() => pushToast('success', '已撤销'));
          }
        }
        return;
      }

      // 其余快捷键在输入框内不拦截
      if (isInputFocused()) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          navigate('/plans/new');
          break;
        case 'b':
          e.preventDefault();
          navigate('/blogs/new');
          break;
        case 'k':
          e.preventDefault();
          navigate('/plans');
          break;
        case '\\':
          e.preventDefault();
          toggleSidebar();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, toggleSidebar, undo, redo, stackLen, redoLen, pushToast]);
}
