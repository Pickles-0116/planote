## Why

Sprint 1 Step 2 已完成 6 个 Repository（planRepo / itemRepo / blogRepo / frameworkRepo / tagRepo / attachmentRepo），把 IndexedDB 访问封装在 `src/db/repos/`，UI 与 Store 可以不直接调 Dexie。但**中间层仍然缺失**——如果 UI 组件直接 `await planRepo.list()` 然后用 `useState` 存住，会出现两个问题：

1. **响应式断链**：勾选一个事项后，需要组件自己再调一次 `planRepo.recomputeProgress()`、再 `setState`，跨组件（进度环 / 进度条 / 百分比文字 / 计数 / 计划卡片 / 完成横幅）同步要靠 prop drilling 或 ref 传递。
2. **跨 Tab 同步缺失**：同浏览器开两个 Tab，Tab A 勾选一个事项，Tab B 不会自动更新——除非组件订阅 Dexie 的 `liveQuery`。

架构文档（`architecture.md` §1.4 / §3.2 / §5.4）已锁定 **Zustand** 作为业务域切片的中间层，配合 `dexie-react-hooks` 的 `useLiveQuery` 形成"数据变更 → 组件自动重渲染"的反应式链路。Repository 是"如何持久化"的契约，Store 是"何时触发持久化 + 派生如何计算"的契约，两者职责正交。

本 change 落「状态层」这一层切面：**6 个业务 store + 1 个 UI store + 1 个 index 统一导出 + 8 个 useLiveQuery hook**。完成后，所有 UI 组件只需 `usePlanStore(s => s.plans[id])` 或 `usePlan(id)` 即可拿到响应式数据；写操作经 store action，store 内部调 repo 触发 Dexie 写，Dexie 写完成后 liveQuery 通知 store 重新派生。

## What Changes

落地以下 6 个交付物：

1. **6 个业务 store**（`src/stores/*.ts`）：plansStore、itemsStore、blogsStore、frameworksStore、tagsStore、attachmentsStore。每个 store 包装对应 Repository，暴露 CRUD action + 派生 selector。
2. **1 个 UI store**（`src/stores/uiStore.ts`）：视图模式（grouped / flat / table）、抽屉状态（openStack）、主题（light / dark / eye-care 占位）、主色（primaryColor）。
3. **8 个 useLiveQuery hooks**（`src/stores/hooks/*.ts`）：usePlan / usePlans / useItemsForPlan / useBlog / useBlogs / useFrameworks / useTags / useAttachmentsForBlog。底层用 `dexie-react-hooks` 的 `useLiveQuery` 直接订阅 IndexedDB 变化。
4. **store 入口**（`src/stores/index.ts`）：统一导出 7 个 store hook + 8 个 liveQuery hook + 类型。
5. **错误处理**：每个 store action 用 try/catch 包裹，失败时记录到 `console.error`（v1.0 占位，不弹 toast；toast 系统在 Sprint 4 公共组件 change 中实现）。
6. **persist 中间件**：仅 uiStore 启用 `persist` 写 localStorage（视图模式、主题、主色）。业务 store 不持久化（数据持久化在 Dexie，Zustand 内存里只放当前会话需要的状态）。

**Out of Scope**：

- React 组件订阅 store（下一步 `add-data-binding-dashboard` change 做）
- Toast / ErrorBoundary 真实接入（等 Sprint 4 公共组件 change）
- 网络层（v1.0 纯本地；v1.1 加云同步只新增 RemoteXxxRepo，store 接口不变）
- 撤销/重做栈（roadmap T-042 在 Sprint 4）
- store 单元测试（Sprint 1 不强制）
- 状态机库（XState 不引入）

## Scope

**In Scope**：

- `zustand` 4.x 依赖安装
- 7 个 store 文件 + 1 个 index.ts + 8 个 hook 文件
- UI store 用 `persist` 中间件 + `partialize` 只持久化白名单字段
- 业务 store 全部从 0 开始（不持有实体数据，只持有 selection / draft / error 状态；实体数据走 useLiveQuery）
- TS strict 模式，零 `any`
- 路径别名 `@/` 引入

**Out of Scope**：

- 任何 UI 组件改动（Dashboard 仍用 mock，下个 change 接入）
- Router 改动
- Tiptap 编辑器
- 附件上传 UI
- 标签云 UI
- 看板拖拽

## Acceptance Criteria

- [ ] **AC-1**：`src/stores/` 下新增 7 个 store 文件 + 1 个 `index.ts` + `hooks/` 子目录含 8 个 hook 文件，共 16 个 `.ts` 文件
- [ ] **AC-2**：每个 store 暴露 `useXxxStore` hook（Zustand 4.x 标准 `create<State>((set, get) => ({}))` 模式）
- [ ] **AC-3**：每个业务 store 暴露 CRUD action（`create` / `update` / `delete` / `toggle` / `reorder` 等，按 Repository 接口裁剪），action 内部 try/catch + `console.error`
- [ ] **AC-4**：UI store 用 `zustand/middleware` 的 `persist`，白名单字段为 `viewMode` / `theme` / `primaryColor` / `sidebarCollapsed`，localStorage key 为 `planote-ui`
- [ ] **AC-5**：8 个 useLiveQuery hook 全部用 `dexie-react-hooks` 的 `useLiveQuery`，返回 `T | undefined`（首次渲染 undefined）
- [ ] **AC-6**：`usePlan(id)` / `useItemsForPlan(planId)` / `useAttachmentsForBlog(blogId)` 等 5 个参数化 hook 接受 `ID` 类型参数
- [ ] **AC-7**：`pnpm build` 通过 TS 严格模式编译，0 error
- [ ] **AC-8**：`pnpm dev` 启动后浏览器控制台无 warning / error（Zustand persist 初始化、liveQuery 首次订阅都不应报警告）
- [ ] **AC-9**：`openspec validate add-zustand-stores --strict` 通过
- [ ] **AC-10**：store 文件总行数 < 800（不含 hooks 子目录；hooks 每个 < 50 行）

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| Zustand persist 与 SSR 不兼容（Planote 是纯 SPA，理论无问题） | 低 | 纯 SPA 部署，无 SSR；persist 初始化在 `useEffect` 之前完成 |
| useLiveQuery 在 StrictMode 双调用导致重复订阅 | 低 | `dexie-react-hooks` 内部 useEffect cleanup 正确处理；实测 dev 模式无 warning |
| 业务 store 持有实体数据 vs 只持有 selection 状态的设计决策不一致 | 中 | design.md 明确：业务 store **不**持有实体数据；实体数据走 useLiveQuery；store 只持有 transient 状态（loading / error / draft / selection） |
| UI store persist 的 JSON 反序列化失败（用户手动改 localStorage） | 低 | Zustand persist 默认有版本号 + migrate 函数占位；v1.0 直接 fallback 到 default 即可 |
| 一个文件导出多个 store 导致 HMR 状态丢失 | 中 | 严格一个文件一个 store；`create<T>` 调用只在模块顶层 |
| store 单元测试缺失导致重构风险 | 中 | Sprint 1 暂不强制；Sprint 3+ 关键 store 补 vitest 单测 |

## Dependencies

- **上游（已完成）**：Sprint 1 Step 2 `add-data-layer-dexie`（6 个 Repository + 4 套种子）
- **下游（待启动）**：
  - `add-data-binding-dashboard`（Sprint 1 末）：消费 usePlan / usePlans / useBlogs 等 hook
  - `add-plan-module`（Sprint 2）：消费 plansStore / itemsStore
  - `add-blog-module`（Sprint 3）：消费 blogsStore / frameworksStore / attachmentsStore
  - `add-kanban`（Sprint 4）：消费 plansStore.viewMode + uiStore
