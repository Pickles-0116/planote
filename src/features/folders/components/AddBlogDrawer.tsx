/**
 * AddBlogDrawer - 「添加博客」右侧抽屉（folders-redesign 原型对齐）
 *
 * 交互（与已确认原型一致）：
 * - 列出「全部博客」，但隐藏 folderId === currentFolderId 的（已在此文件夹里的不再出现）。
 * - 每条博客显示：标题、标签，以及来源徽标：
 *   · folderId 为空或 ROOT_FOLDER_ID → 「未分类」，操作按钮文案「添加」；
 *   · folderId 是别的文件夹 → 「来自：{文件夹名}」，操作按钮文案「转移」（绿色系区分）。
 * - 单条按钮：点击 onAdd(blogId, currentFolderId)，抽屉保持打开、列表自动刷新（该条 folderId 变化后被过滤掉）。
 * - 多选：每条带 checkbox，底部「已选 N 条」+「加入当前文件夹」批量加入并关闭抽屉。
 * - 顶部搜索框：按标题 / 标签过滤。
 * - 点击遮罩或 × 关闭。
 *
 * 拖拽投放区：原型有此设计，但 HTML5 拖拽易引入不稳定代码，本次按「锦上添花，做不了就省略」原则省略，
 * 保证「单条按钮 + 多选批量」两条主路径正确即可。
 *
 * 写操作通过 props.onAdd 上抛，由 Folders 页统一调用 useBlogStore.updateBlog（folderCount 自动维护）。
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import type { Blog, Folder, ID } from '@/types/domain';
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from '@/features/folders/constants';
import { useTags } from '@/stores';
import { cn } from '@/lib/utils';

const DRAWER_MAX_WIDTH = 'max-w-[560px]';

interface Props {
  /** 抽屉是否打开。 */
  open: boolean;
  /** 关闭抽屉（点击遮罩 / ×）。 */
  onClose: () => void;
  /** 当前所在文件夹 ID，作为加入目标。 */
  currentFolderId: ID;
  /** 全部博客列表（由 Folders 页通过 useBlogs 提供）。 */
  blogs: Blog[];
  /** 全部文件夹列表（用于解析「来自：文件夹名」）。 */
  folders: Folder[];
  /** 加入回调：(blogId, targetFolderId) => void。 */
  onAdd: (blogId: ID, targetFolderId: ID) => void;
}

export default function AddBlogDrawer({
  open,
  onClose,
  currentFolderId,
  blogs,
  folders,
  onAdd,
}: Props): JSX.Element {
  const tags = useTags();
  const [query, setQuery] = useState<string>('');
  const [checked, setChecked] = useState<Set<ID>>(new Set());

  // 每次打开时重置搜索词与勾选状态，避免残留。
  useEffect(() => {
    if (open) {
      setQuery('');
      setChecked(new Set());
    }
  }, [open]);

  // folderId → Folder（解析来源名）
  const folderMap = useMemo<Map<ID, Folder>>(() => {
    const m = new Map<ID, Folder>();
    for (const f of folders ?? []) m.set(f.id, f);
    return m;
  }, [folders]);

  // tagId → 标签名（抽屉内展示标签用）
  const tagMap = useMemo<Map<ID, string>>(() => {
    const m = new Map<ID, string>();
    if (tags) {
      for (const t of tags) m.set(t.id, t.name);
    }
    return m;
  }, [tags]);

  // 可见列表：隐藏已在此文件夹的博客 + 搜索过滤。
  const visibleBlogs = useMemo<Blog[]>(() => {
    const list = blogs ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((b) => b.folderId !== currentFolderId)
      .filter((b) => {
        if (!q) return true;
        const titleHit = b.title.toLowerCase().includes(q);
        const tagHit = b.tagIds.some((tid) =>
          (tagMap.get(tid) ?? tid).toLowerCase().includes(q),
        );
        return titleHit || tagHit;
      });
  }, [blogs, currentFolderId, query, tagMap]);

  const toggleCheck = (id: ID, value: boolean): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = visibleBlogs.length > 0 && visibleBlogs.every((b) => checked.has(b.id));

  const toggleSelectAll = (): void => {
    setChecked((prev) => {
      if (allSelected) {
        // 取消当前可见列表的全选（保留不在当前列表里的选中，避免误清空搜索前的勾选）
        const next = new Set(prev);
        for (const b of visibleBlogs) next.delete(b.id);
        return next;
      }
      const next = new Set(prev);
      for (const b of visibleBlogs) next.add(b.id);
      return next;
    });
  };

  // 单条加入：保持抽屉打开，folderId 变化后该条会自动从列表消失（自动刷新）。
  const handleRowAdd = (id: ID): void => {
    onAdd(id, currentFolderId);
  };

  // 批量加入：对所选每条执行 onAdd，随后清空并关闭抽屉。
  const handleConfirm = (): void => {
    if (checked.size === 0) return;
    checked.forEach((id) => onAdd(id, currentFolderId));
    setChecked(new Set());
    onClose();
  };

  const currentFolderName = folderMap.get(currentFolderId)?.name ?? ROOT_FOLDER_NAME;

  return (
    <div
      className={cn('fixed inset-0 z-50', open ? '' : 'pointer-events-none')}
      aria-hidden={!open}
    >
      {/* 遮罩 */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-stone-900/40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* 抽屉主体 */}
      <div
        className={cn(
          'absolute top-0 right-0 h-full w-full bg-white dark:bg-stone-800',
          DRAWER_MAX_WIDTH,
          'border-l border-stone-200 dark:border-stone-700 shadow-2xl flex flex-col',
          'transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700">
          <h3 className="text-base font-semibold text-brand-900 dark:text-stone-100 truncate">
            加入博客到「{currentFolderName}」
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="text-brand-400 hover:text-brand-700 dark:hover:text-stone-200 transition p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 dark:text-stone-500 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索博客标题 / 标签…"
              className={cn(
                'w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-600',
                'bg-white dark:bg-stone-800 text-brand-700 dark:text-stone-200 placeholder:text-brand-300 dark:placeholder:text-stone-500',
                'focus:outline-none focus:ring-2 focus:ring-brand-500',
              )}
            />
          </div>
        </div>

        {/* 全选工具条 */}
        {visibleBlogs.length > 0 && (
          <div className="px-3 pb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-brand-700 dark:text-stone-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-brand-600 cursor-pointer"
              />
              全选
            </label>
            <span className="text-xs text-brand-500 dark:text-stone-400">
              共 {visibleBlogs.length} 条
            </span>
          </div>
        )}

        {/* 列表 */}
        <div className="flex-1 overflow-auto px-3 pb-3 space-y-2">
          {visibleBlogs.length === 0 ? (
            <div className="text-sm text-brand-500 dark:text-stone-400 text-center py-10">
              没有可加入的博客——当前文件夹的都已在此。
            </div>
          ) : (
            visibleBlogs.map((b) => {
              const isUncategorized = !b.folderId || b.folderId === ROOT_FOLDER_ID;
              const sourceName = isUncategorized
                ? null
                : folderMap.get(b.folderId)?.name ?? ROOT_FOLDER_NAME;
              return (
                <div
                  key={b.id}
                  className={cn(
                    'flex items-start gap-2.5 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700',
                    'bg-white dark:bg-stone-800 hover:border-brand-300 dark:hover:border-stone-600 transition',
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`选择 ${b.title}`}
                    checked={checked.has(b.id)}
                    onChange={(e) => toggleCheck(b.id, e.target.checked)}
                    className="mt-1 w-4 h-4 accent-brand-600 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brand-900 dark:text-stone-100 truncate">
                      {b.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {isUncategorized ? (
                        <span className="text-[11px] text-stone-500 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded">
                          未分类
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                          来自：{sourceName}
                        </span>
                      )}
                      {b.tagIds.slice(0, 3).map((tid) => (
                        <span
                          key={tid}
                          className="text-[11px] text-brand-600 bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded"
                        >
                          #{tagMap.get(tid) ?? tid}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRowAdd(b.id)}
                    className={cn(
                      'mt-0.5 flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition',
                      isUncategorized
                        ? 'text-brand-700 border-brand-200 hover:bg-brand-50 dark:text-brand-300 dark:border-stone-600 dark:hover:bg-stone-700'
                        : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50',
                    )}
                  >
                    {isUncategorized ? '添加' : '转移'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* 底部：多选批量 */}
        <div className="border-t border-stone-200 dark:border-stone-700 p-3 flex items-center justify-between">
          <span className="text-xs text-brand-500 dark:text-stone-400">
            已选 {checked.size} 条
          </span>
          <button
            type="button"
            disabled={checked.size === 0}
            onClick={handleConfirm}
            className={cn(
              'text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-1.5 transition',
              'bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900',
              'hover:bg-brand-800 dark:hover:bg-stone-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Plus size={14} />
            加入当前文件夹
          </button>
        </div>
      </div>
    </div>
  );
}
