/**
 * AI 模型配置 Zustand Store
 *
 * 模型配置（API Key 等）存储在 localStorage 中（planote-ai-models key）。
 * 业务 store 不持有模型列表实体——实体通过 useAIModelProfiles hook 从 localStorage 读取。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ID, AIModelProfile, ISODate } from '@/types/domain';
import { newId } from '@/lib/id';

const nowISO = (): ISODate => new Date().toISOString();

/** API Key 简单编码（base64，非加密但避免明文暴露）。 */
const encodeKey = (key: string): string => btoa(unescape(encodeURIComponent(key)));
const decodeKey = (encoded: string): string => {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
};

/** 掩码显示 API Key。 */
export function maskApiKey(key: string): string {
  const decoded = decodeKey(key);
  if (decoded.length <= 8) return '****';
  return `${decoded.slice(0, 4)}****${decoded.slice(-4)}`;
}

export interface AIModelStoreState {
  /** 模型配置列表（从 localStorage 恢复）。 */
  profiles: AIModelProfile[];
  loading: boolean;
  error: string | null;

  addProfile: (input: Omit<AIModelProfile, 'id' | 'createdAt' | 'updatedAt' | 'apiKey'> & { apiKey: string }) => AIModelProfile;
  updateProfile: (id: ID, patch: Partial<AIModelProfile>) => void;
  deleteProfile: (id: ID) => void;
  setDefault: (id: ID) => void;
  getDefaultProfile: () => AIModelProfile | undefined;
  getProfile: (id: ID) => AIModelProfile | undefined;
  getDecodedApiKey: (id: ID) => string;
  clearError: () => void;
}

export const useAIModelStore = create<AIModelStoreState>()(
  persist(
    (set, get) => ({
      profiles: [],
      loading: false,
      error: null,

      addProfile: (input) => {
        const now = nowISO();
        const profile: AIModelProfile = {
          ...input,
          id: newId(),
          apiKey: encodeKey(input.apiKey),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return profile;
      },

      updateProfile: (id, patch) => {
        set((s) => ({
          profiles: s.profiles.map((p) => {
            if (p.id !== id) return p;
            const updated = { ...p, ...patch, id, updatedAt: nowISO() };
            // 如果更新了 apiKey，重新编码
            if (patch.apiKey !== undefined) {
              updated.apiKey = encodeKey(patch.apiKey);
            }
            return updated;
          }),
        }));
      },

      deleteProfile: (id) => {
        const { profiles } = get();
        if (profiles.length <= 1) {
          set({ error: '至少保留一个模型配置' });
          return;
        }
        const target = profiles.find((p) => p.id === id);
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
        }));
        // 如果删除的是默认模型，将第一个备用设为默认
        if (target?.role === 'default') {
          const remaining = get().profiles;
          if (remaining.length > 0) {
            set((s) => ({
              profiles: s.profiles.map((p, i) =>
                i === 0 ? { ...p, role: 'default' as const } : p,
              ),
            }));
          }
        }
      },

      setDefault: (id) => {
        set((s) => ({
          profiles: s.profiles.map((p) => ({
            ...p,
            role: p.id === id ? ('default' as const) : ('backup' as const),
          })),
        }));
      },

      getDefaultProfile: () => {
        return get().profiles.find((p) => p.role === 'default');
      },

      getProfile: (id) => {
        return get().profiles.find((p) => p.id === id);
      },

      getDecodedApiKey: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return '';
        return decodeKey(profile.apiKey);
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'planote-ai-models',
      partialize: (state) => ({ profiles: state.profiles }),
    },
  ),
);
