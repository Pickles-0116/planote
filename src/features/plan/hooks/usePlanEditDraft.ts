/**
 * usePlanEditDraft - 计划编辑表单草稿 hook
 *
 * 持有完整的 FormState + 500ms debounce 写 localStorage。
 *
 * 设计要点（design.md §2.3）：
 * - localStorage key 含 planId（`planote:plan-edit:draft:<planId|none>`）
 * - create 模式 planId=null → key `planote:plan-edit:draft:none`
 * - edit 模式 planId='01H...' → key `planote:plan-edit:draft:01H...`
 * - edit 模式 + 草稿 ID 不匹配 → 忽略草稿，从 plan store 预填
 * - dirty 自动维护（与 initialState 对比）
 * - 草稿 quota 超限：try/catch 静默
 *
 * 暴露 API：
 *   state      FormState 当前完整表单
 *   setState   (updater: FormState | ((s: FormState) => FormState)) => void
 *   clearDraft 清 localStorage（提交成功后调用）
 *   dirty      boolean（state vs initialState 差异）
 *   markClean  显式标记为干净（不常使用）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ID, PlanLevel, PlanTimeDim, ISODate } from '@/types/domain';

// ========== 表单状态类型 ==========

/** 事项的草稿形态（id 可选，新建时无；编辑模式有）。 */
export interface DraftItem {
  /** 已存在的事项 ID（编辑模式从 plan 取）；新建时 undefined */
  id?: ID;
  /**
   * 与 `id` 同义但语义更显式：edit 模式从 `useItemsForPlan` 拉到的已有项。
   * Step3Items 用它显示「已存在」徽章；usePlanEditSubmit 用它算 toUpdate / toDelete。
   * 取名沿用 design.md / spec.md 里的 `existingId`。
   */
  existingId?: ID;
  title: string;
  dueDate?: ISODate;
  /** edit 模式从已有项同步；create 模式不出现。用于 diff 判定。 */
  status?: 'todo' | 'doing' | 'done';
}

export interface DraftFormState {
  step: 1 | 2 | 3;
  // 步骤 1
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  // 步骤 2
  level: PlanLevel | null;
  timeDim: PlanTimeDim | null;
  parentPlanId: ID | null;
  // 步骤 3
  items: DraftItem[];
  // 标签（v1.0 简化为字符串数组）
  tags: string[];
  // 高级选项
  autoGenBlog: boolean;
  dailyReminder: boolean;
  /** 草稿元信息 */
  meta: {
    /** 当前 planId（create 模式 = null）。用于校验草稿归属 */
    planId: ID | null;
  };
}

/** create 模式空表单初始状态工厂。 */
export function createInitialDraft(planId: ID | null = null): DraftFormState {
  return {
    step: 1,
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    level: null,
    timeDim: null,
    parentPlanId: null,
    items: [],
    tags: [],
    autoGenBlog: true,
    dailyReminder: false,
    meta: { planId },
  };
}

// ========== localStorage 持久化 ==========

const DRAFT_PREFIX = 'planote:plan-edit:draft:';
const draftKey = (planId: ID | null): string =>
  `${DRAFT_PREFIX}${planId ?? 'none'}`;

/**
 * 加载草稿。
 * - key 不存在 → null
 * - JSON 解析失败 → null（静默兜底）
 * - planId 不匹配 → null（异常情况，忽略草稿）
 */
function loadDraftFromStorage(planId: ID | null): DraftFormState | null {
  try {
    const raw = localStorage.getItem(draftKey(planId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftFormState;
    // 校验草稿归属
    if (parsed.meta?.planId !== planId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDraftToStorage(state: DraftFormState): void {
  try {
    localStorage.setItem(draftKey(state.meta.planId), JSON.stringify(state));
  } catch {
    // quota exceeded / 隐私模式 - 静默失败
  }
}

function clearDraftInStorage(planId: ID | null): void {
  try {
    localStorage.removeItem(draftKey(planId));
  } catch {
    /* noop */
  }
}

// ========== hook 实现 ==========

interface UsePlanEditDraftOptions {
  /** planId（create 模式 = null）。决定草稿 key + 草稿归属校验。 */
  planId: ID | null;
  /** 可选：用 plan store 数据预填（edit 模式用）。 */
  prefilled?: Partial<DraftFormState>;
}

export interface UsePlanEditDraftReturn {
  state: DraftFormState;
  setState: (updater: DraftFormState | ((s: DraftFormState) => DraftFormState)) => void;
  clearDraft: () => void;
  dirty: boolean;
}

export function usePlanEditDraft({
  planId,
  prefilled,
}: UsePlanEditDraftOptions): UsePlanEditDraftReturn {
  // 初始 state：优先用 prefilled（来自 plan store），其次草稿，最后空白
  const initial = useRef<DraftFormState | null>(null);
  if (initial.current === null) {
    const blank = createInitialDraft(planId);
    if (prefilled && Object.keys(prefilled).length > 0) {
      initial.current = {
        ...blank,
        ...prefilled,
        meta: { ...blank.meta, ...(prefilled.meta ?? {}) },
      };
    } else {
      const draft = loadDraftFromStorage(planId);
      initial.current = draft ?? blank;
    }
  }

  const [state, setStateInternal] = useState<DraftFormState>(initial.current);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPlanIdRef = useRef<ID | null>(planId);

  // 500ms debounce 写 localStorage
  // 仅依赖业务字段（排除 meta），避免 savedAt 变化触发无限循环
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveDraftToStorage(state);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.step,
    state.title,
    state.description,
    state.startDate,
    state.endDate,
    state.level,
    state.timeDim,
    state.parentPlanId,
    state.items,
    state.tags,
    state.autoGenBlog,
    state.dailyReminder,
    state.meta.planId,
  ]);

  // planId 变化时重新加载（异常情况兜底，正常情况下 planId 不会变）
  useEffect(() => {
    if (prevPlanIdRef.current !== planId) {
      prevPlanIdRef.current = planId;
      const draft = loadDraftFromStorage(planId) ?? createInitialDraft(planId);
      setStateInternal(draft);
    }
  }, [planId]);

  const setState = useCallback(
    (updater: DraftFormState | ((s: DraftFormState) => DraftFormState)) => {
      setStateInternal((prev) =>
        typeof updater === 'function' ? (updater as (s: DraftFormState) => DraftFormState)(prev) : updater,
      );
    },
    [],
  );

  const clearDraft = useCallback(() => {
    clearDraftInStorage(planId);
  }, [planId]);

  // dirty 检测：state vs initial
  const dirty = JSON.stringify(state) !== JSON.stringify(initial.current);

  return { state, setState, clearDraft, dirty };
}
