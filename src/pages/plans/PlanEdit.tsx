/**
 * PlanEdit - 计划编辑页（/plans/new + /plans/:id/edit）
 *
 * 完整流程（add-plan-edit-form）：
 * 1. 路由：mode 由 props.mode 决定（'create' | 'edit'）
 * 2. 顶栏：PlanEditTopBar（返回 + 标题 + 保存）
 * 3. 步骤指示器：Stepper 3 步（基础信息 / 类型维度 / 事项拆解）
 * 4. 步骤主体：根据 state.step 渲染对应组件
 * 5. 步骤切换：上下一步 + 指示器跳回
 * 6. 草稿：usePlanEditDraft（500ms debounce + localStorage）
 * 7. 离开守卫：useUnsavedGuard（dirty + 关闭 tab/返回按钮）
 * 8. 提交：usePlanEditSubmit（create / update + 跳详情）
 *
 * 加载 / 错误态：
 * - 加载中：PlanEditSkeleton
 * - ID 不存在（edit 模式）：EmptyState + 返回按钮
 * - create 模式：直接渲染空白表单
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import EmptyState from '@/components/shell/EmptyState';
import Stepper from '@/components/shell/Stepper';
import PlanEditTopBar from '@/features/plan/components/PlanEditTopBar';
import Step1BasicInfo from '@/features/plan/components/Step1BasicInfo';
import Step2TypeDim from '@/features/plan/components/Step2TypeDim';
import Step3Items from '@/features/plan/components/Step3Items';
import AdvancedOptions from '@/features/plan/components/AdvancedOptions';
import {
  usePlanEditDraft,
  type DraftFormState,
  type DraftItem,
} from '@/features/plan/hooks/usePlanEditDraft';
import {
  usePlanEditSubmit,
  canAdvanceFromStep1,
  canAdvanceFromStep2,
  canSubmit,
} from '@/features/plan/hooks/usePlanEditSubmit';
import { useUnsavedGuard } from '@/features/plan/hooks/useUnsavedGuard';
import { usePlan, usePlans, useItemsForPlan } from '@/stores';
import type { PlanLevel, PlanTimeDim } from '@/types/domain';
import PlanEditSkeleton from './PlanEditSkeleton';

interface PlanEditProps {
  mode?: 'create' | 'edit';
}

const STEPS = [
  { id: 1 as const, label: '基础信息', description: '标题 + 描述' },
  { id: 2 as const, label: '类型与维度', description: '层级 + 时间维度' },
  { id: 3 as const, label: '拆解事项', description: '可执行清单' },
];

export default function PlanEdit({ mode = 'create' }: PlanEditProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // edit 模式才订阅单个 plan；create 模式无 id
  const plan = usePlan(mode === 'edit' ? (id ?? null) : null);
  const items = useItemsForPlan(mode === 'edit' ? (id ?? null) : null);
  // 关联上级候选：所有 level=long 的 plans（不含当前 plan）
  const allPlans = usePlans();
  const parentCandidates = useMemo(
    () =>
      (allPlans ?? []).filter(
        (p) => p.level === 'long' && p.id !== (mode === 'edit' ? id : null),
      ),
    [allPlans, id, mode],
  );

  // 表单状态（草稿 hook）
  const prefilled = useMemo<Partial<DraftFormState> | undefined>(() => {
    if (mode !== 'edit' || !plan || !items) return undefined;
    return {
      title: plan.title,
      description: plan.description,
      startDate: plan.startDate ?? '',
      endDate: plan.endDate ?? '',
      level: plan.level,
      timeDim: plan.timeDim,
      parentPlanId: plan.parentPlanId ?? null,
      // edit 模式不携带 items（add-item-crud 接手）
      items: [],
      tags: [],
      // v1.0 高级选项 UI 占位
      autoGenBlog: true,
      dailyReminder: false,
    };
  }, [mode, plan, items]);

  const { state, setState, clearDraft, dirty } = usePlanEditDraft({
    planId: mode === 'edit' ? (id ?? null) : null,
    prefilled,
  });

  // 离开守卫
  const { confirmLeave } = useUnsavedGuard(dirty);

  // 提交
  const { submit, submitting, error } = usePlanEditSubmit();

  // 步骤切换
  const canAdvance = useMemo(() => {
    if (state.step === 1) return canAdvanceFromStep1(state);
    if (state.step === 2) return canAdvanceFromStep2(state);
    return true;
  }, [state]);

  const completed = useMemo(() => {
    const set = new Set<1 | 2 | 3>();
    if (state.step > 1 || (state.step === 1 && canAdvanceFromStep1(state))) {
      if (state.step > 1) set.add(1);
      if (canAdvanceFromStep1(state)) set.add(1);
    }
    if (state.step === 3) {
      set.add(1);
      set.add(2);
    }
    if (state.step === 2 && canAdvanceFromStep2(state)) {
      set.add(1);
    }
    return set;
  }, [state]);

  const handleStepJump = useCallback(
    (step: 1 | 2 | 3) => {
      // 只允许跳到已完成步骤
      if (!completed.has(step)) return;
      setState((s) => ({ ...s, step }));
    },
    [completed, setState],
  );

  const handleNext = useCallback(() => {
    if (!canAdvance) return;
    setState((s) => ({ ...s, step: Math.min(3, s.step + 1) as 1 | 2 | 3 }));
  }, [canAdvance, setState]);

  const handlePrev = useCallback(() => {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) as 1 | 2 | 3 }));
  }, [setState]);

  // 字段变更
  const updateState = useCallback(
    (patch: Partial<DraftFormState>) => {
      setState((s) => ({ ...s, ...patch }));
    },
    [setState],
  );

  // level / timeDim 单独 patch
  const updateTypeDim = useCallback(
    (patch: { level?: PlanLevel | null; timeDim?: PlanTimeDim | null }) => {
      setState((s) => ({
        ...s,
        level: patch.level !== undefined ? patch.level : s.level,
        timeDim: patch.timeDim !== undefined ? patch.timeDim : s.timeDim,
      }));
    },
    [setState],
  );

  // 事项操作
  const addItem = useCallback(() => {
    setState((s) => ({ ...s, items: [...s.items, { title: '', dueDate: undefined }] }));
  }, [setState]);

  const updateItem = useCallback(
    (idx: number, patch: Partial<DraftItem>) => {
      setState((s) => ({
        ...s,
        items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      }));
    },
    [setState],
  );

  const removeItem = useCallback(
    (idx: number) => {
      setState((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
    },
    [setState],
  );

  const moveItem = useCallback(
    (idx: number, dir: -1 | 1) => {
      setState((s) => {
        const target = idx + dir;
        if (target < 0 || target >= s.items.length) return s;
        const next = [...s.items];
        const a = next[idx]!;
        const b = next[target]!;
        next[idx] = b;
        next[target] = a;
        return { ...s, items: next };
      });
    },
    [setState],
  );

  // 顶栏返回按钮
  const handleBack = useCallback(() => {
    if (!confirmLeave()) return;
    if (mode === 'edit' && id) {
      navigate(`/plans/${id}`);
    } else {
      navigate('/plans');
    }
  }, [confirmLeave, mode, id, navigate]);

  // 提交按钮
  const handleSubmit = useCallback(() => {
    void submit({
      mode,
      planId: mode === 'edit' ? (id ?? null) : null,
      state,
      onSuccess: (newId) => {
        clearDraft();
        navigate(`/plans/${newId}`);
      },
    });
  }, [submit, mode, id, state, clearDraft, navigate]);

  const showSave = state.step === 3;
  const canSaveNow = canSubmit(state);

  // 加载态 / ID 不存在（仅 edit 模式）
  // - 加载中：plan=undefined, items=undefined（liveQuery 首帧）
  // - ID 不存在：plan=undefined, items=[]（items 已 settle，但 plan 永远为 undefined）
  if (mode === 'edit') {
    if (plan === undefined && items === undefined) {
      return <PlanEditSkeleton />;
    }
    if (plan === undefined) {
      return (
        <EmptyState
          icon={AlertCircle}
          title="找不到该计划"
          description="该计划可能已被删除"
          action={{
            label: '返回计划列表',
            onClick: () => navigate('/plans'),
          }}
          variant="default"
        />
      );
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PlanEditTopBar
        mode={mode}
        saving={submitting}
        showSave={showSave}
        canSave={canSaveNow}
        onBack={handleBack}
        onSubmit={handleSubmit}
      />

      {/* 步骤指示器 */}
      <Stepper
        current={state.step}
        completed={completed}
        onJump={handleStepJump}
        steps={STEPS}
      />

      {/* 错误提示（顶部条） */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fadeUp">
          {error}
        </div>
      )}

      {/* 步骤主体 */}
      {state.step === 1 && (
        <>
          <Step1BasicInfo state={state} onChange={updateState} />
          <StepNav onNext={handleNext} canAdvance={canAdvance} showPrev={false} />
        </>
      )}

      {state.step === 2 && (
        <>
          <Step2TypeDim level={state.level} timeDim={state.timeDim} onChange={updateTypeDim} />
          <StepNav onPrev={handlePrev} onNext={handleNext} canAdvance={canAdvance} showPrev />
        </>
      )}

      {state.step === 3 && (
        <>
          <Step3Items
            items={state.items}
            onAdd={addItem}
            onUpdate={updateItem}
            onRemove={removeItem}
            onMove={moveItem}
          />
          <AdvancedOptions
            state={state}
            onChange={updateState}
            parentCandidates={parentCandidates}
          />
          <StepNav onPrev={handlePrev} onNext={handleSubmit} canAdvance={canSaveNow} showPrev />
          {/* 步骤 3 的「下一步」按钮语义为「保存」 */}
        </>
      )}

      {/* 草稿状态指示（调试/透明）*/}
      {dirty && (
        <div className="text-center text-[10px] text-brand-400 mt-2">
          · 草稿已自动保存 ·
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 步骤导航（下一步 / 上一步）
 * ============================================================ */
function StepNav({
  onNext,
  onPrev,
  canAdvance,
  showPrev,
}: {
  onNext?: () => void;
  onPrev?: () => void;
  canAdvance: boolean;
  showPrev: boolean;
}) {
  return (
    <div className={`mt-2 flex ${showPrev ? 'justify-between' : 'justify-end'} animate-fadeUp`}>
      {showPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-sm font-medium hover:bg-stone-50 transition flex items-center gap-2"
        >
          <ArrowLeft size={12} />
          上一步
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            canAdvance
              ? 'bg-brand-900 text-white hover:bg-brand-800 shadow-sm'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          下一步
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
