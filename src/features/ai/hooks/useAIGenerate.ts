/**
 * useAIGenerate · AI 生成主 Hook（流式）
 *
 * 封装流式生成的完整生命周期：
 * - 组装 Prompt
 * - 调用 Provider Adapter
 * - 累积文本 + 周期性更新到编辑器
 * - 统计 token 使用
 * - 处理错误和取消
 */

import { useState, useCallback, useRef } from 'react';
import { getAdapter } from '../adapters';
import type { ChatMessage, StreamUsage } from '../adapters';
import { useAIModelStore } from '../stores/aiModelStore';
import { useAIStatsStore } from '../stores/aiStatsStore';
import type { AIGenerateMode } from '@/types/domain';

export type GenerateStatus = 'idle' | 'generating' | 'done' | 'error' | 'cancelled';

export interface UseAIGenerateReturn {
  status: GenerateStatus;
  /** 累积的完整 Markdown 文本。 */
  generatedText: string;
  errorMessage: string | null;
  /** 生成耗时（毫秒）。 */
  durationMs: number;
  /** 流式生成的 token 统计。 */
  usage: StreamUsage | null;
  /** 触发生成。 */
  generate: (messages: ChatMessage[]) => Promise<string>;
  /** 取消生成。 */
  cancel: () => void;
  /** 重置状态。 */
  reset: () => void;
}

export function useAIGenerate(mode: AIGenerateMode): UseAIGenerateReturn {
  const [status, setStatus] = useState<GenerateStatus>('idle');
  const [generatedText, setGeneratedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [usage, setUsage] = useState<StreamUsage | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const store = useAIModelStore();
  const logCall = useAIStatsStore((s) => s.logCall);

  const generate = useCallback(
    async (messages: ChatMessage[]): Promise<string> => {
      const profile = store.getDefaultProfile();
      if (!profile) {
        setStatus('error');
        setErrorMessage('请先在设置中配置 AI 模型');
        return '';
      }

      const apiKey = store.getDecodedApiKey(profile.id);
      const adapter = getAdapter(profile.provider);
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('generating');
      setGeneratedText('');
      setErrorMessage(null);
      setUsage(null);

      const startTime = performance.now();
      let accumulated = '';
      let finalUsage: StreamUsage | undefined;

      try {
        const stream = adapter.generateStream(
          messages,
          {
            temperature: profile.temperature,
            maxTokens: profile.maxTokens,
            model: profile.model,
            signal: controller.signal,
          },
          apiKey,
          profile.baseUrl,
        );

        while (true) {
          const result = await stream.next();
          if (result.done) {
            if (result.value && typeof result.value === 'object' && 'promptTokens' in result.value) {
              finalUsage = result.value;
            }
            break;
          }
          if (typeof result.value === 'string') {
            accumulated += result.value;
            setGeneratedText(accumulated);
          }
        }

        const elapsed = Math.round(performance.now() - startTime);
        setDurationMs(elapsed);

        if (finalUsage) {
          setUsage(finalUsage);
        }

        setStatus('done');

        // 记录调用日志
        logCall({
          modelProfileId: profile.id,
          mode,
          promptTokens: finalUsage?.promptTokens ?? 0,
          completionTokens: finalUsage?.completionTokens ?? 0,
          durationMs: elapsed,
          success: true,
        });

        return accumulated;
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        setDurationMs(elapsed);

        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus('cancelled');
          logCall({
            modelProfileId: profile.id,
            mode,
            promptTokens: 0,
            completionTokens: 0,
            durationMs: elapsed,
            success: false,
            errorCode: 'CANCELLED',
          });
          return accumulated;
        }

        const msg = err instanceof Error ? err.message : '生成失败，请重试';
        setStatus('error');
        setErrorMessage(msg);

        logCall({
          modelProfileId: profile.id,
          mode,
          promptTokens: 0,
          completionTokens: 0,
          durationMs: elapsed,
          success: false,
          errorCode: 'API_ERROR',
        });

        return accumulated;
      } finally {
        abortRef.current = null;
      }
    },
    [store, mode, logCall],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setGeneratedText('');
    setErrorMessage(null);
    setDurationMs(0);
    setUsage(null);
  }, []);

  return { status, generatedText, errorMessage, durationMs, usage, generate, cancel, reset };
}
