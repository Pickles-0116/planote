/**
 * useAIModelProfiles · 模型配置管理 Hook
 *
 * 封装 useAIModelStore 的常用操作，提供组件友好的接口。
 */

import { useCallback } from 'react';
import { useAIModelStore, maskApiKey } from '../stores/aiModelStore';
import { getAdapter } from '../adapters';
import type { AIProvider } from '@/types/domain';

export function useAIModelProfiles() {
  const store = useAIModelStore();

  const testConnection = useCallback(
    async (provider: AIProvider, apiKey: string, baseUrl?: string, model?: string) => {
      const adapter = getAdapter(provider);
      return adapter.testConnection(apiKey, baseUrl, model);
    },
    [],
  );

  const hasDefaultModel = store.profiles.some((p) => p.role === 'default');

  return {
    profiles: store.profiles,
    loading: store.loading,
    error: store.error,

    addProfile: store.addProfile,
    updateProfile: store.updateProfile,
    deleteProfile: store.deleteProfile,
    setDefault: store.setDefault,
    clearError: store.clearError,

    getDefaultProfile: store.getDefaultProfile,
    getProfile: store.getProfile,
    getDecodedApiKey: store.getDecodedApiKey,

    hasDefaultModel,
    testConnection,
    maskApiKey,
  };
}
