/**
 * CollectionDetail - 收藏夹详情页（/collections/:id）
 *
 * v1.4-Organize：展示收藏夹内所有收藏项（计划/博客/模板），
 * 支持移除、重命名收藏夹、删除收藏夹。
 */

import { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  X,
  Target,
  Newspaper,
  FileText,
  Check,
} from 'lucide-react';
import { collectionRepo } from '@/db/repos';
import { useCollectionItems, useCollectionsStore } from '@/stores';
import { usePlans, useBlogs, useAllTemplates } from '@/stores';
import type { CollectionItem, CollectionEntityType, Plan, Blog, BlogTemplate } from '@/types/domain';
import EmptyState from '@/components/shell/EmptyState';
import { FolderOpen } from 'lucide-react';

const TYPE_LABEL: Record<CollectionEntityType, string> = {
  plan: '计划',
  blog: '博客',
  template: '模板',
};

const TYPE_ICON: Record<CollectionEntityType, typeof Target> = {
  plan: Target,
  blog: Newspaper,
  template: FileText,
};

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 收藏夹本体
  const collection = useLiveQuery(
    async () => (id ? collectionRepo.get(id) : undefined),
    [id],
  );

  // 收藏项关联
  const items = useCollectionItems(id ?? null);
  const removeItem = useCollectionsStore((s) => s.removeItemFromCollection);
  const deleteCollection = useCollectionsStore((s) => s.deleteCollection);
  const updateCollection = useCollectionsStore((s) => s.updateCollection);

  // 全量数据（用于根据 entityId 查出具体实体）
  const plans = usePlans();
  const blogs = useBlogs();
  const templates = useAllTemplates();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // 按类型分组
  const grouped = useMemo(() => {
    const map = new Map<CollectionEntityType, Array<{ item: CollectionItem; entity: Plan | Blog | BlogTemplate | undefined }>>();
    if (!items || !plans || !blogs || !templates) return map;
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const blogMap = new Map(blogs.map((b) => [b.id, b]));
    const tplMap = new Map(templates.map((t) => [t.id, t]));
    for (const item of items) {
      const entity =
        item.entityType === 'plan' ? planMap.get(item.entityId) :
        item.entityType === 'blog' ? blogMap.get(item.entityId) :
        tplMap.get(item.entityId);
      if (!map.has(item.entityType)) map.set(item.entityType, []);
      map.get(item.entityType)!.push({ item, entity });
    }
    return map;
  }, [items, plans, blogs, templates]);

  const handleRemove = useCallback(
    async (item: CollectionItem) => {
      if (!id) return;
      try {
        await removeItem(id, item.entityId);
      } catch { /* store handles error */ }
    },
    [id, removeItem],
  );

  const handleDelete = useCallback(async () => {
    if (!id) return;
    if (!confirm('确定删除此收藏夹？收藏内容不会被删除，只是取消关联。')) return;
    try {
      await deleteCollection(id);
      navigate('/plans');
    } catch { /* store handles error */ }
  }, [id, deleteCollection, navigate]);

  const handleSaveName = useCallback(async () => {
    if (!id || !editName.trim()) return;
    try {
      await updateCollection(id, { name: editName.trim() });
      setEditing(false);
    } catch { /* store handles error */ }
  }, [id, editName, updateCollection]);

  // 加载中
  if (collection === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-brand-400">加载中…</div>
      </div>
    );
  }

  // 不存在
  if (!collection) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="收藏夹不存在"
        description="该收藏夹可能已被删除"
        action={{ label: '返回', onClick: () => navigate(-1) }}
        variant="default"
      />
    );
  }

  const totalItems = items?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 animate-fadeUp">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition text-brand-500"
        >
          <ArrowLeft size={18} />
        </button>

        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: collection.color }} />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xl font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl text-brand-900 dark:text-stone-100"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false); }}
            />
            <button type="button" onClick={handleSaveName} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-brand-600">
              <Check size={16} />
            </button>
            <button type="button" onClick={() => setEditing(false)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-brand-400">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: collection.color }} />
            <h1 className="text-2xl font-bold text-brand-900 dark:text-stone-100">{collection.name}</h1>
            <span className="text-xs text-brand-400 dark:text-stone-500 ml-1">{totalItems} 项</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setEditName(collection.name); setEditing(true); }}
          className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition text-brand-500"
          title="重命名"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition text-brand-400 hover:text-red-600"
          title="删除收藏夹"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* 空状态 */}
      {totalItems === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="收藏夹是空的"
          description="在计划、博客或模板卡片上点击书签图标即可添加到收藏夹"
          variant="compact"
        />
      )}

      {/* 按类型分组展示 */}
      {totalItems > 0 && (
        <div className="space-y-6">
          {(['plan', 'blog', 'template'] as CollectionEntityType[]).map((type) => {
            const group = grouped.get(type);
            if (!group || group.length === 0) return null;
            const Icon = TYPE_ICON[type];
            return (
              <section key={type} className="animate-fadeUp">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className="text-brand-500" />
                  <h2 className="text-sm font-semibold text-brand-700 dark:text-stone-300">
                    {TYPE_LABEL[type]}
                  </h2>
                  <span className="text-xs text-brand-400">{group.length}</span>
                </div>
                <div className="space-y-1.5">
                  {group.map(({ item, entity }) => (
                    <CollectionItemRow
                      key={item.id}
                      item={item}
                      entity={entity}
                      entityType={type}
                      onRemove={() => handleRemove(item)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 收藏项行
 * ============================================================ */
function CollectionItemRow({
  item,
  entity,
  entityType,
  onRemove,
}: {
  item: CollectionItem;
  entity: Plan | Blog | BlogTemplate | undefined;
  entityType: CollectionEntityType;
  onRemove: () => void;
}) {
  const to =
    entityType === 'plan' ? `/plans/${item.entityId}` :
    entityType === 'blog' ? `/blogs/${item.entityId}` :
    `/templates/${item.entityId}/edit`;

  const title = entity
    ? ('title' in entity ? entity.title : 'name' in entity ? entity.name : item.entityId)
    : '(已删除)';

  const subtitle =
    entity && 'description' in entity && entity.description
      ? (entity.description as string).slice(0, 80)
      : entity && 'excerpt' in entity && entity.excerpt
        ? (entity.excerpt as string).slice(0, 80)
        : null;

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-brand-300 transition">
      <Link to={entity ? to : '#'} className="flex-1 min-w-0">
        <div className="text-sm font-medium text-brand-900 dark:text-stone-100 truncate group-hover:text-brand-700">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-brand-400 dark:text-stone-500 truncate mt-0.5">{subtitle}</div>
        )}
        {!entity && (
          <div className="text-xs text-red-400 mt-0.5">该项已不存在</div>
        )}
      </Link>
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-lg text-brand-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
        title="移除"
      >
        <X size={14} />
      </button>
    </div>
  );
}
