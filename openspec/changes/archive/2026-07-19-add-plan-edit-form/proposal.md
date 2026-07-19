## Why

Planote 的核心叙事是「**计划 → 完成 → 沉淀为博客**」，但当前闭环只覆盖「读 + 勾选」——上一轮 `add-plan-detail-view` 让用户能浏览详情 + 勾选事项 + 触发生成博客 CTA，但**没有创建和编辑入口**：

- `/plans/new` 路由当前是 PlaceholderPage
- `/plans/:id/edit` 路由当前是 PlaceholderPage
- 「编辑」按钮（详情页顶栏）跳过去仍是占位页

PRD §4.2 + ux-guidelines.md §2 Flow A「Step 2 · 三步表单填写」明确计划创建是「行动 → 沉淀」主流程的入口步骤；没有它整个产品是「只读看板 + 只读详情」。表单是闭环的最后一环。

具体场景缺失：

- **三步骤表单是 PRD 明确要求**：基础信息 → 类型与维度 → 拆解事项。每步只问最关键的问题，避免长表单的认知负担。
- **事项拆解是计划价值的核心**：把抽象目标拆为可执行清单，否则进度环永远是 0%。
- **草稿保存**：用户填到一半被中断，下次进入恢复——v1.0 简化为 localStorage。
- **关联上级**：长期计划 → 中期 → 短期的拆解关系（v1.0 字段已留，UI 待补）。

本 change 落地后用户能：① 从仪表盘 / 列表 / 顶栏 `+` 进入 `/plans/new` 走三步表单创建计划；② 从详情页「编辑」按钮进入 `/plans/:id/edit` 修改计划；③ 草稿自动保存，中断后恢复；④ 保存后跳到 `/plans/:id` 详情页继续推进。

## What Changes

### 1. 路由 + 编辑页骨架

- 路径：`src/pages/plans/PlanEdit.tsx`（当前 PlaceholderPage，替换为真实实现）
- 模式：`mode: 'create' | 'edit'`（已存在的 prop 语义）
  - create：表单空白 + 草稿自动保存
  - edit：表单预填现有 plan + 草稿覆盖原值
- 顶栏：返回按钮（create→/plans, edit→/plans/:id）+ 标题「新建计划」/「编辑计划」+ 主操作「保存」（最后一步才出现）
- 步骤指示器：3 步线性导航（基础信息 → 类型维度 → 事项拆解），可前后切换

### 2. 步骤状态机

- 状态：`step: 1 | 2 | 3`，每步独立校验
- 切换规则：
  - step 1 → step 2：标题非空（≥1 字）+ 描述可选
  - step 2 → step 3：level + timeDim 都已选
  - step 3 → submit：至少 1 个事项
- 切换方向：
  - 「下一步」按钮（disabled 当不满足当前步校验）
  - 「上一步」按钮（任意步可点）
  - 步骤指示器可点击跳回已完成步骤（pending 步不可跳）
- 离开提示：表单脏（dirty）+ 路由变化 → window.confirm

### 3. 步骤 1：基础信息表单

- 字段：
  - `title`（必填，max 100 字）
  - `description`（可选，max 500 字，textarea）
  - `startDate`（可选，date input）
  - `endDate`（可选，date input，> startDate）
- 视觉：双列网格（title 跨满 + description 跨满 + dates 并列）
- 错误：内联红字 + 字段红边

### 4. 步骤 2：类型 + 维度选择

- `level`：3 卡片单选（短期 / 中期 / 长期），附简短说明
- `timeDim`：4 卡片单选（每日 / 每月 / 每年 / 一次性）
- 视觉：两段卡片网格，3+4 = 7 个大按钮（与 prototype plan-edit.html 视觉一致）
- 选中态：brand-900 背景 + 白色文字
- 关联：选 `level=long` 时隐藏「关联上级」入口（v1.0 简化）；其他 level 暂未启用

### 5. 步骤 3：事项拆解

- 列表：可增删可编辑的事项
- 单条 UI：input（标题） + date input（截止）+ 拖拽 handle（v1.0 简化：只允许上下移动按钮）+ 删除按钮
- 新增：底部虚线「+ 添加事项」按钮 + 默认 1 个空事项（避免空白恐惧）
- 必填校验：≥ 1 个非空 title
- 排序：上移/下移按钮（v1.0 不做拖拽，留 add-item-crud 接手）
- 视觉：与 prototype plan-edit.html 事项行对齐

### 6. 高级选项（折叠）

- 折叠入口：步骤 3 底部「高级选项」
- 内容（v1.0 占位 / 部分留 TODO）：
  - 「完成后自动生成博客」checkbox（v1.0 仅 UI 留存，add-blog-generation-flow 接管）
  - 「每日提醒」checkbox（v1.0 仅 UI 留存，v1.1 通知功能）
  - 「关联到上级计划」select（v1.0 简化为下拉 + 选完填入 parentPlanId）

### 7. 草稿自动保存

- 触发：表单 dirty + 500ms debounce
- 存储：localStorage key `planote:plan-edit:draft:<planId|none>`
- 内容：完整表单状态（title / description / step / items / level / timeDim / dates）
- 加载：进入 `/plans/new` 或 `/plans/:id/edit` 时优先读草稿；若 mode=edit 且草稿 ID 不匹配则忽略
- 清除：成功保存后清除草稿

### 8. 提交 + 跳转

- 校验：3 步全部满足
- 调用：`usePlanStore.createPlan` / `updatePlan`
- 成功后：清草稿 + navigate(`/plans/:id`)（edit 模式）或 navigate(`/plans/:newId`)（create 模式）
- 失败：toast 错误（v1.0 简化为 store 内 console.error）+ 不跳转

### 9. 复用与改造

- 复用 add-plan-detail-view 的：
  - 顶栏视觉（breadcrumb / badges）模式 → PlanEditTopBar
  - EmptyState / Skeleton / LoadingOverlay（add-app-shell）
- 复用 add-data-layer-dexie 的 PlanCreateInput / PlanUpdatePatch
- 复用 add-zustand-stores 的 usePlanStore

## Scope

**In Scope**：

- 路由 /plans/new + /plans/:id/edit 真实实现
- 步骤指示器组件 + 步骤状态机
- 3 个步骤表单（基础信息 / 类型维度 / 事项拆解）
- 事项增删（v1.0 不含拖拽，含上下移按钮）
- 高级选项折叠（v1.0 占位 UI，部分功能留 TODO）
- 草稿自动保存（localStorage debounce 500ms）
- 提交后跳转
- 路由变化 dirty 提示
- spec 增量：新增 `plan-edit` capability 的 10-12 Requirements

**Out of Scope**（明确划清边界）：

- 模板创建（v1.2 之后）— v1.0 空白表单
- 协作编辑（v2.0+）
- 事项拖拽排序（v1.1 / add-item-drag-sort）
- 事项复杂属性（描述、附件、sub-item，v1.1+）
- 高级选项的真实功能（每日提醒 / 自动生成博客，v1.1 通知 / add-blog-generation-flow）
- 关联上级的循环校验（v1.0 简化为直接填字段，不防成环）
- 不写单测
- 不引新依赖

## Acceptance Criteria

- [ ] **AC-1**：`/plans/new` 路由可访问，显示三步表单第 1 步
- [ ] **AC-2**：`/plans/:id/edit` 路由可访问，预填现有 plan
- [ ] **AC-3**：3 步可前后切换（步骤指示器 + 上下一步按钮）
- [ ] **AC-4**：步骤 1 标题为空时「下一步」disabled
- [ ] **AC-5**：步骤 2 未选 level / timeDim 时「下一步」disabled
- [ ] **AC-6**：步骤 3 至少 1 个非空 title 才能「保存」
- [ ] **AC-7**：事项可增可删（v1.0 含上下移按钮）
- [ ] **AC-8**：tag 可加可删（v1.0 简化为 input + 逗号分隔）
- [ ] **AC-9**：关联上级可选（select 选完填入 parentPlanId）
- [ ] **AC-10**：草稿自动保存（500ms debounce + localStorage）
- [ ] **AC-11**：路由变化 + dirty → 浏览器 confirm 提示
- [ ] **AC-12**：create 模式保存后跳 `/plans/:newId`
- [ ] **AC-13**：edit 模式保存后跳 `/plans/:id`
- [ ] **AC-14**：保存失败不跳转 + 错误提示
- [ ] **AC-15**：`pnpm build` 0 error，`pnpm lint` 0 warning
- [ ] **AC-16**：`openspec validate add-plan-edit-form --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| 草稿与 edit 模式 ID 混淆 | 中 | 草稿 key 含 `planId\|none`，不匹配时忽略 |
| 草稿覆盖最新数据 | 低 | 进入 edit 模式时优先用 plan store 数据，草稿仅作恢复 |
| 步骤状态机死循环 | 低 | step 1/2/3 用数字 + 边界保护 |
| 事项空字符串绕过校验 | 低 | submit 时 trim + filter 长度 > 0 |
| localStorage 容量 | 极低 | 单草稿 < 10KB，远低于 5MB 限制 |
| 关联上级成环 | 低 | v1.0 简化为不校验，留 v1.1 拓扑检查 |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：PlanRepo.create / update / delete
  - `add-zustand-stores`：usePlanStore.createPlan / updatePlan
  - `add-app-shell`：EmptyState / LoadingOverlay / 步骤指示器通用基础
  - `add-plan-detail-view`：TopBar 视觉模式 + 紧急度/层级配色

- **下游（待启动）**：
  - `add-item-crud`：事项的完整增删改 + 拖拽
  - `add-blog-generation-flow`：完成自动生成博客的真实流程
  - `add-tag-module`：标签的独立模块（v1.0 表单内联即可）

## Out of Scope Reminder

- 不实现模板创建（v1.2 之后）
- 不实现协作编辑（v2.0+）
- 不实现事项拖拽（v1.1 / add-item-drag-sort）
- 不实现复杂事项属性（v1.1+）
- 不实现高级选项的真实功能（v1.1 通知 / add-blog-generation-flow）
- 不实现关联上级成环校验
- 不写单测
- 不引新依赖
