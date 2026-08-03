/**
 * useFolders - 文件夹实时订阅 hook（V1.2 F1/F2/F4）
 *
 * 提供：
 * - `useFolders`：liveQuery 订阅全部文件夹（按 depth → order 排序）
 * - `toFolderMap`：folderId → Folder 映射（面包屑 / 路径计算用）
 * - `buildFolderTree`：构建树结构（root → 主 → 日期），供 FolderTree 递归渲染
 *
 * 文件夹数据仅通过 `folderRepo` 访问（架构约束：features 禁止直连 db）。
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { folderRepo } from '@/db/repos';
import { useBlogs } from '@/stores/hooks/useBlogs';
import type { Folder, ID } from '@/types/domain';

/** 订阅全部文件夹（按 depth → order 排序）。首帧返回 undefined。 */
export function useFolders(): Folder[] | undefined {
  return useLiveQuery<Folder[]>(() => folderRepo.list(), []);
}

/**
 * 派生 folderId → 直属博客数 的实时映射（V1.2-fix：取代 `Folder.blogCount` 缓存）。
 *
 * 侧边栏 / 文件夹树节点上的博客计数以前读 `folders.blogCount` 缓存字段，
 * 该字段由 `FolderRepo.bumpBlogCount` 在每个写博客入口手动维护，
 * 漏一处即失真（如 AI Chat 保存草稿、撤销栈、历史迁移）。现改为订阅 `blogs`
 * 表实时聚合，**从源头消除缓存与真实必须保持一致的隐性约束**。
 *
 * 口径：`blog.folderId === folder.id` 计为该文件夹的直属博客（与 `Folders.tsx`
 * 里 `folderBlogs = blogs.filter(b => b.folderId === id)` 完全一致，不含子文件夹）。
 *
 * @returns 首帧 blogs 未就绪时返回 undefined —— 调用方回退读缓存字段，避免闪 0。
 */
export function useFolderBlogCountMap(): Map<ID, number> | undefined {
  const blogs = useBlogs();
  return useMemo(() => {
    if (!blogs) return undefined;
    const m = new Map<ID, number>();
    for (const b of blogs) {
      const key = b.folderId ?? '';
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [blogs]);
}

/** folderId → Folder 映射。 */
export function toFolderMap(folders: Folder[] | undefined): Map<ID, Folder> {
  const m = new Map<ID, Folder>();
  if (folders) {
    for (const f of folders) m.set(f.id, f);
  }
  return m;
}

/** 带子节点的文件夹树节点。 */
export interface FolderNode extends Folder {
  children: FolderNode[];
}

/**
 * 由扁平文件夹列表构建树（root.parentId === '' 为根）。
 * 每个节点按 order 升序；深度深的在父节点 children 中。
 *
 * @param blogCountMap 可选：由 `useFolderBlogCountMap` 派生的实时计数映射。
 *   传入时节点 `blogCount` 以实时值为准（缓存失真自动回正）；不传则回退读
 *   `folder.blogCount` 缓存字段（用于 blogs 尚未就绪的首帧，避免闪 0）。
 */
export function buildFolderTree(
  folders: Folder[],
  blogCountMap?: Map<ID, number>,
): FolderNode[] {
  const nodes = new Map<ID, FolderNode>();
  for (const f of folders) {
    const node: FolderNode = { ...f, children: [] };
    if (blogCountMap) {
      node.blogCount = blogCountMap.get(f.id) ?? 0;
    }
    nodes.set(f.id, node);
  }

  const roots: FolderNode[] = [];
  for (const f of folders) {
    const node = nodes.get(f.id);
    if (!node) continue;
    if (!f.parentId) {
      // parentId 为空 → 根节点（如未分类 ROOT_FOLDER_ID）
      roots.push(node);
    } else {
      const parent = nodes.get(f.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点缺失的孤儿节点，降级为根节点展示
        roots.push(node);
      }
    }
  }

  const sortRec = (arr: FolderNode[]): void => {
    arr.sort((a, b) => a.order - b.order);
    for (const n of arr) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * 由 folderId 计算从 root 到自身的路径（含自身），用于面包屑。
 * @param folderId 目标文件夹 ID（空串 / ROOT_FOLDER_ID 返回空数组）
 * @param folderMap folderId → Folder 映射
 */
export function getFolderPath(
  folderId: ID,
  folderMap: Map<ID, Folder>,
): Folder[] {
  const path: Folder[] = [];
  const guard = new Set<ID>();
  let current: Folder | undefined = folderMap.get(folderId);
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    path.unshift(current);
    if (!current.parentId) break;
    current = folderMap.get(current.parentId);
  }
  return path;
}
