# Design · Zustand Stores 切面

> 本文档回答**「为什么这样切分 / 哪些数据放在 store / 哪些数据走 useLiveQuery」**。
> 不重复 `architecture.md` 已写的 store 选型理由，仅补充 v1.0 实现层面的具体决策。

---

## 1. 选型复述（来自 architecture §1.4 / §3.2，本 change 不再争议）

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 业务 store | Zustand 4.x | Redux Toolkit / Jotai / Pinia | 1KB / 无 Provider / selector 精确订阅 |
| 业务 store 数据来源 | **派生**（每次渲染调 Repository 重读） | **持有**（写一份到 store state） | 避免双源；单源即 IndexedDB |
| 实时数据订阅 | `dexie-react-hooks` `useLiveQuery` | 自研订阅 / 事件总线 | 跨 Tab 同步、change feed、自动清理 |
| UI store 持久化 | `zustand/middleware` `persist` | 手写 localStorage 同步 | 中间件标准化 + 跨版本迁移 |
| UI store 数据 | 持有 | 派生 | 视图模式 / 主题是瞬时切换，需要立即响应 |

---

## 2. 关键架构决策：业务 store 不持有实体数据

### 2.1 反模式（如果这样做）

```ts
// ❌ 反例：业务 store 持有 plans 实体
const usePlanStore = create<{ plans: Plan[]; load: () => Promise<void> }>((set) => ({
  plans: [],
  load: async () => set({ plans: await planRepo.list() }),
}));
```

**问题**：
1. 写操作后要手动 `set({ plans: await planRepo.list() })` 刷新整表
2. 跨 Tab 同步需另写订阅
3. 1000 条 plans 全存 store 内存，重渲染压力大
4. 与 Repository 双源真相，谁后写谁赢

### 2.2 正解（本次实现）

```ts
// ✅ 业务 store 只持有 transient 状态（loading / error / draft / selection）
const usePlanStore = create<{
  loading: boolean;
  error: AppErrorPayload | null;
  selectedId: ID | null;
  setSelected: (id: ID | null) => void;
  createPlan: (input: PlanCreateInput) => Promise<Plan>;
  updatePlan: (id: ID, patch: PlanUpdatePatch) => Promise<Plan>;
  deletePlan: (id: ID) => Promise<void>;
}>((set) => ({
  loading: false,
  error: null,
  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),
  createPlan: async (input) => {
    set({ loading: true, error: null });
    try {
      const plan = await planRepo.create(input);
      set({ loading: false });
      return plan;
    } catch (e) {
      set({ loading: false, error: toAppErrorPayload(e) });
      throw e;
    }
  },
  // ...
}));

// 实体数据走 useLiveQuery：
// const plans = usePlans();  // 内部 useLiveQuery(() => planRepo.list())
```

**收益**：
1. 写操作完成后 Dexie 触发 liveQuery → 组件自动重渲染，**store 无需刷自己**
2. 跨 Tab 同步免费（liveQuery 内置）
3. store 内存只放 transient，重渲染成本可忽略
4. 单源真相即 IndexedDB

### 2.3 Store vs Hook 职责划分

| 关注点 | 归属 | 例子 |
|--------|------|------|
| 实体数据（Plan / Blog / Item...） | **useLiveQuery hook** | `usePlan(id)` → `Plan \| undefined` |
| 写操作 | **store action** | `usePlanStore.getState().createPlan(input)` |
| 加载状态 | **store state** | `usePlanStore(s => s.loading)` |
| 错误状态 | **store state** | `usePlanStore(s => s.error)` |
| 当前选中 / 编辑中的草稿 | **store state** | `usePlanStore(s => s.selectedId)` |
| 视图模式 / 主题 / 抽屉 | **uiStore** | `useUIStore(s => s.viewMode)` |

---

## 3. 目录结构

```
src/stores/
├── plansStore.ts          # usePlanStore（CRUD + selection + loading）
├── itemsStore.ts          # useItemsStore（toggle / reorder / create）
├── blogsStore.ts          # useBlogStore（CRUD + duplicate / archive）
├── frameworksStore.ts     # useFrameworkStore（仅 read + apply）
├── tagsStore.ts           # useTagStore（CRUD）
├── attachmentsStore.ts    # useAttachmentStore（upload / delete）
├── uiStore.ts             # useUIStore（persist：viewMode / theme / drawer）
├── index.ts               # 统一导出
└── hooks/                 # useLiveQuery hooks（按业务域再分）
    ├── usePlan.ts
    ├── usePlans.ts
    ├── useItemsForPlan.ts
    ├── useBlog.ts
    ├── useBlogs.ts
    ├── useFrameworks.ts
    ├── useTags.ts
    └── useAttachmentsForBlog.ts
```

**文件命名规则**：
- store 文件：复数 + Store.ts（如 `plansStore.ts`）；提供 `usePlanStore` hook
- hook 文件：use + 业务名（单数或复数）+ .ts
- 一个文件一个主要导出

---

## 4. Store 接口签名

### 4.1 plansStore

```ts
// src/stores/plansStore.ts
import { create } from 'zustand';
import type { ID, Plan } from '@/types/domain';
import type { PlanCreateInput, PlanUpdatePatch, AppErrorPayload } from '@/db/repos/types';
import { planRepo } from '@/db/repos';

interface PlanStoreState {
  // transient 状态
  loading: boolean;
  error: AppErrorPayload | null;
  selectedId: ID | null;
  /** 当前正在编辑的草稿（用于编辑页 3 步骤表单中途暂存） */
  draft: Partial<PlanCreateInput> | null;

  // actions
  setSelected: (id: ID | null) => void;
  setDraft: (draft: Partial<PlanCreateInput> | null) => void;
  clearError: () => void;

  createPlan: (input: PlanCreateInput) => Promise<Plan>;
  updatePlan: (id: ID, patch: PlanUpdatePatch) => Promise<Plan>;
  deletePlan: (id: ID) => Promise<void>;
  bulkUpdatePlans: (ids: ID[], patch: PlanUpdatePatch) => Promise<Plan[]>;
  recomputeProgress: (planId: ID) => Promise<number>;
}

export const usePlanStore = create<PlanStoreState>((set, get) => ({
  loading: false,
  error: null,
  selectedId: null,
  draft: null,

  setSelected: (id) => set({ selectedId: id }),
  setDraft: (draft) => set({ draft }),
  clearError: () => set({ error: null }),

  createPlan: async (input) => {
    set({ loading: true, error: null });
    try {
      const plan = await planRepo.create(input);
      set({ loading: false });
      return plan;
    } catch (e) {
      const payload = toAppErrorPayload(e);
      set({ loading: false, error: payload });
      console.error('[plansStore.createPlan]', payload);
      throw e;
    }
  },
  // ... 其他 action 同模式
}));
```

### 4.2 itemsStore

```ts
interface ItemStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  toggleItem: (id: ID) => Promise<Item>;
  createItem: (planId: ID, input: ItemCreateInput) => Promise<Item>;
  reorderItems: (planId: ID, orderedIds: ID[]) => Promise<void>;
  deleteItem: (id: ID) => Promise<void>;
  clearError: () => void;
}
```

### 4.3 blogsStore

```ts
interface BlogStoreState {
  loading: boolean;
  error: AppErrorPayload | null;
  selectedId: ID | null;

  setSelected: (id: ID | null) => void;
  createBlog: (input: BlogCreateInput) => Promise<Blog>;
  updateBlog: (id: ID, patch: Partial<Blog>) => Promise<Blog>;
  deleteBlog: (id: ID) => Promise<void>;
  duplicateBlog: (id: ID) => Promise<Blog>;
  archiveBlog: (id: ID) => Promise<Blog>;
  searchBlogs: (q: string) => Promise<Blog[]>;
  clearError: () => void;
}
```

### 4.4 frameworksStore

```ts
interface FrameworkStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  applyFramework: (frameworkId: ID, planId?: ID) => Promise<TiptapJSON>;
  clearError: () => void;
}
```

### 4.5 tagsStore

```ts
interface TagStoreState {
  loading: boolean;
  error: AppErrorPayload | null;

  createTag: (input: TagCreateInput) => Promise<Tag>;
  deleteTag: (id: ID) => Promise<void>;
  clearError: () => void;
}
```

### 4.6 attachmentsStore

```ts
interface AttachmentStoreState {
  loading: boolean;
  error: AppErrorPayload | null;
  /** object URL 缓存（key=attachmentId, value=URL.createObjectURL 返回的字符串） */
  objectUrls: Map<ID, string>;

  uploadAttachment: (blogId: ID, file: File) => Promise<Attachment>;
  deleteAttachment: (id: ID) => Promise<void>;
  getObjectURL: (id: ID) => Promise<string>;
  /** 组件卸载时调，revoke 所有缓存的 URL 避免内存泄漏 */
  revokeAll: () => void;
  clearError: () => void;
}
```

### 4.7 uiStore

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ViewMode = 'grouped' | 'flat' | 'table';
export type Theme = 'light' | 'dark' | 'eye-care';
export type DrawerId = 'framework' | 'planEdit' | 'blogEdit' | 'settings' | 'search';

interface UIStoreState {
  // 视图模式（Plans 列表页用）
  viewMode: ViewMode;
  // 主题（v1.0 仅占位，v1.1 真接）
  theme: Theme;
  // 主色
  primaryColor: string;
  // 侧边栏折叠
  sidebarCollapsed: boolean;
  // 抽屉栈（z-index 栈式管理，多 drawer 可嵌套）
  drawerStack: Array<{ id: DrawerId; props?: unknown }>;

  // actions
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: Theme) => void;
  setPrimaryColor: (color: string) => void;
  toggleSidebar: () => void;
  openDrawer: (id: DrawerId, props?: unknown) => void;
  closeDrawer: (id: DrawerId) => void;
  closeTopDrawer: () => void;
  closeAllDrawers: () => void;
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set) => ({
      viewMode: 'grouped',
      theme: 'light',
      primaryColor: '#3B82F6',
      sidebarCollapsed: false,
      drawerStack: [],

      setViewMode: (mode) => set({ viewMode: mode }),
      setTheme: (theme) => set({ theme }),
      setPrimaryColor: (color) => set({ primaryColor: color }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      openDrawer: (id, props) =>
        set((s) => ({ drawerStack: [...s.drawerStack, { id, props }] })),
      closeDrawer: (id) =>
        set((s) => ({ drawerStack: s.drawerStack.filter((d) => d.id !== id) })),
      closeTopDrawer: () =>
        set((s) => ({ drawerStack: s.drawerStack.slice(0, -1) })),
      closeAllDrawers: () => set({ drawerStack: [] }),
    }),
    {
      name: 'planote-ui',
      storage: createJSONStorage(() => localStorage),
      // 只持久化白名单字段
      partialize: (state) => ({
        viewMode: state.viewMode,
        theme: state.theme,
        primaryColor: state.primaryColor,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      version: 1,
    },
  ),
);
```

---

## 5. useLiveQuery Hooks 设计

### 5.1 通用签名

```ts
// useLiveQuery 的类型：T | undefined
import { useLiveQuery } from 'dexie-react-hooks';
```

**首帧 `undefined`**：Dexie 异步打开，组件首次渲染时数据还没回来。所有 useLiveQuery 必须容忍 `undefined`，UI 侧用 `if (data === undefined) return <Skeleton />` 处理。

### 5.2 8 个 hook 详细签名

```ts
// usePlan(id: ID): Plan | undefined
// usePlans(): Plan[] | undefined
// useItemsForPlan(planId: ID): Item[] | undefined
// useBlog(id: ID): Blog | undefined
// useBlogs(): Blog[] | undefined
// useFrameworks(): Framework[] | undefined
// useTags(): Tag[] | undefined
// useAttachmentsForBlog(blogId: ID): Attachment[] | undefined
```

### 5.3 示例实现（usePlan.ts）

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { planRepo } from '@/db/repos';
import type { ID, Plan } from '@/types/domain';

export function usePlan(id: ID | null | undefined): Plan | undefined {
  return useLiveQuery(
    async () => (id ? await planRepo.get(id) : undefined),
    [id],
  );
}

export function usePlans(): Plan[] | undefined {
  return useLiveQuery(async () => await planRepo.list());
}
```

### 5.4 默认排序与去抖

- `usePlans()` 默认按 `createdAt desc`（已在 PlanRepo.list 默认实现）
- `useBlogs()` 默认按 `updatedAt desc`（已在 BlogRepo.list 默认实现）
- 不在前端二次 sort，避免性能浪费
- 大数据集（>500 条）由调用方传 `{ pagination: { offset, limit } }` 给 hook，hook 内不内置分页

### 5.5 依赖数组

- `useLiveQuery(querier, deps)` 的 deps 必须是稳定的（基本类型 / 引用稳定的对象）
- 参数化 hook（usePlan(id)）的 deps 为 `[id]`
- 列表 hook 无参数，deps 为 `[]`

---

## 6. 错误处理

### 6.1 统一错误归一化

```ts
// src/stores/_internal/toAppErrorPayload.ts
import { AppError, type AppErrorPayload } from '@/db/repos/types';

/** 把任意 throw 归一化为 AppErrorPayload（用于 store error 状态）。 */
export function toAppErrorPayload(e: unknown): AppErrorPayload {
  if (e instanceof AppError) return e.error;
  if (e instanceof Error) return { code: 'UNKNOWN', message: e.message, cause: e };
  return { code: 'UNKNOWN', message: 'Unknown error', cause: e };
}
```

### 6.2 Store action 模式

```ts
async createPlan(input: PlanCreateInput): Promise<Plan> {
  set({ loading: true, error: null });
  try {
    const plan = await planRepo.create(input);
    set({ loading: false });
    return plan;
  } catch (e) {
    const payload = toAppErrorPayload(e);
    set({ loading: false, error: payload });
    console.error('[plansStore.createPlan] failed:', payload);
    throw e;  // 让调用方也能 catch
  }
}
```

### 6.3 v1.0 错误展示占位

- `console.error` 完整打印（含 `code` / `message` / `cause`）
- UI 层（v1.0 Dashboard / 列表）暂不订阅 `error`，下一步 change 接入
- Sprint 4 公共组件 change 加 Toast 组件后，全局监听 store.error 自动弹 toast

---

## 7. 派生 selector 模式

业务 store 不放实体数据，但**派生计算**（进度、紧急度、过滤、排序）仍需要 selector。selector 写在 hook 文件里，**不写到 store state**，避免双源。

```ts
// usePlansWithUrgency.ts（额外 hook，v1.0 不实现，列在 v1.1 候选）
// 思想：用 useMemo 包一个 selector，输入 plans，输出按紧急度排序后的 plans
```

**v1.0 不实现派生 hook**（Dashboard 简单显示，下个 change 接入时再写）。tasks.md 不列入。

---

## 8. 不在本 change 范围

- React 组件订阅 store（下一步 change 做）
- Toast / ErrorBoundary 真实接入（Sprint 4 公共组件）
- 网络层（v1.0 纯本地）
- 撤销 / 重做栈（roadmap T-042 在 Sprint 4）
- store 单元测试（v1.0 Sprint 1-2 暂不强制）
- 状态机库（XState 不引入）
- persist 迁移函数（v1.0 单一 version=1，未来加 version=2 时再写 migrate）
- 派生 selector hook（Dashboard 接入时按需补）
