/**
 * useCollectionsWithBlogCount - 获取收藏夹 + 每个收藏夹中的博客数量
 *
 * v1.4-Organize：BlogList 页面顶部的收藏夹入口卡片使用。
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { collectionRepo } from '@/db/repos';
import type { Collection } from '@/types/domain';

export interface CollectionWithCount {
  collection: Collection;
  blogCount: number;
}

export function useCollectionsWithBlogCount(): CollectionWithCount[] | undefined {
  return useLiveQuery(
    async () => {
      const collections = await collectionRepo.list();
      const result: CollectionWithCount[] = [];
      for (const col of collections) {
        const items = await collectionRepo.getItems(col.id, 'blog');
        result.push({ collection: col, blogCount: items.length });
      }
      return result;
    },
    [],
  );
}
