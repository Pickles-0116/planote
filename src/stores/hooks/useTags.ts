/**
 * useTags - 订阅全部 Tag 列表的实时数据
 *
 * 按 `usageCount desc` 排序（见 TagRepo.list 实现）。
 *
 * @returns Tag[]；首次渲染返回 undefined
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { tagRepo } from '@/db/repos';
import type { Tag } from '@/types/domain';

export function useTags(): Tag[] | undefined {
  return useLiveQuery(async () => await tagRepo.list(), []);
}
