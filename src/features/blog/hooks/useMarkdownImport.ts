/**
 * useMarkdownImport · v1.1 增量
 *
 * 弹文件选择 → 解析 Markdown → 创建 blog → 跳编辑页。
 *
 * 失败处理：
 * - 文件 > 1MB → toast error
 * - 扩展名非 .md/.markdown/.txt → toast error
 * - 解析异常 → toast error
 * 任何失败都不创建空 blog。
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlogStore, useToastStore } from '@/stores';
import { extractPlainText } from '@/features/blog/utils/extractPlainText';
import {
  markdownToTiptapJSON,
  extractTitle,
  extractExcerpt,
} from '@/features/blog/utils/markdownToTiptap';

const MAX_SIZE = 1_000_000; // 1MB
const ALLOWED_EXT = /\.(md|markdown|txt)$/i;

export function useMarkdownImport() {
  const createBlog = useBlogStore((s) => s.createBlog);
  const navigate = useNavigate();
  const push = useToastStore((s) => s.push);

  return useCallback(
    async (file: File) => {
      // 1. 大小校验
      if (file.size > MAX_SIZE) {
        push('error', `文件超过 1MB（${(file.size / 1_000_000).toFixed(1)}MB），请精简后再导入`);
        return;
      }

      // 2. 扩展名校验
      if (!ALLOWED_EXT.test(file.name)) {
        push('error', `不支持的文件格式「${file.name}」，仅支持 .md / .markdown / .txt`);
        return;
      }

      // 3. 读取 + 解析
      let markdown: string;
      try {
        markdown = await file.text();
      } catch (err) {
        push('error', `读取文件失败：${(err as Error).message}`);
        return;
      }

      if (!markdown.trim()) {
        push('error', '文件内容为空');
        return;
      }

      // 4. Markdown → TiptapJSON
      let content;
      let contentText = '';
      try {
        content = markdownToTiptapJSON(markdown);
        contentText = extractPlainText(content);
      } catch (err) {
        push('error', `Markdown 解析失败：${(err as Error).message}`);
        return;
      }

      // 5. 创建 blog
      const title = extractTitle(markdown, file.name);
      const excerpt = extractExcerpt(markdown);
      let blog;
      try {
        blog = await createBlog({
          title,
          content,
          contentText,
          excerpt,
          status: 'draft',
          tagIds: [],
          attachmentIds: [],
          source: 'direct',
        });
      } catch (err) {
        push('error', `创建博客失败：${(err as Error).message}`);
        return;
      }

      // 6. 跳转编辑页
      push('success', `已导入「${title}」，共 ${contentText.length} 字`);
      navigate(`/blogs/${blog.id}/edit`);
    },
    [createBlog, navigate, push],
  );
}
