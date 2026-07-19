# Design · 计划编辑表单

> 本文档回答**「三步表单如何分步校验、草稿如何避免覆盖 edit 数据、提交后如何跳转、关联上级字段如何接入」**。
> 不重复 `architecture.md` 已写的内容，仅补充本 change 的具体决策。

---

## 1. 选型复述

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 表单库 | `useState` + 自研 | React Hook Form + Zod | 3 步 + 嵌套事项，自研可控；v1.0 表单字段不深 |
| 步骤指示器 | 自研 `Stepper` 组件 | react-stepper-horizontal | 仅 3 步，60 行自研即可，零依赖 |
| 拖拽排序 | 不实现（用上下移按钮） | @dnd-kit | 事项在 v1.0 数量小（5-10 个），按钮足够 |
| 草稿存储 | localStorage | IndexedDB | 草稿是临时数据，不入业务数据；localStorage 同步 API 简单 |
| 标签输入 | input + 逗号分隔 | react-tag-input | 标签 UI 在 add-tag-module 全面重构；v1.0 简化为字符串 |

---

## 2. 关键架构决策

### 2.1 三步表单状态机

```ts
type FormStep = 1 | 2 | 3;
type FormState = {
  step: FormStep;
  // step 1
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  // step 2
  level: PlanLevel | null;
  timeDim: PlanTimeDim | null;
  parentPlanId: ID | null;
  // step 3
  items: Array<{ id?: ID; title: string; dueDate?: string }>;
  // 高级选项
  autoGenBlog: boolean;
  dailyReminder: boolean;
  // 元
  dirty: boolean;
};
```

**为什么用单 useState 持有整张表单**：

- 草稿保存是一次性 JSON.stringify 整个 FormState
- 跨步骤切换时不需要考虑字段重置
- 简单，无 reducer 仪式感

**为什么不用 useReducer**：

- 表单字段无嵌套冲突（事项是 array of object）
- 转换函数简单（SET_FIELD / ADD_ITEM / REMOVE_ITEM / MOVE_ITEM）

### 2.2 步骤校验函数

```ts
function canAdvance(state: FormState): boolean {
  if (state.step === 1) return state.title.trim().length > 0;
  if (state.step === 2) return state.level !== null && state.timeDim !== null;
  return true; // step 3 由 submit 单独校验
}

function canSubmit(state: FormState): boolean {
  return state.items.some((it) => it.title.trim().length > 0);
}
```

**为什么分离 canAdvance / canSubmit**：

- canAdvance 控制「下一步」按钮 disabled
- canSubmit 控制「保存」按钮 disabled（最后一步）
- 步骤 3 的「下一步」是「保存」按钮复用——v1.0 简化

### 2.3 草稿持久化策略

```ts
const DRAFT_KEY = (planId: ID | null) =>
  `planote:plan-edit:draft:${planId ?? 'none'}`;

// 加载
function loadDraft(planId: ID | null): FormState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(planId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 保存（debounce 500ms）
const debouncedSave = useDebouncedCallback(
  (state) => {
    if (!state.dirty) return;
    try {
      localStorage.setItem(DRAFT_KEY(planId), JSON.stringify(state));
    } catch {
      /* quota exceeded - 静默 */
    }
  },
  500,
);
```

**为什么用 localStorage 而非 IndexedDB**：

- 草稿是临时数据，不属于业务域
- localStorage 同步 API，submit 后立即清空无需等待
- 5MB 容量足够单草稿（< 10KB）
- v1.1 可考虑迁移到 IndexedDB（如果用户提了反馈）

**为什么 key 含 planId**：

- create 模式 planId=null → key `planote:plan-edit:draft:none`
- edit 模式 planId='01H...' → key `planote:plan-edit:draft:01H...`
- 防止 create 草稿污染 edit，或反之

**草稿覆盖场景**：

- 用户开 edit → 草稿存在 → 弹出「恢复草稿」选择（保留「用最新」「恢复草稿」二选一）
- v1.0 简化：**草稿优先**（用户最近的输入胜过 store 中的旧数据）
- 例外：edit 模式 + 草稿 ID 与当前 plan ID 不匹配 → 忽略草稿（异常情况兜底）

### 2.4 dirty 检测与路由守卫

```ts
const isDirty = JSON.stringify(state) !== JSON.stringify(initialState);
useEffect(() => {
  if (!isDirty) return;
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = ''; // Chrome 显示「离开网站?」
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
}, [isDirty]);

// 路由变化
const blocker = useBlocker(({ currentLocation, nextLocation }) => {
  return isDirty && currentLocation.pathname !== nextLocation.pathname;
});
```

**为什么不实现完整的 useBlocker**：

- React Router 6 的 `useBlocker` 仍为 unstable API
- v1.0 简化：仅在 `unmount` 时弹 confirm + 关闭 tab 时浏览器原生 confirm
- 全功能留 v1.1

### 2.5 提交逻辑

```ts
async function handleSubmit() {
  if (!canSubmit(state)) return;
  setLoading(true);
  try {
    const validItems = state.items
      .filter((it) => it.title.trim().length > 0)
      .map((it, order) => ({ title: it.title.trim(), dueDate: it.dueDate, order }));

    if (mode === 'create') {
      const plan = await usePlanStore.getState().createPlan({
        title: state.title.trim(),
        description: state.description.trim(),
        level: state.level!,
        timeDim: state.timeDim!,
        status: 'todo',
        tagIds: [],
        itemIds: [],
        blogIds: [],
        childPlanIds: [],
        startDate: state.startDate || undefined,
        endDate: state.endDate || undefined,
        parentPlanId: state.parentPlanId ?? undefined,
      });
      // 批量创建事项
      await Promise.all(
        validItems.map((it) =>
          useItemsStore.getState().createItem(plan.id, { ...it, status: 'todo', checked: false }),
        ),
      );
      clearDraft();
      navigate(`/plans/${plan.id}`);
    } else {
      // edit 模式
      await usePlanStore.getState().updatePlan(id!, {
        title: state.title.trim(),
        description: state.description.trim(),
        level: state.level!,
        timeDim: state.timeDim!,
        startDate: state.startDate || undefined,
        endDate: state.endDate || undefined,
        parentPlanId: state.parentPlanId ?? undefined,
      });
      // 事项的增删留给 add-item-crud
      // v1.0 edit 模式不修改 items（仅修改 plan 字段）
      clearDraft();
      navigate(`/plans/${id}`);
    }
  } catch (e) {
    console.error('[PlanEdit] submit failed:', e);
  } finally {
    setLoading(false);
  }
}
```

**为什么 create 模式批量创建事项，edit 模式不修改**：

- v1.0 简化：create 模式表单 = 完整 plan + items 一并提交
- edit 模式：plan 字段 + items 完全由 add-item-crud 接手（设计隔离）
- 这是 v1.0 的明确边界：表单只创建新 plan 时的 items；已存在 plan 的 items 走独立模块

### 2.6 步骤指示器组件

```tsx
interface StepperProps {
  current: 1 | 2 | 3;
  completed: Set<1 | 2 | 3>;
  onJump: (step: 1 | 2 | 3) => void;
  steps: Array<{ id: 1 | 2 | 3; label: string; description: string }>;
}
```

- 视觉（与 prototype plan-edit.html 顶部指示器对齐）：
  - 圆点（数字） + 横线连接 + 文案
  - active：brand-900 背景白字
  - completed：emerald-500 背景 + check icon
  - pending：stone-200 背景 + 灰色数字
- 交互：仅 `completed` 集合内的步骤可点击跳转；当前步骤不可跳；pending 步骤不可跳
- a11y：role="navigation" + aria-current="step"

### 2.7 事项增删与上下移

```ts
const addItem = () => setState((s) => ({
  ...s,
  items: [...s.items, { title: '', dueDate: undefined }],
  dirty: true,
}));

const removeItem = (idx: number) => setState((s) => ({
  ...s,
  items: s.items.filter((_, i) => i !== idx),
  dirty: true,
}));

const moveItem = (idx: number, dir: -1 | 1) => setState((s) => {
  const target = idx + dir;
  if (target < 0 || target >= s.items.length) return s;
  const next = [...s.items];
  [next[idx], next[target]] = [next[target]!, next[idx]!];
  return { ...s, items: next, dirty: true };
});
```

**为什么 v1.0 用上下移按钮而非拖拽**：

- 事项数量小（5-10 个）
- 拖拽库（@dnd-kit）需要 list 容器 + 触屏适配，工作量大
- 按钮操作键盘可达性更好（a11y）
- 真实拖拽留 v1.1 add-item-drag-sort

### 2.8 高级选项折叠

```tsx
const [advancedOpen, setAdvancedOpen] = useState(false);

<button onClick={() => setAdvancedOpen((v) => !v)}>
  {advancedOpen ? '收起' : '展开'} 高级选项
</button>
{advancedOpen && (
  <div>
    <label>
      <input type="checkbox" checked={state.autoGenBlog} disabled />
      完成后自动生成博客（v1.1 启用）
    </label>
    <label>
      <input type="checkbox" checked={state.dailyReminder} disabled />
      每日提醒（v1.1 启用）
    </label>
    <select value={state.parentPlanId ?? ''} onChange={...}>
      <option value="">无</option>
      {parentCandidates.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
  </div>
)}
```

- v1.0 checkbox 都 disabled + tooltip 提示
- parentPlanId select 启用：拉所有 level=long 的 plans 作为候选
- UI 完整存但功能 disabled，避免 v1.1 改 UI 大改

---

## 3. 组件详细设计

### 3.1 PlanEditTopBar

```tsx
interface Props {
  mode: 'create' | 'edit';
  onBack: () => void;
  saving: boolean;
}
```

- 视觉：左返回 + 中标题「新建计划 / 编辑计划」+ 右「保存」按钮（最后一步可见）
- 保存中：按钮 spinner + disabled

### 3.2 Stepper

（见 2.6）

### 3.3 Step1BasicInfo

```tsx
interface Props {
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
}
```

- 字段：title（input, max 100）+ description（textarea, max 500）+ startDate（date）+ endDate（date, > startDate）
- 错误：内联显示（title 空白 / endDate <= startDate）

### 3.4 Step2TypeDim

```tsx
interface Props {
  level: PlanLevel | null;
  timeDim: PlanTimeDim | null;
  onChange: (patch: { level?: PlanLevel; timeDim?: PlanTimeDim }) => void;
}
```

- 视觉：两段网格
  - level：3 张大卡（短期 / 中期 / 长期），附「1-4 周 / 1-6 月 / 1-3 年」副标题
  - timeDim：4 张大卡（每日 / 每月 / 每年 / 一次性）
- 选中态：brand-900 背景 + 白字 + 选中 icon
- hover：shadow + 边框变色

### 3.5 Step3Items

```tsx
interface Props {
  items: FormState['items'];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<Item>) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
}
```

- 单条 UI：
  - 左侧：拖拽 handle 图标（灰色 disabled 状态）
  - 中：input（title）+ date input（dueDate）
  - 右：上移 / 下移 / 删除 3 按钮
- 底部：虚线「+ 添加事项」按钮
- 至少 1 个非空 title 提示（步骤底部）

### 3.6 AdvancedOptions

（见 2.8）

### 3.7 usePlanEditDraft

```ts
function usePlanEditDraft(planId: ID | null): {
  state: FormState;
  setState: (updater: ...) => void;
  clearDraft: () => void;
  loadDraft: () => void;
}
```

- 内部用 useState + 500ms debounce
- mount 时自动 loadDraft
- unmount 时不自动清草稿（保存成功后手动清）

---

## 4. 集成方案

### 4.1 路由入口

- `App.tsx` 已有路由 `/plans/new` 和 `/plans/:id/edit` 映射到 `<PlanEdit mode="create"|"edit" />`
- 仅替换 `PlanEdit.tsx` 实现；其他文件不动

### 4.2 步骤切换的视觉

- 步骤指示器 sticky 在顶栏下方
- 主体区域根据 step 切换渲染对应组件
- 切换时 animate-fadeUp 入场（与 ux-guidelines §2 Flow A Step 2 一致）

### 4.3 编辑入口关联

- 详情页 `PlanDetailTopBar`「编辑」按钮已跳 `/plans/:id/edit`（add-plan-detail-view 实现）
- 本 change 仅需确保 `/plans/:id/edit` 路由工作

---

## 5. 边界与测试场景

### 5.1 步骤切换

```ts
// step 1 → 2：title 空白时禁用
<Button disabled={!canAdvance}>下一步</Button>

// 步骤指示器点击：
onClick={() => state.completed.has(step.id) && onJump(step.id)}

// pending 步骤点击：无响应
```

### 5.2 草稿恢复

```ts
// 场景 A：create 模式 + 草稿存在
loadDraft() → 草稿填入表单

// 场景 B：edit 模式 + 草稿存在
loadDraft() → 草稿填入表单

// 场景 C：edit 模式 + 草稿 ID 不匹配（异常）
loadDraft() → null（忽略）
```

### 5.3 提交成功

```ts
create 模式：
  createPlan → 创建 plan
  Promise.all(createItem × N) → 批量创建事项
  clearDraft() → 清 localStorage
  navigate(/plans/:newId) → 跳详情

edit 模式：
  updatePlan → 更新 plan 字段
  clearDraft()
  navigate(/plans/:id) → 跳详情
```

### 5.4 提交失败

```ts
createPlan throws → catch + console.error + 不 clearDraft + 不 navigate
表单保留，错误 toast 提示（v1.0 简化为 console.error）
```

### 5.5 关联上级

```ts
// 候选：所有 level=long 的 plans（不含当前 plan 自身）
useLiveQuery(async () => {
  const all = await planRepo.list();
  return all.filter((p) => p.level === 'long' && p.id !== planId);
}, [planId])

// 选完填入 parentPlanId
```

---

## 6. 不在本 change 范围

- 模板创建（v1.2 之后）
- 协作编辑（v2.0+）
- 事项拖拽（v1.1 / add-item-drag-sort）
- 事项复杂属性（描述、附件、sub-item）
- 高级选项的真实功能（每日提醒 / 自动生成博客）
- 关联上级成环校验
- 完整路由守卫（v1.0 仅 unmount confirm）
- 单元测试
