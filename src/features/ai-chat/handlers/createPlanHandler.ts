/**
 * createPlanHandler · 计划确认创建业务逻辑
 *
 * 来源：openspec/changes/ai-chat-create-content/design.md 决策 1。
 */

import type { NavigateFunction } from 'react-router-dom';
import { planRepo, itemRepo } from '@/db/repos';
import { useToastStore } from '@/stores/toastStore';
import { AppError } from '@/db/repos/types';
import type { PlanPreviewData } from '@/types/domain';

export interface PlanHandlerCtx {
  navigate: NavigateFunction;
  appendAssistantMessage: (text: string) => Promise<void>;
}

export async function handleCreatePlan(
  data: PlanPreviewData,
  ctx: PlanHandlerCtx,
): Promise<void> {
  // 校验必填
  if (!data.title?.trim()) {
    useToastStore.getState().push('error', 'AI 缺少必填字段：标题');
    return;
  }

  try {
    const created = await planRepo.create({
      title: data.title.trim(),
      description: data.description ?? '',
      level: data.level,
      timeDim: data.timeDim,
      status: 'todo',
      startDate: data.startDate,
      endDate: data.endDate,
      tagIds: [],
      itemIds: [],
      blogIds: [],
      childPlanIds: [],
    });

    // 依次创建事项
    if (data.items && data.items.length > 0) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        if (!item.title?.trim()) continue;
        await itemRepo.create(created.id, {
          title: item.title.trim(),
          description: item.description,
          status: 'todo',
          checked: false,
          order: i,
          dueDate: undefined,
        });
      }
      // 重算 progress + itemIds
      await planRepo.recomputeProgress(created.id);
    }

    await ctx.appendAssistantMessage(
      `已为你创建计划「${created.title}」，[查看详情](/plans/${created.id})`,
    );
    useToastStore.getState().push('success', `已创建计划「${created.title}」`);
    ctx.navigate(`/plans/${created.id}`);
  } catch (e) {
    const msg = e instanceof AppError ? e.message : (e instanceof Error ? e.message : '创建失败');
    useToastStore.getState().push('error', msg);
  }
}