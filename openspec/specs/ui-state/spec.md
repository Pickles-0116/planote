# ui-state Specification

## Purpose
TBD - created by archiving change add-zustand-stores. Update Purpose after archive.
## Requirements
### Requirement: 计划 store 暴露 CRUD action

系统 MUST 提供 `usePlanStore`（Zustand），内部包装 `planRepo`，对组件暴露 CRUD action + transient 状态（loading / error / selectedId / draft）。

业务 store **不**持有实体数据；组件订阅实体数据走 `usePlan` / `usePlans` hook（`useLiveQuery` 实现）。

#### Scenario: 调 createPlan 后实体数据自动出现

- **GIVEN** `plans` 表为空，组件挂载并调用 `usePlans()` 返回 `undefined`
- **WHEN** 组件调 `usePlanStore.getState().createPlan({ title: '...', ... })`
- **THEN** `planRepo.create` 写入 `plans` 表后，Dexie `liveQuery` 自动通知 `usePlans()` 重渲染
- **AND** 组件重新渲染时 `usePlans()` 返回包含新 Plan 的数组
- **AND** `usePlanStore` 内部 `loading` 从 `true` 变回 `false`，`error` 保持 `null`

#### Scenario: 写入失败时 error 状态被填充

- **GIVEN** `usePlanStore` 初始 `error: null`
- **WHEN** 调 `usePlanStore.getState().createPlan({ ... })` 且底层 `planRepo.create` 抛 `AppError({ code: 'STORAGE_FULL' })`
- **THEN** `usePlanStore` 内部 `error` 字段更新为 `{ code: 'STORAGE_FULL', message: '...' }`
- **AND** `console.error` 打印完整 payload（含 code / message / cause）
- **AND** 异常继续向上抛（让调用方也能 catch）

#### Scenario: 选中状态

- **GIVEN** `selectedId` 初始为 `null`
- **WHEN** 调 `usePlanStore.getState().setSelected('p_abc')`
- **THEN** `selectedId` 变为 `'p_abc'`
- **AND** 调 `setSelected(null)` 清除选中

---

### Requirement: 事项 store 暴露勾选 / 排序 action

系统 MUST 提供 `useItemsStore`，内部包装 `itemRepo`，暴露 `toggleItem` / `createItem` / `reorderItems` / `deleteItem` action。

事项实体数据走 `useItemsForPlan(planId)` hook。

#### Scenario: toggleItem 触发 plan progress 重算

- **GIVEN** Plan `p_001` 下有 Item `i_001`（`checked: false`）
- **WHEN** 调 `useItemsStore.getState().toggleItem('i_001')`
- **THEN** `itemRepo.toggle` 切换 `checked: true` + `status: 'done'`
- **AND** 同事务内调 `planRepo.recomputeProgress('p_001')` 重算 `progress` 与 `urgency`
- **AND** Dexie 写完成后，订阅 `usePlan('p_001')` 的组件自动收到新 `progress` 值

#### Scenario: 拖拽后 reorder

- **GIVEN** Plan `p_001` 下有 Item 序列 `[i_1, i_2, i_3, i_4]`
- **WHEN** 调 `useItemsStore.getState().reorderItems('p_001', ['i_3', 'i_1', 'i_2', 'i_4'])`
- **THEN** `itemRepo.reorder` 事务内将 4 条 Item 的 `order` 字段分别更新为 `0, 1, 2, 3`
- **AND** 订阅 `useItemsForPlan('p_001')` 的组件自动收到新顺序

#### Scenario: createItem 时 order 自动递增

- **GIVEN** Plan `p_001` 下已存在 5 条 Item，最大 `order = 4`
- **WHEN** 调 `useItemsStore.getState().createItem('p_001', { title: '新事项' })`
- **THEN** 新 Item 插入，`order` 字段自动为 `5`（max + 1）
- **AND** `useItemsForPlan('p_001')` 返回 6 条 Item

---

### Requirement: 博客 store 暴露 CRUD + 状态流转 action

系统 MUST 提供 `useBlogStore`，内部包装 `blogRepo`，暴露 `createBlog` / `updateBlog` / `deleteBlog` / `duplicateBlog` / `archiveBlog` / `searchBlogs` action。

博客实体数据走 `useBlog(id)` / `useBlogs()` hook。

#### Scenario: 发布博客自动填 publishedAt

- **GIVEN** Blog `b_001` 当前 `status: 'draft'`
- **WHEN** 调 `useBlogStore.getState().updateBlog('b_001', { status: 'published' })`
- **THEN** `blogRepo.update` 内部将 `status` 置为 `'published'` 且 `publishedAt` 填入当前时间
- **AND** `useBlog('b_001')` 返回的 Blog 含新 `publishedAt`

#### Scenario: 复制博客清空关联字段

- **GIVEN** Blog `b_001` 是从 Plan `p_001` 生成的
- **WHEN** 调 `useBlogStore.getState().duplicateBlog('b_001')`
- **THEN** 创建新 Blog `b_new`，`title` 末尾加 `(副本)`，`status: 'draft'`
- **AND** 新 Blog 的 `sourcePlanId` / `frameworkId` / `attachmentIds` 全部为 `undefined` / `[]`
- **AND** 旧 Blog `b_001` 字段不变

#### Scenario: 归档博客

- **GIVEN** Blog `b_001` 当前 `status: 'published'`
- **WHEN** 调 `useBlogStore.getState().archiveBlog('b_001')`
- **THEN** `status` 变为 `'archived'`，其他字段不变
- **AND** `useBlog('b_001')` 返回的 Blog `status === 'archived'`

---

### Requirement: 框架 store 暴露 apply action

系统 MUST 提供 `useFrameworkStore`，内部包装 `frameworkRepo`，暴露 `applyFramework(frameworkId, planId?)` action。

框架实体数据走 `useFrameworks()` hook（v1.0 4 套内置 + meta.seeded 幂等保证）。

#### Scenario: 应用框架生成 Tiptap 文档

- **GIVEN** 框架 `'fw_review'` 存在
- **WHEN** 调 `useFrameworkStore.getState().applyFramework('fw_review', 'p_abc')`
- **THEN** 返回 Tiptap JSON 文档（按 `sections` 顺序生成 H1 / H2 + 引导问题）
- **AND** 若传入 `planId`，将 Plan 的 `title` / `description` / `progress` 等字段注入占位符
- **AND** 同事务内 `frameworks.useCount` +1

#### Scenario: 列出全部框架

- **GIVEN** `frameworks` 表有 4 条种子
- **WHEN** 组件调 `useFrameworks()`
- **THEN** 返回 4 条 `Framework`，按 category 顺序：review → habit → note → summary
- **AND** 首次渲染可能返回 `undefined`（IndexedDB 异步），UI 需容忍

---

### Requirement: 标签 store 暴露 CRUD action

系统 MUST 提供 `useTagStore`，内部包装 `tagRepo`，暴露 `createTag` / `deleteTag` action。

标签实体数据走 `useTags()` hook。

#### Scenario: 创建重复名称标签抛 CONFLICT

- **GIVEN** Tag 表中已存在 `name = '技术'`
- **WHEN** 调 `useTagStore.getState().createTag({ name: '技术', color: '#FF0000' })`
- **THEN** 底层 `tagRepo.create` 抛 `AppError({ code: 'CONFLICT' })`
- **AND** `useTagStore.error` 字段被填充
- **AND** 异常继续向上抛

#### Scenario: 删除标签级联清理

- **GIVEN** Tag `t_tech` 被 Plan `p_001` 与 Blog `b_001` 引用
- **WHEN** 调 `useTagStore.getState().deleteTag('t_tech')`
- **THEN** Tag 被删除，事务内 `p_001.tagIds` 与 `b_001.tagIds` 自动移除 `'t_tech'`
- **AND** `useTags()` 返回的列表不再含 `t_tech`

---

### Requirement: 附件 store 暴露 upload + URL 缓存

系统 MUST 提供 `useAttachmentStore`，内部包装 `attachmentRepo`，暴露 `uploadAttachment` / `deleteAttachment` / `getObjectURL` action + `objectUrls: Map<ID, string>` 缓存。

附件实体数据走 `useAttachmentsForBlog(blogId)` hook。

#### Scenario: 上传图片附件

- **GIVEN** Blog `b_001` 存在
- **WHEN** 调 `useAttachmentStore.getState().uploadAttachment('b_001', file)` 其中 `file` 是 `File` 实例
- **THEN** `attachmentRepo.upload` 从 File 构造 Attachment（含 mimeType / size / blob）
- **AND** 新 Attachment 写入 `attachments` 表
- **AND** `useAttachmentsForBlog('b_001')` 自动出现新附件

#### Scenario: getObjectURL 缓存 + 配对 revoke

- **GIVEN** Attachment `att_1` 存在
- **WHEN** 调 `useAttachmentStore.getState().getObjectURL('att_1')`
- **THEN** `URL.createObjectURL(blob)` 返回 string URL，存入 `objectUrls` Map（key='att_1'）
- **AND** 同一 ID 再次调用返回缓存的 URL（不重新创建）
- **AND** 调 `useAttachmentStore.getState().revokeAll()` 时遍历 Map 调 `URL.revokeObjectURL` 并清空

#### Scenario: 组件卸载时调用 revokeAll

- **NOTE**：v1.0 不强制，组件层管理 ObjectURL 生命周期由下个 change 决定。store 提供 `revokeAll` 方法备用。

---

### Requirement: UI store 持久化偏好设置

系统 MUST 提供 `useUIStore`（Zustand + `persist` 中间件），持有视图模式 / 主题 / 主色 / 侧边栏折叠 / 抽屉栈。

`persist` localStorage key 为 `planote-ui`，**白名单**字段：`viewMode` / `theme` / `primaryColor` / `sidebarCollapsed`；`drawerStack` **不**持久化（避免反序列化后出现"幽灵抽屉"）。

#### Scenario: 视图模式持久化

- **GIVEN** `localStorage['planote-ui']` 为空（首次访问）
- **WHEN** 调 `useUIStore.getState().setViewMode('table')`
- **THEN** `viewMode` 立即变为 `'table'`
- **AND** `localStorage['planote-ui']` 写入 `{ state: { viewMode: 'table', ... }, version: 1 }`
- **WHEN** 刷新页面
- **THEN** `useUIStore` 初始化时从 localStorage 恢复 `viewMode = 'table'`

#### Scenario: 抽屉不持久化

- **GIVEN** 抽屉栈有 1 个 `{ id: 'framework', props: {...} }`
- **WHEN** 刷新页面
- **THEN** `useUIStore` 初始化时 `drawerStack` 为 `[]`（localStorage 不含 drawerStack）
- **AND** 用户必须重新打开抽屉（避免持久化中"幽灵 UI"）

#### Scenario: 抽屉栈 z-index 管理

- **GIVEN** `drawerStack` 初始为 `[]`
- **WHEN** 调 `openDrawer('framework')` → `openDrawer('settings')`
- **THEN** `drawerStack` 变为 `[{ id: 'framework' }, { id: 'settings' }]`
- **AND** 调 `closeTopDrawer()` 移除最后一个（`settings`），栈变为 `[{ id: 'framework' }]`
- **AND** 调 `closeAllDrawers()` 清空栈

#### Scenario: 主题与主色切换

- **WHEN** 调 `setTheme('dark')` 或 `setPrimaryColor('#10B981')`
- **THEN** 字段立即更新，且持久化到 localStorage
- **NOTE**：v1.0 theme 仅占位，v1.1 才真正应用到 CSS 变量

---

### Requirement: useLiveQuery hook 自动响应 IndexedDB 变化

系统 MUST 提供 8 个 useLiveQuery hook：`usePlan` / `usePlans` / `useItemsForPlan` / `useBlog` / `useBlogs` / `useFrameworks` / `useTags` / `useAttachmentsForBlog`。

每个 hook 内部调 `dexie-react-hooks` 的 `useLiveQuery`，首次渲染返回 `undefined`（IndexedDB 异步打开），数据回来后自动重渲染，跨 Tab 同步免费。

#### Scenario: 勾选事项后 usePlan 自动更新

- **GIVEN** 组件订阅 `usePlan('p_001')`，返回 Plan `p_001`（progress=50）
- **WHEN** 任意代码（组件 / store / 另一个 Tab）调 `itemRepo.toggle('i_x')` 使 `p_001` 的 progress 变为 75
- **THEN** Dexie 写完成后 `liveQuery` 通知 `usePlan` 重渲染
- **AND** 组件收到新 Plan（progress=75），**无需**手动 refetch

#### Scenario: useItemsForPlan 在 plan 改变时重新查询

- **GIVEN** 组件 `useItemsForPlan('p_001')` 返回 Item[]
- **WHEN** 组件 props 变化，`planId` 改为 `'p_002'`
- **THEN** `useLiveQuery` 的依赖数组 `[planId]` 触发重新订阅
- **AND** 返回 `'p_002'` 下的 Item[]

#### Scenario: usePlans 首帧返回 undefined

- **GIVEN** 浏览器刚打开 `IndexedDB` 还未 ready
- **WHEN** 组件首次渲染时调 `usePlans()`
- **THEN** 返回 `undefined`（不是空数组）
- **AND** UI 必须容忍：`if (plans === undefined) return <Skeleton />`

---

### Requirement: 派生 selector 模式

业务 store 暴露的 state 中**不**含派生数据（如"按紧急度排序的 plans"）；派生计算 MUST 由调用方在组件中用 `useMemo` + `usePlans()` 现算，避免双源真相。

v1.0 暂不实现通用派生 hook（如 `usePlansByUrgency`）；下个 `add-data-binding-dashboard` change 按需补。

#### Scenario: Dashboard 派生统计

- **GIVEN** 组件订阅 `usePlans()` 返回 N 条 Plan
- **WHEN** 组件用 `useMemo` 计算 `totalPlans / activePlans / completedPlans` 三个数字
- **THEN** 每次 `usePlans()` 返回值变化时 `useMemo` 重算
- **AND** 派生数字与原数组**始终一致**（同源）

#### Scenario: 不在 store 里缓存派生数据

- **NOTE**：禁止在 `usePlanStore` state 中加 `byUrgency: Plan[]` 字段。这样会导致写操作后必须手动同步两份数据。派生永远用 selector + useMemo。

---

### Requirement: 错误处理统一归一化

所有 store action MUST 在 try/catch 块中归一化错误（`toAppErrorPayload`），并：

1. 填充 store 内部 `error` 字段
2. 调 `console.error` 打印完整 payload
3. 重新抛出原异常（让调用方也能 catch）

#### Scenario: AppError 被正确归一化

- **GIVEN** 底层 `planRepo.create` 抛 `new AppError({ code: 'NOT_FOUND', message: 'plan_x' })`
- **WHEN** 调 `usePlanStore.getState().createPlan(input)`（实际 NOT_FOUND 不会从 create 抛，这里仅验证错误归一化机制）
- **THEN** 假设底层抛 `AppError`，`toAppErrorPayload` 返回 `e.error`（结构体本身）
- **AND** `usePlanStore.error` 字段被填充为该结构体
- **AND** `console.error` 打印

#### Scenario: 非 AppError 异常归一化为 UNKNOWN

- **GIVEN** 底层抛 `new Error('network fail')`（v1.0 不会发生，但 v1.1 网络层要兼容）
- **WHEN** `toAppErrorPayload(e)` 执行
- **THEN** 返回 `{ code: 'UNKNOWN', message: 'network fail', cause: Error实例 }`
- **AND** store 仍正确填充 error 状态

#### Scenario: 异常继续向上抛

- **GIVEN** store action 内部 catch 到异常
- **WHEN** catch 块执行 `set({ error })` + `console.error` 后
- **THEN** `throw e` 让异常继续向上传播
- **AND** 调用方的 try/catch 仍能接住

---

