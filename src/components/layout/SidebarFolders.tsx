/**
 * SidebarFolders - 侧边栏文件夹区块（V1.2 一致数据源）
 *
 * 取代旧的 `CollectionSidebar`（v1.4 collections 表），统一改用新的 `folders` 表，
 * 与 `/folders` 页面完全一致（都走 `useFolders()` → IndexedDB `folders` 表）。
 *
 * 特性：
 * - 可折叠
 * - 「新建」主文件夹（调用 `useFolderActions().createFolder`，在 root 下建 `main` 级文件夹）
 * - 点击任意文件夹 → 跳转到 `/folders` 页查看
 *
 * 渲染复用 `buildFolderTree` 构建的树（root → 主 → 日期），与 FolderTree 的分层一致，
 * 但侧边栏只做轻量导航，不做拖拽 / 改名 / 删除等重操作。
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder as FolderIcon, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useFolders,
  buildFolderTree,
  type FolderNode,
} from '@/features/folders/hooks/useFolders';
import type { ID } from '@/types/domain';
import { useFolderActions } from '@/features/folders/hooks/useFolderActions';
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from '@/features/folders/constants';

/** 侧边栏最多缩进层级（仅视觉，不影响数据）。 */
const MAX_INDENT_DEPTH = 3;

export default function SidebarFolders(): JSX.Element {
  const navigate = useNavigate();
  const folders = useFolders();
  const { createFolder } = useFolderActions();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const tree = buildFolderTree(folders ?? []);

  // 在 root 下新建一个主文件夹（与 FolderTree.handleAddRoot 保持一致）
  const handleCreateMain = useCallback(async (): Promise<void> => {
    const name = window.prompt('新建主文件夹名称：', '新文件夹');
    if (name === null || name.trim() === '') return;
    const order = (folders ?? []).filter((f) => f.parentId === ROOT_FOLDER_ID).length;
    await createFolder({
      name: name.trim(),
      type: 'main',
      parentId: ROOT_FOLDER_ID,
      order,
      depth: 1,
    });
  }, [createFolder, folders]);

  const navigateTo = useCallback((folderId: ID): void => {
    navigate('/folders?folderId=' + encodeURIComponent(folderId));
  }, [navigate]);

  const renderNode = (node: FolderNode, depth: number): JSX.Element => {
    const indent = Math.min(depth, MAX_INDENT_DEPTH);
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => void navigateTo(node.id)}
          style={{ paddingLeft: `${20 + indent * 14}px` }}
          className="group flex items-center gap-2 w-full px-2 py-1.5 text-sm text-brand-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition text-left"
        >
          <FolderIcon size={14} className="flex-shrink-0 text-brand-400 dark:text-stone-500" />
          <span className="truncate flex-1">
            {node.id === ROOT_FOLDER_ID ? ROOT_FOLDER_NAME : node.name}
          </span>
          <span className="text-[10px] text-brand-400 dark:text-stone-500 flex-shrink-0 tabular-nums">
            {node.blogCount}
          </span>
        </button>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const isEmpty = (folders ?? []).length === 0;

  return (
    <div className="px-2 pb-1">
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-500 dark:text-stone-400 hover:text-brand-700 dark:hover:text-stone-200 transition"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          文件夹
        </button>
        <button
          type="button"
          onClick={() => void handleCreateMain()}
          title="新建主文件夹"
          className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-brand-500 dark:text-stone-400 transition"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-0.5">
          {tree.map((node) => renderNode(node, 0))}
          {isEmpty && (
            <div className="px-3 py-1 text-xs text-brand-400 dark:text-stone-500">暂无文件夹</div>
          )}
        </div>
      )}
    </div>
  );
}
