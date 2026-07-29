/**
 * CollectionRepository 实现
 *
 * v1.4-Organize：收藏夹 CRUD + 关联管理。
 * - list 默认按 sortOrder 升序
 * - delete 级联删除 CollectionItem
 * - addItem 幂等（已存在不重复创建）
 */

import type { ID, Collection, CollectionItem, CollectionEntityType, ISODate } from '@/types/domain';
import type {
  CollectionRepository,
  CollectionCreateInput,
  CollectionUpdatePatch,
  AppErrorPayload,
} from './types';
import { AppError } from './types';
import { newId } from '@/lib/id';
import type { PlanoteDB } from '../schema';

const nowISO = (): ISODate => new Date().toISOString();

const throwNotFound = (id: ID): never => {
  const payload: AppErrorPayload = {
    code: 'NOT_FOUND',
    message: `Collection not found: ${id}`,
  };
  throw new AppError(payload);
};

const requireCollection = async (db: PlanoteDB, id: ID): Promise<Collection> => {
  const col = await db.collections.get(id);
  if (col === undefined) throwNotFound(id);
  return col as Collection;
};

export class CollectionRepo implements CollectionRepository {
  constructor(private db: PlanoteDB) {}

  async list(): Promise<Collection[]> {
    const rows = await this.db.collections.toArray();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async get(id: ID): Promise<Collection | undefined> {
    return this.db.collections.get(id);
  }

  async create(input: CollectionCreateInput): Promise<Collection> {
    const now = nowISO();
    // sortOrder 自动取最大值 + 1
    const all = await this.db.collections.toArray();
    const maxOrder = all.reduce((max, c) => Math.max(max, c.sortOrder), 0);

    const col: Collection = {
      ...input,
      id: newId(),
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collections.add(col);
    return col;
  }

  async update(id: ID, patch: CollectionUpdatePatch): Promise<Collection> {
    const existing = await requireCollection(this.db, id);
    const now = nowISO();
    const merged = { ...existing, ...patch, id, updatedAt: now } as Collection;
    await this.db.collections.put(merged);
    return merged;
  }

  async delete(id: ID): Promise<void> {
    await requireCollection(this.db, id);
    // 级联删除关联记录
    await this.db.collectionItems.where('collectionId').equals(id).delete();
    await this.db.collections.delete(id);
  }

  async reorder(ids: ID[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.db.collections.update(ids[i], { sortOrder: i + 1, updatedAt: nowISO() });
    }
  }

  async addItem(collectionId: ID, entityType: CollectionEntityType, entityId: ID): Promise<CollectionItem> {
    // 幂等：已存在则不重复创建
    const existing = await this.db.collectionItems
      .filter((item) => item.collectionId === collectionId && item.entityId === entityId)
      .first();
    if (existing) return existing as CollectionItem;

    const item: CollectionItem = {
      id: newId(),
      collectionId,
      entityType,
      entityId,
      addedAt: nowISO(),
    };
    await this.db.collectionItems.add(item);
    return item;
  }

  async removeItem(collectionId: ID, entityId: ID): Promise<void> {
    await this.db.collectionItems
      .filter((item) => item.collectionId === collectionId && item.entityId === entityId)
      .delete();
  }

  async getItems(collectionId: ID, entityType?: CollectionEntityType): Promise<CollectionItem[]> {
    if (entityType) {
      return this.db.collectionItems
        .filter((item) => item.collectionId === collectionId && item.entityType === entityType)
        .toArray();
    }
    return this.db.collectionItems
      .filter((item) => item.collectionId === collectionId)
      .toArray();
  }

  async getItemCollections(entityType: CollectionEntityType, entityId: ID): Promise<Collection[]> {
    const items = await this.db.collectionItems
      .filter((item) => item.entityType === entityType && item.entityId === entityId)
      .toArray();
    if (items.length === 0) return [];
    const collectionIds = [...new Set(items.map((i) => i.collectionId))];
    const collections = await this.db.collections.bulkGet(collectionIds);
    return collections.filter((c): c is Collection => c !== undefined);
  }
}

// 默认工厂
import { db as defaultDb } from '../index';
export const createCollectionRepo = (database: PlanoteDB = defaultDb): CollectionRepo =>
  new CollectionRepo(database);
