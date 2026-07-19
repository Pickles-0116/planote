# Tasks · 计划编辑表单

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. 路由 + 编辑页骨架

- [ ] 1.1 `src/pages/plans/PlanEdit.tsx` 替换 PlaceholderPage
  - 接受 `mode: 'create' | 'edit'` prop
  - 顶层 hooks：useParams + usePlan(id)（edit 模式）+ usePlanEditDraft
  - 布局：PlanEditTopBar + Stepper + 步骤主体 + 底部操作区
  - 加载态：`<PlanEditSkeleton />`
  - ID 不存在：`<EmptyState>` + 返回按钮
  - create 模式：直接渲染空白表单
- [ ] 1.2 `src/pages/plans/PlanEditSkeleton.tsx` → 骨架屏
  - 标题 + 步骤指示器 + 4 个表单项占位

## 2. 草稿持久化 hook

- [ ] 2.1 `src/features/plan/hooks/usePlanEditDraft.ts` → 草稿状态机
  - 内部 useState 持有 FormState
  - mount 时自动 loadDraft（create 模式从 `planote:plan-edit:draft:none`，edit 模式从 `planote:plan-edit:draft:<id>`）
  - 500ms debounce 写 localStorage
  - 暴露 `{ state, setState, clearDraft }`
  - dirty 标志自动维护（与 initialState 对比）

## 3. 步骤指示器组件

- [ ] 3.1 `src/components/shell/Stepper.tsx` → 通用 3 步指示器
  - props: `{ current, completed, onJump, steps }`
  - 3 圆点 + 横线连接 + label/description
  - 3 种状态：active / completed / pending
  - pending 步骤不可点击；completed 可点击跳回
  - a11y：role="navigation" + aria-current="step"

## 4. 顶栏

- [ ] 4.1 `src/features/plan/components/PlanEditTopBar.tsx` → 顶栏
  - props: `{ mode, onBack, saving, canSubmit, onSubmit }`
  - 视觉：返回 + 标题（新建/编辑）+ 右侧「保存」按钮（步骤 3 可见）
  - 保存中：按钮 spinner + disabled
  - 复用 add-plan-detail-view 的 breadcrumb 模式

## 5. 步骤 1：基础信息表单

- [ ] 5.1 `src/features/plan/components/Step1BasicInfo.tsx` → 步骤 1 表单
  - props: `{ state, onChange }`
  - 字段：title（max 100）+ description（max 500）+ startDate + endDate
  - 双列网格布局
  - 内联校验：title 空白 / endDate <= startDate
  - 输入触发 dirty + 草稿保存

## 6. 步骤 2：类型 + 维度选择

- [ ] 6.1 `src/features/plan/components/Step2TypeDim.tsx` → 步骤 2 卡片
  - props: `{ level, timeDim, onChange }`
  - 3 张 level 卡片（短期 / 中期 / 长期）+ 4 张 timeDim 卡片（每日 / 每月 / 每年 / 一次性）
  - 单选切换：再次点击取消选择
  - 选中态：brand-900 背景 + 白字 + 选中 icon
  - hover 态：shadow + 边框变色

## 7. 步骤 3：事项拆解

- [ ] 7.1 `src/features/plan/components/Step3Items.tsx` → 步骤 3 事项列表
  - props: `{ items, onAdd, onUpdate, onRemove, onMove }`
  - 单条 UI：input（title）+ date input（dueDate）+ 上移/下移/删除按钮
  - 底部虚线「+ 添加事项」按钮
  - 默认空列表 + 点击添加
  - 校验提示：至少 1 个非空 title
  - 拖拽 handle 占位 disabled（v1.1 接管）
- [ ] 7.2 `src/features/plan/components/AdvancedOptions.tsx` → 高级选项折叠
  - props: `{ state, onChange, parentCandidates }`
  - 折叠入口 + 展开后 3 字段
  - 2 个 checkbox disabled（v1.1 启用）
  - parentPlanId select 启用

## 8. 提交与跳转

- [ ] 8.1 `src/features/plan/hooks/usePlanEditSubmit.ts` → 提交流程
  - props: `{ mode, planId, state, onSuccess }`
  - 校验：canSubmit(state)
  - create 模式：createPlan + Promise.all(createItem × N)
  - edit 模式：updatePlan（仅 plan 字段，不动 items）
  - 成功：clearDraft + navigate
  - 失败：console.error + 不 clearDraft + 不 navigate
- [ ] 8.2 `src/pages/plans/PlanEdit.tsx` 整合 usePlanEditSubmit
  - 步骤 3 底部「保存」按钮 onClick → 调 usePlanEditSubmit
  - 创建模式下提交后清空草稿 + 跳 `/plans/:newId`
  - 编辑模式下提交后清空草稿 + 跳 `/plans/:id`

## 9. 离开提示

- [ ] 9.1 `src/features/plan/hooks/useUnsavedGuard.ts` → 离开守卫
  - props: `{ when: boolean }`
  - 监听 `beforeunload` 事件（关闭 tab / 刷新）
  - 暴露 trigger 函数（路由变化时调用）
  - `when=true` 时弹浏览器原生 confirm
- [ ] 9.2 `src/pages/plans/PlanEdit.tsx` 集成 useUnsavedGuard
  - dirty 状态作为 when 入参
  - 顶栏返回按钮 onClick 调 trigger

## 10. 验证

- [ ] 10.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [ ] 10.2 `pnpm lint` 0 error / 0 warning
- [ ] 10.3 手动验证：访问 `/plans/new` 走完 3 步 → 保存 → 跳详情页
- [ ] 10.4 手动验证：访问 `/plans/:id/edit` 预填 → 修改标题 → 保存 → 跳详情
- [ ] 10.5 手动验证：步骤 1 标题空白时「下一步」disabled
- [ ] 10.6 手动验证：步骤 2 level/timeDim 未选时「下一步」disabled
- [ ] 10.7 手动验证：步骤 3 全空事项时「保存」disabled
- [ ] 10.8 手动验证：添加 3 个事项，删除中间一个，调整顺序
- [ ] 10.9 手动验证：刷新页面，草稿自动恢复
- [ ] 10.10 手动验证：表单 dirty + 点顶栏返回 → 弹 confirm
- [ ] 10.11 手动验证：访问 `/plans/不存在/edit` → 显示空态
- [ ] 10.12 手动验证：编辑模式 + 草稿 key 不匹配 → 草稿忽略
- [ ] 10.13 `openspec validate add-plan-edit-form --strict` 通过

## 11. 提交与归档

- [ ] 11.1 `git add .` + `git commit -m "feat(plans): add plan edit form with 3-step wizard + items CRUD + draft autosave"`
- [ ] 11.2 `openspec archive add-plan-edit-form --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（新建路由可达）| 1.1 + 5.1 + 6.1 + 7.1 | 浏览器访问 |
| AC-2（编辑路由可达）| 1.1 + 4.1 + 5.1 + 6.1 | 浏览器 |
| AC-3（3 步切换）| 3.1 + 1.1 | 浏览器 |
| AC-4（标题必填）| 5.1 | 浏览器 |
| AC-5（level/timeDim 必选）| 6.1 | 浏览器 |
| AC-6（至少 1 个事项）| 7.1 + 8.1 | 浏览器 |
| AC-7（事项增删上下移）| 7.1 | 浏览器 |
| AC-8（标签可加可删）| 5.1 | 浏览器 |
| AC-9（关联上级可选）| 7.2 | 浏览器 |
| AC-10（草稿自动保存）| 2.1 | 浏览器 |
| AC-11（路由变化 dirty 提示）| 9.1 + 9.2 | 浏览器 |
| AC-12（create 后跳详情）| 8.1 + 8.2 | 浏览器 |
| AC-13（edit 后跳详情）| 8.1 + 8.2 | 浏览器 |
| AC-14（保存失败不跳转）| 8.1 | 浏览器 + 模拟失败 |
| AC-15（build + lint）| 10.1 + 10.2 | CLI |
| AC-16（openspec validate）| 10.13 | CLI |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（路由 + 骨架）| 0.3 | 复用 PlaceholderPage 模式 |
| 2（草稿 hook）| 0.3 | localStorage + debounce |
| 3（步骤指示器）| 0.2 | 通用组件 |
| 4（顶栏）| 0.15 | 复用详情页模式 |
| 5（步骤 1）| 0.3 | 4 字段 + 校验 |
| 6（步骤 2）| 0.4 | 7 卡片 + 状态切换 |
| 7（步骤 3）| 0.5 | 事项增删 + 高级选项 |
| 8（提交 + 跳转）| 0.3 | createPlan + createItem batch |
| 9（离开守卫）| 0.2 | beforeunload + confirm |
| 10（验证）| 0.4 | 13 项手动 + CLI |
| **合计** | **3.05 人天** | |
