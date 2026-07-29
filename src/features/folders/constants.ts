/**
 * 文件夹模块常量
 *
 * V1.2 F1/F2/F3/F4 统一引用，集中管理避免散落硬编码。
 */

import type { FolderType } from '@/types/domain';

/** 根文件夹固定 ID（代表「未分类」）。所有博客 folderId 永不为 null，缺省即此值。 */
export const ROOT_FOLDER_ID = 'folder-root';

/** 根文件夹展示名。 */
export const ROOT_FOLDER_NAME = '未分类';

/**
 * 文件夹树深度上限（含 root）。
 * - 0 = root（未分类）
 * - 1 = 主文件夹
 * - 2 = 日期子文件夹
 * 因此允许的最大层级数为 2（root → 主 → 日期）。
 */
export const FOLDER_TREE_DEPTH_LIMIT = 2;

/** 文件夹类型顺序（用于排序与 UI 分组）。 */
export const FOLDER_TYPE_ORDER: FolderType[] = ['root', 'main', 'date'];
