## Why

Planote 的核心叙事是「计划 → 完成 → 沉淀为博客」，但当前 `/plans/:id` 路由仅是一个占位页（`PlaceholderPage`），用户**只能看不能做**——上一轮 `add-plan-list-view` 让用户能在列表里浏览全量计划矩阵，但点击进详情页后没有任何「推进计划」的能力。事项勾选是 Planote 用户最高频的交互，没有它整个产品是「只读看板」。

具体场景缺失：

- **事项勾选是核心交互**：PRD §4.4 明确「事项勾选 → 进度联动 → 100% 触发总结 CTA」是 Planote 区别于通用 TODO 工具的关键闭环。当前 `useItemsForPlan` hook 已就位（add-data-layer-dexie / add-zustand-stores），但详情页缺位。
- **进度环是核心视觉**：原型 `plan-detail.html` 中央的大进度环（SVG circle + stroke-dasharray）是用户对「完成感」的核心期待，需要把它从「Dashboard 数字卡进度条」升级为「详情页中央圆形进度环」。
- **100% 完成触发金色横幅**：spec §7.3 明确「100% 完成时显示金色横幅 + 「生成总结博客」CTA」，这是 Planote「计划 → 博客」闭环的入口按钮。
- **关联博客区**：完成计划后用户最自然的下一步是「看看我从这个计划写过哪些博客」，需要详情页提供关联博客的可视入口。
- **框架抽屉（v1.0 起步）**：从详情页点「生成总结博客」应唤起右侧抽屉选择框架（4 套内置：项目复盘/21天习惯/读书笔记/月度总结），v1.0 抽屉只到「打开/选择/确认」流程，框架内容由后续 `add-blog-generation-flow` 落地。

本 change 落地后用户能：① 进入 `/plans/:id` 看到完整详情；② 勾选/取消事项实时联动进度环与 Plan.progress；③ 进度 100% 时自动出现金色 CTA 横幅；④ 看到该计划已关联的博客列表；⑤ 点 CTA 唤起「框架选择」抽屉准备生成博客。

## What Changes

### 1. `/plans/:id` 路由 + 详情页骨架

- 路径：`src/pages/plans/PlanDetail.tsx`（当前是 PlaceholderPage，本 change 替换为真实实现）
- 布局（自上而下）：
  - 顶栏：返回按钮 + 计划标题 + 层级/维度/状态 badges + 「编辑」按钮
  - 中央区：左侧大进度环 + 关键数据卡（坚持天数、累计里程、已完成/总事项、截止日期、关联博客数）
  - 中部：事项列表（可勾选）+ 紧急度左侧彩边
  - 底部：关联博客区（卡片网格，空时引导）
  - 100% 完成时：顶部金色横幅 + 「✨ 生成总结博客」CTA
- 复用 `add-plan-list-view` 已建的视觉组件（紧急度色边、layer+dim badges、状态徽章）

### 2. 事项勾选 + 进度联动（最核心交互）

- 路径：`src/features/plan/hooks/useToggleItem.ts`
- 行为：
  - 单击事项 checkbox → 乐观更新（UI 立即反映）+ `itemRepo.toggle(id)`
  - toggle 后**自动调用** `planRepo.recomputeProgress(planId)` 重算并写回 Plan.progress
  - 失败时回滚 UI 状态 + console.error + 错误 toast
  - `useLiveQuery` 自动推送新数据 → 进度环 + Plan.progress 同步更新
- 状态：3 种（`pending` / `in_progress` / `done`），UI 状态机：
  - 未勾选 → 勾选 = 标记 done（自动从 in_progress 改 done）
  - 勾选 → 取消 = 标记 pending（清除 completedAt）
  - 「标记进行中」/「标记待办」按钮（hover 时显示）

### 3. 进度环组件（SVG）

- 路径：`src/components/plans/ProgressRing.tsx`
- props: `{ value: number; size?: number; strokeWidth?: number; showLabel?: boolean }`
- 实现：SVG `<circle>` + `stroke-dasharray` 计算（C = 2πr, offset = C × (1 - pct/100)）
- 视觉：大环（160px）+ 中心数字百分比 + 副标题「完成度」
- 颜色：0-49% stone-700，50-99% brand-900，100% emerald-500 + 动画

### 4. 100% 完成金色横幅

- 路径：`src/features/plan/components/CompletionBanner.tsx`
- 触发条件：`plan.progress >= 100 && plan.status !== 'done'`（首次达到 100% 时显示）
- 视觉：amber-50 背景 + 左侧 4px 琥珀色边 + Sparkles icon + 文案「恭喜！计划已完成」+ 主 CTA 按钮「✨ 生成总结博客」
- 行为：点 CTA → `useUIStore.openDrawer('framework', { sourcePlanId })`
- 关闭按钮（X）：仅隐藏横幅（不重置 progress），存到 `sessionStorage` 避免反复弹出
- 横幅消失不影响详情页其他功能

### 5. 关键数据区（只读展示）

- 路径：`src/features/plan/components/PlanKeyMetrics.tsx`
- 5 个数据点（网格布局）：
  - 已完成事项 / 总事项
  - 进度百分比
  - 坚持天数（v1.0 简化为 `Math.floor((now - createdAt) / 86400e3)`）
  - 截止日期 / 剩余天数
  - 关联博客数
- 全部只读（编辑留给 `add-plan-edit-form`）

### 6. 事项列表 + 勾选组件

- 路径：`src/features/plan/components/ItemChecklist.tsx`
- 单条组件：`src/features/plan/components/ItemRow.tsx`
- 视觉：3 列网格（checkbox + 标题 + 截止 tag）；勾选用原生 `<input type="checkbox">` + 自定义样式
- 状态可视化：done = 标题 line-through + 灰色；doing = 左侧蓝边 + 进行中 badge
- 排序：按 `order asc`（ItemRepo 写入时已用复合索引 `[planId+order]`）

### 7. 关联博客区

- 路径：`src/features/plan/components/PlanBlogsSection.tsx`
- 入参：当前 plan 的 `blogIds` 列表
- 实现：通过 `useBlog` 单个订阅（避免一次拉全部），或更简单的 `useLiveQuery` 直接从 `blogRepo.listByIds(ids)`
- 卡片网格：3 列（与 Dashboard「最近博客」一致），点击 → `/blogs/:id`
- 空态：EmptyState compact + 「生成总结博客」CTA（复用抽屉入口）

### 8. 框架抽屉（右侧）

- 路径：`src/components/shell/Drawer.tsx`（通用）+ `src/features/framework/components/FrameworkDrawer.tsx`（业务）
- 视觉：右侧 480px 宽抽屉 + 背景半透明遮罩 + ESC 关闭 + 背景点击关闭
- 4 套内置框架卡片：项目复盘 / 21天习惯 / 读书笔记 / 月度总结
- 行为（v1.0）：
  - 选框架 → 控制台 log「v1.1 接入 BlogEditor」+ 关闭抽屉
  - 不实现真实博客创建流程（v1.0 简化）
- 复用 `useUIStore.openDrawer / closeDrawer`（已存在）

### 9. 路由直达 + 加载态

- 复用 `add-app-shell` 的 `<Suspense>` + `<LoadingOverlay>` 体系
- 数据未就绪（liveQuery 首帧）→ `<PlanDetailSkeleton />`（复用 add-plan-list-view 模式）
- ID 不存在（plan not found）→ `<EmptyState variant="default" icon={AlertCircle} title="找不到该计划" />` + 返回按钮

## Scope

**In Scope**：

- `/plans/:id` 路由页面（替换 PlaceholderPage）
- 1 个 hook `useToggleItem`（事项勾选 + 进度重算联动）
- 1 个组件 `ProgressRing`（SVG circle + 进度数字）
- 1 个组件 `CompletionBanner`（100% 完成横幅）
- 1 个组件 `PlanKeyMetrics`（关键数据卡 5 个）
- 1 个组件 `ItemChecklist` + `ItemRow`（事项列表）
- 1 个组件 `PlanBlogsSection`（关联博客区）
- 1 个通用 `Drawer`（右侧抽屉壳）
- 1 个 `FrameworkDrawer`（业务抽屉，4 套框架卡片）
- 1 个 `PlanDetailSkeleton`
- spec 增量：新增 `plan-detail` capability 的 8-10 Requirements

**Out of Scope**（明确划清边界）：

- 编辑/创建表单 → 下一轮 `add-plan-edit-form`
- 生成博客的完整流程（Tiptap 编辑器接入、章节填充、自动从 plan 抓取数据）→ v1.1 `add-blog-generation-flow`
- 事项拖拽排序 → v1.1
- 事项的增删改（只做勾选状态切换）→ `add-item-crud`
- 附件上传（Sprint 3）
- 标签筛选 / 跨计划视图 → v1.1
- 框架自定义（v1.0 4 套内置）→ v1.2
- 评论 / 协作（v2.0+）
- 不写单测（Sprint 1-2 暂不强制）
- 不引新依赖（progress ring 用原生 SVG；Drawer 用原生 div + transition）

## Acceptance Criteria

- [ ] **AC-1**：`/plans/:id` 路由可访问（ID 存在时），页面包含顶栏 + 进度环 + 关键数据 + 事项列表 + 关联博客
- [ ] **AC-2**：事项勾选/取消实时联动：UI 立即反映 + `planRepo.recomputeProgress` 触发 + Plan.progress 字段更新 + 进度环同步
- [ ] **AC-3**：事项「标记进行中」/「标记待办」hover 按钮可见且工作
- [ ] **AC-4**：100% 完成时显示金色 CompletionBanner，含「生成总结博客」CTA
- [ ] **AC-5**：点 CTA → 右侧抽屉滑入 + 4 套框架卡片可选 + ESC 关闭 + 背景点击关闭
- [ ] **AC-6**：选中框架后控制台 log「v1.1 接入」并自动关闭抽屉（v1.0 简化）
- [ ] **AC-7**：关联博客区显示当前 plan 的 blogIds 对应博客卡片；点击进入 `/blogs/:id`
- [ ] **AC-8**：ID 不存在时显示 EmptyState「找不到该计划」+ 返回 `/plans` 按钮
- [ ] **AC-9**：数据加载中显示 PlanDetailSkeleton
- [ ] **AC-10**：进度环 SVG 渲染正确，0% → 100% 角度从 0° 顺时针到 360°
- [ ] **AC-11**：`pnpm build` 0 error，`pnpm lint` 0 warning（基线对齐）
- [ ] **AC-12**：`openspec validate add-plan-detail-view --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| 勾选 → 进度重算存在异步时序差（用户连续点 5 次） | 中 | useToggleItem 内置 debounce 200ms + 取消策略（最后一次 toggle 触发重算） |
| Plan.progress 字段不在 useLiveQuery 订阅范围内时不同步 | 中 | 依赖 `usePlan(id)` hook（已存在），用 planRepo.recomputeProgress 写回触发 liveQuery 重发 |
| 100% 横幅反复弹出打扰用户 | 低 | sessionStorage 记录「本次会话已关闭」+ 跨会话重新显示 |
| 抽屉打开 + 路由切换导致「幽灵抽屉」 | 低 | `useUIStore.closeAllDrawers` 在路由变化 effect 中调用（已存在） |
| 进度环 SVG 圆周计算边界 | 低 | 测试 0% / 50% / 100% 三个边界 + 负值/超 100 兜底 clamp |
| 关联博客为空时不显示空态 | 低 | 复用 EmptyState compact 兜底（与列表页一致） |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：ItemRepo.toggle / PlanRepo.recomputeProgress / BlogRepo.listByIds
  - `add-zustand-stores`：useItemStore.toggle / usePlanStore.recomputeProgress
  - `add-data-binding-dashboard`：usePlan(id) hook（已存在）
  - `add-app-shell`：EmptyState / LoadingOverlay / Skeleton 通用组件
  - `add-plan-list-view`：紧急度色边 / 标签 / 状态徽章视觉模式（视觉对齐）

- **下游（待启动）**：
  - `add-plan-edit-form`：从详情页「编辑」按钮进入
  - `add-blog-generation-flow`：从抽屉「生成总结博客」真实创建博客（Tiptap 接入）
  - `add-item-crud`：事项的增删改（v1.0 只做勾选状态切换）

## Out of Scope Reminder

- 不实现编辑/创建表单（`add-plan-edit-form` 接手）
- 不实现生成博客的 Tiptap 流程（v1.1 `add-blog-generation-flow` 接手）
- 不实现事项的增删（`add-item-crud` 接手）
- 不实现拖拽排序（v1.1）
- 不实现自定义框架（v1.2）
- 不写单测
- 不引新依赖
