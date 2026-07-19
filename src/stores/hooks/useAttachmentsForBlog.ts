/**
 * useAttachmentsForBlog - 订阅某博客下所有附件的实时数据
 *
 * 按 `uploadedAt asc` 排序。
 *
 * @param blogId 博客 ID；传 `null` / `undefined` 不订阅（返回 undefined）
 * @returns Attachment[]；首次渲染返回 undefined
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { attachmentRepo } from '@/db/repos';
import type { ID, Attachment } from '@/types/domain';

export function useAttachmentsForBlog(
  blogId: ID | null | undefined,
): Attachment[] | undefined {
  return useLiveQuery(
    async () => (blogId ? await attachmentRepo.listByBlog(blogId) : []),
    [blogId],
  );
}
