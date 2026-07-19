/**
 * useFrameworkDrawer - 框架库抽屉内的状态机（add-framework-drawer 增量）
 *
 * 暴露：
 * - query / setQuery：搜索框（不区分大小写，匹配 name / section.heading / description）
 * - selectedTags / toggleTag：多选 tag（OR 关系）
 * - selectedId / selectFramework：单选框架
 * - filtered：应用 query + tag 后的预置列表
 * - selected：当前选中的预置（来自 filtered）
 * - clearFilters：清空 query + selectedTags
 * - hasFilters：是否处于筛选状态
 *
 * 为什么不放全局 store：
 * - query / selectedTags / selected 是抽屉打开期间的临时态
 * - 关闭后无意义；用 useState 管，不污染其他页面
 *
 * 性能：10 条数据 useMemo 过滤 < 0.1ms，无需虚拟化。
 */

import { useCallback, useMemo, useState } from 'react';
import type { ID } from '@/types/domain';
import {
  FRAMEWORK_PRESETS,
  type PresetFramework,
} from '@/features/framework/data/presets';

export interface UseFrameworkDrawerResult {
  query: string;
  setQuery: (q: string) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  selectedId: ID | null;
  selectFramework: (id: ID | null) => void;
  filtered: PresetFramework[];
  selected: PresetFramework | null;
  clearFilters: () => void;
  hasFilters: boolean;
}

export function useFrameworkDrawer(): UseFrameworkDrawerResult {
  const [query, setQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<ID | null>(null);

  const toggleTag = useCallback((tag: string): void => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const selectFramework = useCallback((id: ID | null): void => {
    setSelectedId(id);
  }, []);

  const clearFilters = useCallback((): void => {
    setQuery('');
    setSelectedTags([]);
  }, []);

  const hasFilters = query.trim() !== '' || selectedTags.length > 0;

  // 过滤：先 tag OR，再 query 包含
  const filtered = useMemo<PresetFramework[]>(() => {
    const needle = query.trim().toLowerCase();
    return FRAMEWORK_PRESETS.filter((fw) => {
      // 1) tag OR 过滤
      if (selectedTags.length > 0) {
        const hit = selectedTags.some((t) => fw.tags.includes(t));
        if (!hit) return false;
      }
      // 2) query 包含过滤（任一字段命中即通过）
      if (needle !== '') {
        const inName = fw.name.toLowerCase().includes(needle);
        const inDesc = fw.description.toLowerCase().includes(needle);
        const inSections = fw.sections.some((s) =>
          s.heading.toLowerCase().includes(needle),
        );
        if (!inName && !inDesc && !inSections) return false;
      }
      return true;
    });
  }, [query, selectedTags]);

  // 选中实例（从 filtered 中找，filtered 外的不算"当前可见选中"）
  const selected = useMemo<PresetFramework | null>(() => {
    if (!selectedId) return null;
    return filtered.find((f) => f.id === selectedId) ?? null;
  }, [filtered, selectedId]);

  return {
    query,
    setQuery,
    selectedTags,
    toggleTag,
    selectedId,
    selectFramework,
    filtered,
    selected,
    clearFilters,
    hasFilters,
  };
}
