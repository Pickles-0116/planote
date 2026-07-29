/**
 * Folders - 收藏夹（文件夹）管理页（/folders 路由）
 *
 * 2024-06 新增：把原先错误塞进 /blogs 的「文件夹管理」独立成一个页面。
 *
 * 布局（两栏）：
 * - 左栏：FolderTree（复用已有组件）
 *   · 任意文件夹可创建子收藏夹、重命名、删除（删除含二次确认；
 *     若文件夹下有博客或子文件夹，执行 re-parent 上移策略，由 folderRepo.delete 默认处理）
 *   · 内置「新建」入口（在 root 下新建主收藏夹）
 * - 右栏：点击树中任一文件夹 → 一级级点进去查看其「子收藏夹 + 博客文件」
 *   · 顶部面包屑可逐级上钻（root → 主 → 日期）
 *   · 顶部/侧边「新建主收藏夹」入口；进入某文件夹后提供「在此新建子收藏夹」
 *
 * 数据：folders / blogs 走 useLiveQuery 订阅，实时响应 IndexedDB 变化。
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  Grid2x2,
  List as ListIcon,
  Newspaper,
  Plus,
  X,
} from 'lucide-react';
import FolderTree from '@/features/folders/components/FolderTree';
import AddBlogDrawer from '@/features/folders/components/AddBlogDrawer';
import { useFolders, getFolderPath, toFolderMap } from '@/features/folders/hooks/useFolders';
import { useFolderActions } from '@/features/folders/hooks/useFolderActions';
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from '@/features/folders/constants';
import { useBlogs, useAllTemplates } from '@/stores';
import type { Blog, BlogTemplate, Folder, ID } from '@/types/domain';
import { cn } from '@/lib/utils';
import BlogCard from '@/features/blog/components/BlogCard';
import EmptyState from '@/components/shell/EmptyState';

export default function FoldersPage(): JSX.Element {
  const folders = useFolders();
  const blogs = useBlogs();
  const templates = useAllTemplates();
  const { createFolder, setBlogFolder } = useFolderActions();

  // 「添加博客」抽屉开关
  const [addOpen, setAddOpen] = useState<boolean>(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = (searchParams.get('folderId') as ID | null) ?? ROOT_FOLDER_ID;

  // 当前选中的文件夹（null = 根层级，展示主收藏夹 + 未分类博客）
  const [selectedId, setSelectedId] = useState<ID | null>(initialId);
  const [blogView, setBlogView] = useState<'grid' | 'list'>('grid');

  const folderMap = useMemo(() => toFolderMap(folders), [folders]);

  // 选中的文件夹被删除 → 回退到根层级
  useEffect(() => {
    if (selectedId !== null && folders && !folders.some((f) => f.id === selectedId)) {
      setSelectedId(ROOT_FOLDER_ID);
    }
  }, [selectedId, folders]);

  // URL 的 folderId 变化时（如从侧边栏点击进入 / 浏览器前进后退）同步选中态。
  // 仅以 searchParams 作为依赖，避免与 handleSelect 的 state 更新互相触发造成重复渲染；
  // 守卫 pid !== selectedId 保证值相同时不重复 setState（React 同值会 bail out，无死循环）。
  useEffect(() => {
    const pid = searchParams.get('folderId');
    if (pid && pid !== selectedId) {
      setSelectedId(pid);
    }
  }, [searchParams, selectedId]);

  const effectiveId: ID = selectedId ?? ROOT_FOLDER_ID;

  // 面包屑：root → 主 → 日期（root 自身作为首级固定 crumb，不重复）
  const crumbs = useMemo<Folder[]>(
    () => (selectedId === null || selectedId === ROOT_FOLDER_ID ? [] : getFolderPath(selectedId, folderMap).slice(1)),
    [selectedId, folderMap],
  );

  // 当前文件夹名（用于右栏标题）
  const currentName = useMemo<string>(() => {
    if (selectedId === null || selectedId === ROOT_FOLDER_ID) return ROOT_FOLDER_NAME;
    return folderMap.get(selectedId)?.name ?? ROOT_FOLDER_NAME;
  }, [selectedId, folderMap]);

  // 子收藏夹（直接子级，不含自身）
  const childFolders = useMemo<Folder[]>(() => {
    if (!folders) return [];
    return folders
      .filter((f) => f.parentId === effectiveId && f.id !== ROOT_FOLDER_ID)
      .sort((a, b) => a.order - b.order);
  }, [folders, effectiveId]);

  // 当前文件夹下的博客
  const folderBlogs = useMemo<Blog[]>(() => {
    if (!blogs) return [];
    return blogs.filter((b) => b.folderId === effectiveId);
  }, [blogs, effectiveId]);

  const templateMap = useMemo(() => {
    const m = new Map<string, BlogTemplate>();
    if (templates) {
      for (const t of templates) m.set(t.id, t);
    }
    return m;
  }, [templates]);

  // 新建主文件夹（root 下）
  const handleNewMain = useCallback(async (): Promise<void> => {
    const name = window.prompt('新建主文件夹名称：', '新文件夹');
    if (name === null || name.trim() === '') return;
    await createFolder({
      name: name.trim(),
      type: 'main',
      parentId: ROOT_FOLDER_ID,
      order: (folders ?? []).filter((f) => f.parentId === ROOT_FOLDER_ID).length,
      depth: 1,
    });
  }, [createFolder, folders]);

  // 在当前文件夹下新建子文件夹
  const handleNewChild = useCallback(async (): Promise<void> => {
    const name = window.prompt('新建子文件夹名称：', '新子文件夹');
    if (name === null || name.trim() === '') return;
    const parentDepth = selectedId === null ? 0 : (folderMap.get(selectedId)?.depth ?? 0);
    const type: Folder['type'] = parentDepth + 1 >= 2 ? 'date' : 'main';
    await createFolder({
      name: name.trim(),
      type,
      parentId: effectiveId,
      order: childFolders.length,
      depth: parentDepth + 1,
    });
  }, [createFolder, selectedId, folderMap, effectiveId, childFolders.length]);

  // 抽屉「添加 / 转移」单条或批量：把博客归入当前文件夹
  const handleAddBlog = useCallback(
    (blogId: ID, targetFolderId: ID): void => {
      void setBlogFolder(blogId, targetFolderId);
    },
    [setBlogFolder],
  );

  // 详情页「移出」：把博客退为未分类（folderId → ROOT_FOLDER_ID）
  const handleRemoveBlog = useCallback(
    (blogId: ID): void => {
      void setBlogFolder(blogId, ROOT_FOLDER_ID);
    },
    [setBlogFolder],
  );

  // 统一选中：同时更新 state 与 URL（双向同步）。
  // 既 setSelectedId 又 setSearchParams，URL 变化会触发上面的 effect 再次 setSelectedId，
  // 但值相同会被 React bail out，不会造成无限渲染。
  // id 为 null（FolderTree「全部文件夹」）等价于根层级，URL 保持 folder-root 以保持一致。
  const handleSelect = useCallback(
    (id: ID | null): void => {
      setSelectedId(id);
      setSearchParams({ folderId: id ?? ROOT_FOLDER_ID });
    },
    [setSearchParams],
  );

  const isInsideFolder = selectedId !== null && selectedId !== ROOT_FOLDER_ID;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between animate-fadeUp">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 dark:text-stone-100">文件夹</h1>
          <p className="text-sm text-brand-500 dark:text-stone-400 mt-1">
            管理你的文件夹与博客归档 · 左侧树可新建 / 改名 / 删除
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleNewMain()}
          className="px-4 py-2.5 rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition shadow-sm flex items-center gap-2"
        >
          <FolderPlus size={14} />
          新建主文件夹
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
        {/* 左栏：文件夹树 */}
        <aside className="lg:sticky lg:top-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-3">
          <FolderTree
            folders={folders ?? []}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </aside>

        {/* 右栏：逐层下钻 */}
        <section className="min-w-0 space-y-4">
          {/* 面包屑 */}
          <nav className="flex items-center gap-1.5 text-sm text-brand-500 dark:text-stone-400 animate-fadeUp flex-wrap">
            <button
              type="button"
              onClick={() => handleSelect(ROOT_FOLDER_ID)}
              className="hover:text-brand-900 dark:hover:text-stone-100 transition"
            >
              {ROOT_FOLDER_NAME}
            </button>
            {crumbs.map((f, i) => (
              <Fragment key={f.id}>
                <ChevronRight size={14} className="text-brand-300 dark:text-stone-600" />
                {i === crumbs.length - 1 ? (
                  <span className="text-brand-900 dark:text-stone-100 font-medium">{f.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelect(f.id)}
                    className="hover:text-brand-900 dark:hover:text-stone-100 transition"
                  >
                    {f.name}
                  </button>
                )}
              </Fragment>
            ))}
          </nav>

          {/* 当前文件夹标题 + 操作 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FolderIcon size={18} className="text-brand-500 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-brand-900 dark:text-stone-100 truncate">
                {currentName}
              </h2>
              <span className="text-xs text-brand-400 dark:text-stone-500">
                {childFolders.length} 子文件夹 · {folderBlogs.length} 篇博客
              </span>
            </div>
            {isInsideFolder && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="h-9 px-3 text-sm rounded-xl bg-brand-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium hover:bg-brand-800 dark:hover:bg-stone-200 transition flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  添加博客
                </button>
                <button
                  type="button"
                  onClick={() => void handleNewChild()}
                  className="h-9 px-3 text-sm rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-brand-500 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition flex items-center gap-1.5"
                >
                  <FolderPlus size={14} />
                  在此新建子文件夹
                </button>
              </div>
            )}
          </div>

          {/* 子收藏夹卡片 */}
          {childFolders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeUp">
              {childFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelect(f.id)}
                  className="group flex items-center gap-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-left hover:border-brand-300 hover:shadow-sm transition"
                >
                  <FolderIcon size={18} className="text-brand-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brand-900 dark:text-stone-100 truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-brand-400 dark:text-stone-500">
                      {f.blogCount ?? 0} 篇
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-brand-300 group-hover:text-brand-500 transition" />
                </button>
              ))}
            </div>
          )}

          {/* 视图切换（网格 / 列表） */}
          {folderBlogs.length > 0 && (
            <div className="flex items-center justify-end">
              <div className="flex p-1 bg-stone-100 dark:bg-stone-700 rounded-xl">
                <button
                  type="button"
                  aria-label="网格视图"
                  aria-pressed={blogView === 'grid'}
                  onClick={() => setBlogView('grid')}
                  className={cn(
                    'p-1.5 rounded-lg transition',
                    blogView === 'grid'
                      ? 'bg-white dark:bg-stone-900 text-brand-900 dark:text-stone-100 shadow-sm'
                      : 'text-brand-400 hover:text-brand-700',
                  )}
                >
                  <Grid2x2 size={14} />
                </button>
                <button
                  type="button"
                  aria-label="列表视图"
                  aria-pressed={blogView === 'list'}
                  onClick={() => setBlogView('list')}
                  className={cn(
                    'p-1.5 rounded-lg transition',
                    blogView === 'list'
                      ? 'bg-white dark:bg-stone-900 text-brand-900 dark:text-stone-100 shadow-sm'
                      : 'text-brand-400 hover:text-brand-700',
                  )}
                >
                  <ListIcon size={14} />
                </button>
              </div>
            </div>
          )}

          {/* 博客卡片 */}
          {folderBlogs.length > 0 ? (
            blogView === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fadeUp">
                {folderBlogs.map((b) => (
                  <div key={b.id} className="relative group">
                    <BlogCard
                      blog={b}
                      density="grid"
                      framework={templateMap.get(b.templateId ?? b.frameworkId ?? '') ?? undefined}
                    />
                    {b.folderId !== ROOT_FOLDER_ID && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBlog(b.id)}
                        title="移出此文件夹（变为未分类）"
                        aria-label={`将「${b.title}」移出此文件夹`}
                        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-events-none group-hover:pointer-events-auto flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-white/95 dark:bg-stone-800/95 border border-stone-200 dark:border-stone-600 text-brand-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition shadow-sm"
                      >
                        <X size={12} />
                        移出
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 animate-fadeUp">
                {folderBlogs.map((b) => (
                  <div key={b.id} className="relative group">
                    <BlogCard
                      blog={b}
                      density="list"
                      framework={templateMap.get(b.templateId ?? b.frameworkId ?? '') ?? undefined}
                    />
                    {b.folderId !== ROOT_FOLDER_ID && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBlog(b.id)}
                        title="移出此文件夹（变为未分类）"
                        aria-label={`将「${b.title}」移出此文件夹`}
                        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-events-none group-hover:pointer-events-auto flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-white/95 dark:bg-stone-800/95 border border-stone-200 dark:border-stone-600 text-brand-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition shadow-sm"
                      >
                        <X size={12} />
                        移出
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <EmptyState
              icon={Newspaper}
              title="这个文件夹还没有博客"
              description={
                childFolders.length > 0
                  ? '可点开上方子文件夹查看，或在博客编辑页把博客归入此处'
                  : '在博客编辑页的「文件夹」下拉里把它归入此处'
              }
              variant="compact"
            />
          )}
        </section>
      </div>

      {/* 「添加博客」抽屉 */}
      <AddBlogDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        currentFolderId={effectiveId}
        blogs={blogs ?? []}
        folders={folders ?? []}
        onAdd={handleAddBlog}
      />
    </div>
  );
}
