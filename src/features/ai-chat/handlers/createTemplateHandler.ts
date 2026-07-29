/**
 * createTemplateHandler · 模板确认创建业务逻辑
 *
 * 来源：openspec/changes/ai-chat-create-content/design.md。
 */

import type { NavigateFunction } from 'react-router-dom';
import { blogTemplateRepo } from '@/db/repos';
import { useToastStore } from '@/stores/toastStore';
import { AppError } from '@/db/repos/types';
import type { TemplatePreviewData } from '@/types/domain';

export interface TemplateHandlerCtx {
  navigate: NavigateFunction;
  appendAssistantMessage: (text: string) => Promise<void>;
}

const DEFAULT_AI_PARAMS = {
  style: 'professional' as const,
  tone: 'neutral' as const,
  audience: 'self' as const,
  minWords: 300,
  maxWords: 800,
};

export async function handleCreateTemplate(
  data: TemplatePreviewData,
  ctx: TemplateHandlerCtx,
): Promise<void> {
  if (!data.name?.trim()) {
    useToastStore.getState().push('error', 'AI 缺少必填字段：名称');
    return;
  }

  try {
    const created = await blogTemplateRepo.create({
      name: data.name.trim(),
      description: data.description ?? '',
      category: data.category,
      icon: 'FileType',
      sections: data.sections ?? [],
      aiParams: { ...DEFAULT_AI_PARAMS, ...(data.aiParams ?? {}) },
      tagIds: [],
      builtin: false,
    });

    await ctx.appendAssistantMessage(
      `已为你保存模板「${created.name}」，[在编辑器中打开](/templates/${created.id}/edit)`,
    );
    useToastStore.getState().push('success', `已保存模板「${created.name}」`);
    ctx.navigate(`/templates/${created.id}/edit`);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : (e instanceof Error ? e.message : '保存失败');
    useToastStore.getState().push('error', msg);
  }
}