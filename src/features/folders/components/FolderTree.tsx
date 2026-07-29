/**
 * FolderTree - 文件夹树（V1.2 F2）
 *
 * 功能：
 * - 展示 root → 主 → 日期 的树，缩进渲染
 * - 选择文件夹（点击行）→ onSelect(id)；点击「全部文件夹」→ onSelect(null)
 * - 新建根文件夹 / 新建子文件夹（window.prompt 取名称）
 * - 重命名（window.prompt）/ 删除（window.confirm 二次确认，禁静默丢失）
 * - HTML5 拖拽：把文件夹拖到另一节点上 → reparent（folderRepo.move 校验树深 / 子孙）
 *
 * 删除策略：FolderRepo.delete 默认把子目录上移一层、博客归入未分类（父为 root）。
 * 根文件夹不可删除（FolderRepo 抛 VALIDATION，此处提前 guard）。
 *
 * 注：rename / delete 使用原生 prompt/confirm 以保证「二次确认」语义且零额外依赖；
 * 后续如需更精致的弹窗可替换为 Drawer 内联表单。
 */

import { useState } from 'react';
import { Folder as FolderIcon, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import type { Folder, ID } from '@/types/domain';
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from '@/features/folders/constants';
import { cn } from '@/lib/utils';
import { useFolderActions } from '../hooks/useFolderActions';
import { buildFolderTree, type FolderNode } from '../hooks/useFolders';

interface Props {
  folders: Folder[];
  selectedId: ID | null;
  onSelect: (id: ID | null) => void;
}

export default function FolderTree({ folders, selectedId, onSelect }: Props): JSX.Element {
  const { createFolder, renameFolder, deleteFolder, moveFolder } = useFolderActions();
  const [dragId, setDragId] = useState<ID | null>(null);
  const [dropTargetId, setDropTargetId] = useState<ID | null>(null);

  const tree = buildFolderTree(folders);

  const handleAddRoot = async (): Promise<void> => {
    const name = window.prompt('新建文件夹名称：', '新文件夹');
    if (name === null) return;
    await createFolder({ name, type: 'main', parentId: ROOT_FOLDER_ID, order: folders.length, depth: 1 });
  };

  const handleAddChild = async (parentId: ID, depth: number): Promise<void> => {
    const name = window.prompt('新建子文件夹名称：', '新文件夹');
    if (name === null) return;
    const type = depth + 1 >= 2 ? 'date' : 'main';
    await createFolder({ name, type, parentId, order: 0, depth: depth + 1 });
  };

  const handleRename = (f: Folder): void => {
    const name = window.prompt('重命名文件夹：', f.name);
    if (name === null || name.trim() === '') return;
    void renameFolder(f.id, name);
  };

  const handleDelete = (f: Folder): void => {
    if (f.type === 'root') {
      window.alert('根文件夹（未分类）不可删除');
      return;
    }
    const ok = window.confirm(
      `删除「${f.name}」？\n其下的子文件夹将上移一层，博客将归入「未分类」。\n此操作不可撤销。`,
    );
    if (!ok) return;
    void deleteFolder(f.id);
  };

  const handleDrop = (targetId: ID): void => {
    if (dragId && dragId !== targetId) {
      void moveFolder(dragId, targetId);
    }
    setDragId(null);
    setDropTargetId(null);
  };

  const renderNode = (node: FolderNode, depth: number): JSX.Element => (
    <div key={node.id}>
      <div
        draggable
        onDragStart={(e) => {
          setDragId(node.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropTargetId(node.id);
        }}
        onDragLeave={() => setDropTargetId((t) => (t === node.id ? null : t))}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(node.id);
        }}
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition select-none',
          selectedId === node.id && 'bg-brand-900 text-white',
          dropTargetId === node.id && 'ring-2 ring-brand-400',
          dragId === node.id && 'opacity-40',
          selectedId !== node.id && 'hover:bg-stone-100 dark:hover:bg-stone-700',
        )}
      >
        <FolderIcon size={14} className="flex-shrink-0" />
        <span className="flex-1 min-w-0 truncate text-sm">
          {node.id === ROOT_FOLDER_ID ? ROOT_FOLDER_NAME : node.name}
        </span>
        <span className="text-[10px] text-brand-400 dark:text-stone-500 flex-shrink-0">
          {node.blogCount}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <button
            type="button"
            title="新建子文件夹"
            onClick={(e) => {
              e.stopPropagation();
              void handleAddChild(node.id, node.depth);
            }}
            className="p-0.5 rounded hover:bg-black/10"
          >
            <FolderPlus size={12} />
          </button>
          <button
            type="button"
            title="重命名"
            onClick={(e) => {
              e.stopPropagation();
              handleRename(node);
            }}
            className="p-0.5 rounded hover:bg-black/10"
          >
            <Pencil size={12} />
          </button>
          {node.type !== 'root' && (
            <button
              type="button"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node);
              }}
              className="p-0.5 rounded hover:bg-black/10 text-red-500"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      {node.children.map((c) => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-brand-500 dark:text-stone-400">文件夹</span>
        <button
          type="button"
          onClick={() => void handleAddRoot()}
          className="text-xs text-brand-600 hover:text-brand-900 dark:text-brand-400 flex items-center gap-1 transition"
        >
          <FolderPlus size={12} />
          新建
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm w-full text-left transition',
          selectedId === null
            ? 'bg-brand-900 text-white'
            : 'hover:bg-stone-100 dark:hover:bg-stone-700 text-brand-700 dark:text-stone-300',
        )}
      >
        <FolderIcon size={14} />
        全部文件夹
      </button>
      {tree.map((n) => renderNode(n, 0))}
    </div>
  );
}
