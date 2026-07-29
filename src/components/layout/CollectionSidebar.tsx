/**
 * CollectionSidebar - 收藏夹侧边栏区块
 *
 * v1.4-Organize F2.4：在 Sidebar 中展示收藏夹快捷入口。
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { useCollections, useCollectionsStore } from '@/stores';

interface CollectionSidebarProps {
  onOpenCollection?: (collectionId: string) => void;
}

export default function CollectionSidebar({ onOpenCollection }: CollectionSidebarProps) {
  const collections = useCollections();
  const [collapsed, setCollapsed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const createCollection = useCollectionsStore(s => s.createCollection);
  const navigate = useNavigate();

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await createCollection({ name: newName.trim(), icon: 'Folder', color: '#3B82F6' });
      setNewName('');
      setShowCreate(false);
    } catch {
      // error handled by store
    }
  }, [newName, createCollection]);

  if (!collections || collections.length === 0) {
    if (!showCreate) {
      return (
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-brand-500 dark:text-stone-400 hover:text-brand-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition"
          >
            <FolderPlus size={14} />
            新建收藏夹
          </button>
          {showCreate && (
            <div className="mt-1 flex gap-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="收藏夹名称"
                className="flex-1 px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                autoFocus
              />
              <button type="button" onClick={handleCreate} className="px-2 py-1 text-xs bg-brand-600 text-white rounded-lg">
                创建
              </button>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="px-3 py-2">
        <div className="flex gap-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="收藏夹名称"
            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
            autoFocus
          />
          <button type="button" onClick={handleCreate} className="px-2 py-1 text-xs bg-brand-600 text-white rounded-lg">
            创建
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-500 dark:text-stone-400"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          收藏夹
        </button>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-brand-500 dark:text-stone-400"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {showCreate && (
        <div className="px-2 pb-1.5 flex gap-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="收藏夹名称"
            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
            autoFocus
          />
          <button type="button" onClick={handleCreate} className="px-2 py-1 text-xs bg-brand-600 text-white rounded-lg">
            创建
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="space-y-0.5">
          {collections.slice(0, 10).map(col => (
            <button
              key={col.id}
              type="button"
              onClick={() => onOpenCollection?.(col.id) ?? navigate(`/collections/${col.id}`)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-brand-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="truncate flex-1 text-left">{col.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}