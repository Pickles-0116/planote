/**
 * createBlogHandler · 博客保存草稿 / 在编辑器中打开
 *
 * 来源：openspec/changes/ai-chat-create-content/design.md 决策 3。
 */

import type { NavigateFunction } from 'react-router-dom';
import { blogRepo } from '@/db/repos';
import { useToastStore } from '@/stores/toastStore';
import { AppError } from '@/db/repos/types';
import { markdownToTiptapJSON } from '@/features/blog/utils/markdownToTiptap';
import type { BlogPreviewData } from '@/types/domain';

export interface BlogHandlerCtx {
  navigate: NavigateFunction;
  appendAssistantMessage: (text: string) => Promise<void>;
}

/** 从 Tiptap JSON 提取纯文本（与 BlogRepo.extractText 同算法）。 */
function extractTextFromTiptap(node: { type: string; text?: string; content?: unknown[] } | undefined): string {
  if (!node) return '';
  const parts: string[] = [];
  const walk = (n: typeof node): void => {
    if (typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child as typeof node);
    }
  };
  walk(node);
  return parts.join(' ').trim();
}

export async function handleSaveBlogDraft(
  data: BlogPreviewData,
  ctx: BlogHandlerCtx,
): Promise<void> {
  if (!data.title?.trim()) {
    useToastStore.getState().push('error', 'AI 缺少必填字段：标题');
    return;
  }

  try {
    const tiptap = markdownToTiptapJSON(data.content ?? '');
    const contentText = extractTextFromTiptap(tiptap);

    const created = await blogRepo.create({
      title: data.title.trim(),
      content: tiptap,
      excerpt: '',
      tagIds: [],
      attachmentIds: [],
      status: 'draft',
      source: 'direct',
      templateId: data.templateId,
      contentText,
    });

    await ctx.appendAssistantMessage(
      `已为你保存博客草稿「${created.title}」，[查看详情](/blogs/${created.id})`,
    );
    useToastStore.getState().push('success', `已保存草稿「${created.title}」`);
    ctx.navigate(`/blogs/${created.id}`);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : (e instanceof Error ? e.message : '保存失败');
    useToastStore.getState().push('error', msg);
  }
}

export function handleOpenInBlogEditor(
  data: BlogPreviewData,
  navigate: NavigateFunction,
): void {
  const tiptap = markdownToTiptapJSON(data.content ?? '');
  navigate('/blogs/new', {
    state: {
      prefilledTitle: data.title,
      prefilledContent: tiptap,
    },
  });
}