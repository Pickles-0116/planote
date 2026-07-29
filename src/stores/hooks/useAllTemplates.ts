/**
 * useAllTemplates - 订阅全部 BlogTemplate 的实时数据
 *
 * v1.4-Unify：替代 useFrameworks()，从 blogTemplates 表读取。
 * 用于博客编辑器的模板选择器。
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { blogTemplateRepo } from '@/db/repos';
import type { BlogTemplate } from '@/types/domain';

/** 获取所有模板列表（按 useCount 降序，常用优先）。 */
export function useAllTemplates(): BlogTemplate[] | undefined {
  return useLiveQuery(
    async () => {
      const all = await blogTemplateRepo.list();
      return all.sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0));
    },
    [],
  );
}
