/**
 * AddToCollectionButton - 通用「加入收藏夹」按钮
 *
 * v1.4-Organize F2.5：嵌入 PlanCard / BlogCard / TemplateCard 的收藏快捷操作。
 * - 点击显示收藏夹下拉列表
 * - 每个收藏夹旁有勾选/取消勾选的 toggle
 * - 底部有「新建收藏夹」快捷入口
 * - 点击外部自动关闭
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bookmark, BookmarkCheck, Plus } from 'lucide-react';
import { useCollections, useEntityCollections, useCollectionsStore } from '@/stores';
import type { ID, CollectionEntityType } from '@/types/domain';
import { cn } from '@/lib/utils';

interface AddToCollectionButtonProps {
  entityType: CollectionEntityType;
  entityId: ID;
  /** 按钮尺寸，默认 'sm' */
  size?: 'sm' | 'md';
}

export default function AddToCollectionButton({
  entityType,
  entityId,
  size = 'sm',
}: AddToCollectionButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const collections = useCollections();
  const entityCollections = useEntityCollections(entityType, entityId);
  const addItem = useCollectionsStore((s) => s.addItemToCollection);
  const removeItem = useCollectionsStore((s) => s.removeItemFromCollection);

  const isInAny = entityCollections && entityCollections.length > 0;
  const memberIds = new Set(entityCollections?.map((c) => c.id) ?? []);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = useCallback(
    async (collectionId: ID) => {
      try {
        if (memberIds.has(collectionId)) {
          await removeItem(collectionId, entityId);
        } else {
          await addItem(collectionId, entityType, entityId);
        }
      } catch {
        // error handled by store
      }
    },
    [memberIds, entityId, entityType, addItem, removeItem],
  );

  const iconSize = size === 'sm' ? 14 : 16;
  const btnClass = cn(
    'p-1 rounded-lg transition',
    isInAny
      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
      : 'text-brand-400 hover:text-brand-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700',
  );

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={btnClass}
        title={isInAny ? '已加入收藏夹' : '加入收藏夹'}
      >
        {isInAny ? <BookmarkCheck size={iconSize} /> : <Bookmark size={iconSize} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-lg py-1.5 animate-fadeUp">
          <div className="px-3 py-1.5 text-xs font-medium text-brand-500 dark:text-stone-400 border-b border-stone-100 dark:border-stone-700 mb-1">
            收藏夹
          </div>
          {(!collections || collections.length === 0) && (
            <div className="px-3 py-2 text-xs text-brand-400 dark:text-stone-500">
              还没有收藏夹
            </div>
          )}
          {collections?.map((col) => {
            const isMember = memberIds.has(col.id);
            return (
              <button
                key={col.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToggle(col.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                <span className="flex-1 truncate text-left text-brand-700 dark:text-stone-300">
                  {col.name}
                </span>
                {isMember && <BookmarkCheck size={12} className="text-amber-500 flex-shrink-0" />}
              </button>
            );
          })}
          <div className="border-t border-stone-100 dark:border-stone-700 mt-1 pt-1">
            <a
              href="/settings"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-brand-500 hover:text-brand-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus size={12} />
              新建收藏夹
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
