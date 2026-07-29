/**
 * useCollectedBlogIds - 获取所有已加入收藏夹的博客 ID 集合
 *
 * v1.4-Organize：BlogList 页面用来过滤已收藏博客，
 * 只展示未收藏的博客 + 收藏夹入口卡片。
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { collectionRepo } from '@/db/repos';
import type { ID } from '@/types/domain';

/** 返回所有 entityType='blog' 的 CollectionItem 对应的 entityId 集合。 */
export function useCollectedBlogIds(): Set<ID> | undefined {
  const items = useLiveQuery(
    async () => {
      // 获取所有收藏夹中类型为 blog 的关联记录
      const allCollections = await collectionRepo.list();
      const allBlogItems: ID[] = [];
      for (const col of allCollections) {
        const blogItems = await collectionRepo.getItems(col.id, 'blog');
        for (const item of blogItems) {
          allBlogItems.push(item.entityId);
        }
      }
      return allBlogItems;
    },
    [],
    [],
  );

  return useMemo(() => {
    if (items === undefined) return undefined;
    return new Set(items);
  }, [items]);
}
