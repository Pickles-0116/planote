/**
 * useAutoSave - Tiptap editor 自动保存 hook（add-blog-tiptap-editor 增量）
 *
 * 行为：
 * - 监听 `editor.on('update')` → setStatus('saving') + 启动 debounce
 * - 500ms 内无新 update → 调 onSave(json, plain, excerpt) + setStatus('saved')
 * - 立即保存（saveNow）：绕过 debounce，用于 Cmd/Ctrl+S 快捷键
 * - 卸载清理：clearTimeout + editor.off 双重保证
 *
 * 与 `useBlogStore.updateBlog` 配合：父组件在 onSave 内调 updateBlog。
 * 显式返回 saveNow 函数（暴露给 EditorToolbar / RichEditor 拦截快捷键）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { TiptapJSON } from '@/types/domain';
import { extractPlainText } from '../utils/extractPlainText';
import type { SaveStatus } from '@/types/editor';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

export type OnSave = (content: TiptapJSON, plain: string, excerpt: string) => void;

interface UseAutoSaveResult {
  status: SaveStatus;
  /** 立即触发一次保存（绕过 debounce）。 */
  saveNow: () => void;
}

const EXCERPT_MAX = 100;

export function useAutoSave(
  editor: Editor | null,
  onSave: OnSave,
  delay = 500,
): UseAutoSaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle');
  // ref 持有最新 onSave 避免 deps 频繁变化触发 useEffect 重建监听
  const onSaveRef = useRef<OnSave>(onSave);
  onSaveRef.current = onSave;

  const performSave = useCallback((): void => {
    if (!editor) return;
    const json = editor.getJSON() as TiptapJSON;
    const plain = extractPlainText(json);
    const excerpt = plain.slice(0, EXCERPT_MAX);
    onSaveRef.current(json, plain, excerpt);
    setStatus('saved');
  }, [editor]);

  const debouncedSave = useDebouncedCallback<() => void>(performSave, delay);

  // 监听 editor.on('update')
  useEffect(() => {
    if (!editor) return;
    const handler = (): void => {
      setStatus('saving');
      debouncedSave();
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, debouncedSave]);

  // 卸载时再清一次 timer 兜底（useDebouncedCallback 已自带，但双保险）
  useEffect(() => {
    return () => {
      setStatus('idle');
    };
  }, []);

  return { status, saveNow: performSave };
}
