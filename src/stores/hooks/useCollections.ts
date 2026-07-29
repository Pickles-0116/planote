/**
 * useCollections - 订阅收藏夹列表的实时数据
 *
 * v1.4-Organize：收藏夹侧边栏 + 收藏夹选择器使用。
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { collectionRepo } from '@/db/repos';
import type { Collection, CollectionItem, CollectionEntityType, ID } from '@/types/domain';

/** 获取所有收藏夹（按 sortOrder 排序）。 */
export function useCollections(): Collection[] | undefined {
  return useLiveQuery(async () => collectionRepo.list(), []);
}

/** 获取某个收藏夹的所有关联项目。 */
export function useCollectionItems(collectionId: ID | null, entityType?: CollectionEntityType): CollectionItem[] | undefined {
  return useLiveQuery(
    async () => {
      if (!collectionId) return [];
      return collectionRepo.getItems(collectionId, entityType);
    },
    [collectionId, entityType],
    [],
  );
}

/** 获取某个实体所属的所有收藏夹。 */
export function useEntityCollections(entityType: CollectionEntityType | null, entityId: ID | null): Collection[] | undefined {
  return useLiveQuery(
    async () => {
      if (!entityType || !entityId) return [];
      return collectionRepo.getItemCollections(entityType, entityId);
    },
    [entityType, entityId],
    [],
  );
}
