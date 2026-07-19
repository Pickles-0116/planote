/**
 * usePlans - 订阅全部 Plans 列表的实时数据
 *
 * 默认按 `createdAt desc` 排序（见 PlanRepo.list 实现）。
 *
 * @returns Plan[]；首次渲染返回 undefined（IndexedDB 异步打开）
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { planRepo } from '@/db/repos';
import type { Plan } from '@/types/domain';

export function usePlans(): Plan[] | undefined {
  return useLiveQuery(async () => await planRepo.list(), []);
}
