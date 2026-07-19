/**
 * useFrameworks - 订阅全部 Framework 模板的实时数据
 *
 * v1.0 4 套内置 + 二次启动跳过种子（由 meta.seeded 幂等保证）。
 *
 * @returns Framework[]；首次渲染返回 undefined
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { frameworkRepo } from '@/db/repos';
import type { Framework } from '@/types/domain';

export function useFrameworks(): Framework[] | undefined {
  return useLiveQuery(async () => await frameworkRepo.list(), []);
}
