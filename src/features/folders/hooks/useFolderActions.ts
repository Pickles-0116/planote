/**
 * useFolderActions - 文件夹写操作 hook（V1.2 F2）
 *
 * 封装 folderRepo 的 create / update / delete / move，
 * 统一错误 → toast，供 FolderTree / BlogEdit 等组件调用。
 *
 * 注意：删除会触发 FolderRepo 的级联 reparent（子目录上移 + 博客归入未分类），
 * 本 hook 仅负责调用与提示，不处理二次确认的 UI（由调用方完成）。
 */

import { useCallback } from 'react';
import { folderRepo } from '@/db/repos';
import { useBlogStore, useToastStore } from '@/stores';
import type { Folder, ID } from '@/types/domain';
import type { FolderCreateInput } from '@/db/repos/types';

export function useFolderActions() {
  const pushToast = useToastStore((s) => s.push);
  const updateBlog = useBlogStore((s) => s.updateBlog);

  const createFolder = useCallback(
    async (input: FolderCreateInput): Promise<Folder | null> => {
      try {
        return await folderRepo.create(input);
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : '创建文件夹失败');
        return null;
      }
    },
    [pushToast],
  );

  const renameFolder = useCallback(
    async (id: ID, name: string): Promise<void> => {
      try {
        await folderRepo.update(id, { name: name.trim() || '未命名' });
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : '重命名失败');
      }
    },
    [pushToast],
  );

  const deleteFolder = useCallback(
    async (id: ID, reparentTo?: ID): Promise<void> => {
      try {
        await folderRepo.delete(id, reparentTo ? { reparentTo } : undefined);
        pushToast('success', '文件夹已删除');
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : '删除失败');
      }
    },
    [pushToast],
  );

  const moveFolder = useCallback(
    async (id: ID, newParentId: ID): Promise<void> => {
      try {
        await folderRepo.move(id, newParentId);
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : '移动失败');
      }
    },
    [pushToast],
  );

  /**
   * 把某篇博客归入指定文件夹（V1.2 F3 扩展）。
   *
   * 直接复用 `useBlogStore.updateBlog(blogId, { folderId })`，
   * folderCount（+1/-1）由 updateBlog 内部自动维护，无需手动处理。
   * 失败统一 → toast。
   */
  const setBlogFolder = useCallback(
    async (blogId: ID, folderId: ID): Promise<void> => {
      try {
        await updateBlog(blogId, { folderId });
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : '移动博客失败');
      }
    },
    [updateBlog, pushToast],
  );

  return { createFolder, renameFolder, deleteFolder, moveFolder, setBlogFolder };
}
