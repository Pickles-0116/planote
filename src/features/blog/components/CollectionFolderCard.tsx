/**
 * CollectionFolderCard - 收藏夹入口卡片
 *
 * v1.4-Organize：在博客列表页顶部展示文件夹式入口，
 * 点击进入收藏夹查看里面的博客。
 */

import { Link } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import type { Collection } from '@/types/domain';

interface CollectionFolderCardProps {
  collection: Collection;
  blogCount: number;
}

export default function CollectionFolderCard({ collection, blogCount }: CollectionFolderCardProps) {
  return (
    <Link
      to={`/collections/${collection.id}`}
      className="group flex items-center gap-3 bg-white dark:bg-stone-800 rounded-2xl p-4 border border-stone-200 dark:border-stone-700 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm transition"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: collection.color + '20' }}
      >
        <FolderOpen size={20} style={{ color: collection.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-brand-900 dark:text-stone-100 truncate group-hover:text-brand-700">
          {collection.name}
        </div>
        <div className="text-xs text-brand-400 dark:text-stone-500">
          {blogCount} 篇博客
        </div>
      </div>
    </Link>
  );
}
