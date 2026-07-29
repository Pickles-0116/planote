/**
 * useTemplates · 博客模板列表 Hook（useLiveQuery）
 *
 * 从 IndexedDB 实时读取模板列表，支持分类筛选和搜索。
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { blogTemplateRepo } from '@/db/repos';
import type { TemplateCategory } from '@/types/domain';

/** 获取所有模板列表（按 updatedAt 降序）。 */
export function useTemplates(category?: TemplateCategory, searchQuery?: string) {
  const templates = useLiveQuery(
    async () => {
      if (searchQuery && searchQuery.trim()) {
        return blogTemplateRepo.search(searchQuery.trim());
      }
      if (category && category !== 'custom') {
        // 'custom' 作为筛选时只匹配 category === 'custom'
        return blogTemplateRepo.listByCategory(category);
      }
      return blogTemplateRepo.list();
    },
    [category, searchQuery],
    [],
  );

  return templates;
}

/** 获取单个模板。 */
export function useTemplate(id: string | undefined) {
  const template = useLiveQuery(
    async () => {
      if (!id) return undefined;
      return blogTemplateRepo.get(id);
    },
    [id],
    undefined,
  );

  return template;
}
