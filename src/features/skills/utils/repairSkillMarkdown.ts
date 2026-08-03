/**
 * repairSkillMarkdown.ts · D2
 *
 * 调默认 AI 模型把非标准 skill markdown 改写成 Planote 可导入的标准格式。
 * 纯函数（非 React），组件或测试均可直接调用。
 *
 * 复用 ai-chat 的 adapter 调用范式（与 useAIChat 一致）：
 *   useAIModelStore.getState().getDefaultProfile() + getDecodedApiKey()
 *   → getAdapter(profile.provider).generateStream(messages, opts, apiKey, baseUrl)
 */

import { getAdapter } from '@/features/ai/adapters';
import { useAIModelStore } from '@/features/ai/stores/aiModelStore';
import type { ChatMessage } from '@/features/ai/adapters';
import { splitThinking } from '@/features/ai-chat/utils/thinkingExtractor';
import { SKILL_REPAIR_SYSTEM_PROMPT, buildSkillRepairUserPrompt } from '../prompts/skillRepairPrompt';

export interface RepairSkillParams {
  rawText: string;
  errorMessage: string;
  fileName?: string;
  signal?: AbortSignal;
}

/** 调 AI 修复 markdown，返回剥离思考标签、去掉代码围栏后的标准 skill markdown 文本。 */
export async function repairSkillMarkdown({
  rawText,
  errorMessage,
  fileName,
  signal,
}: RepairSkillParams): Promise<string> {
  const { getDefaultProfile, getDecodedApiKey } = useAIModelStore.getState();
  const profile = getDefaultProfile();
  if (!profile) {
    throw new Error('未配置 AI 模型，无法使用 AI 修复。请先在「设置 → AI 模型」中添加模型。');
  }
  const apiKey = getDecodedApiKey(profile.id);
  const adapter = getAdapter(profile.provider);

  const messages: ChatMessage[] = [
    { role: 'system', content: SKILL_REPAIR_SYSTEM_PROMPT },
    { role: 'user', content: buildSkillRepairUserPrompt({ rawText, errorMessage, fileName }) },
  ];

  let acc = '';
  const stream = adapter.generateStream(
    messages,
    {
      temperature: 0.2,
      maxTokens: profile.maxTokens,
      model: profile.model,
      signal,
    },
    apiKey,
    profile.baseUrl,
  );

  while (true) {
    const r = await stream.next();
    if (r.done) break;
    if (typeof r.value === 'string') acc += r.value;
  }

  // 先剥离 <think>/<thinking> 思考内容，再去围栏：
  // 思考段常出现在围栏之前，先剥离才能让围栏正则命中。
  const body = splitThinking(acc).content;
  const result = splitThinking(stripCodeFence(body)).content.trim();
  if (result === '') {
    throw new Error('AI 整理结果为空，请手动编辑或重试');
  }
  return result;
}

/** 去掉 AI 可能包裹的 ```markdown ... ``` 或 ```...``` 围栏。 */
function stripCodeFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return m ? m[1].trim() : t;
}
