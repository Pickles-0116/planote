/**
 * FolderPicker - 文件夹选择下拉（V1.2 F3/F4）
 *
 * 用于：
 * - BlogEdit：选择博客所属文件夹
 * - BlogList 筛选条：快速切换「全部文件夹 / 某文件夹」
 *
 * 渲染：按 depth → order 排序，按 depth 缩进展示层级。
 * 根文件夹固定展示为「未分类」（ROOT_FOLDER_NAME）。
 *
 * 修复点（2024-06 文件夹选择器「点了没反应」）：
 * - **永远先渲染一个「未分类」根选项**（value = `ROOT_FOLDER_ID`）。
 *   首帧 `folders` 为空 / DEXIE 尚未返回根文件夹时，下拉框依然有可选项，
 *   能够正常展开、选中，且选中值可正确落入 `blog.folderId`。
 * - 其余非根文件夹在 folders 加载完成后自动补充到根选项之后。
 */

import { Folder as FolderIcon } from 'lucide-react';
import type { Folder, ID } from '@/types/domain';
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from '@/features/folders/constants';
import { cn } from '@/lib/utils';

interface Props {
  value: ID;
  onChange: (id: ID) => void;
  folders: Folder[];
  className?: string;
  /** select 的 id（用于 <label htmlFor> 关联）。 */
  id?: string;
}

export default function FolderPicker({ value, onChange, folders, className, id }: Props) {
  // 根选项始终渲染；其余非根文件夹按 depth → order 排序后补充。
  const ordered = [...folders]
    .filter((f) => f.id !== ROOT_FOLDER_ID)
    .sort((a, b) => a.depth - b.depth || a.order - b.order);

  return (
    <div className={cn('relative', className)}>
      <FolderIcon
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 dark:text-stone-500 pointer-events-none"
      />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="选择文件夹"
        className={cn(
          'pl-7 pr-3 py-1.5 rounded-lg text-xs border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-brand-700 dark:text-stone-200',
          'hover:border-brand-300 dark:hover:border-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-500',
        )}
      >
        {/* 永远先渲染「未分类」根选项：保证首帧可展开 / 可选中 / 选中值可落库 */}
        <option key={ROOT_FOLDER_ID} value={ROOT_FOLDER_ID}>
          {ROOT_FOLDER_NAME}
        </option>
        {ordered.map((f) => (
          <option key={f.id} value={f.id}>
            {'  '.repeat(f.depth) + f.name}
          </option>
        ))}
      </select>
    </div>
  );
}
