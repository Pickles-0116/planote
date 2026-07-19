# Tasks · 计划详情页

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. 路由 + 详情页骨架

- [ ] 1.1 `src/pages/plans/PlanDetail.tsx` 替换 PlaceholderPage
  - 顶层 hooks：useParams + usePlan(id) + useItemsForPlan
  - 布局：顶栏 + Hero + 事项 + 关联博客 + 完成横幅（条件渲染）
  - 加载态：`<PlanDetailSkeleton />`
  - ID 不存在：`<EmptyState>` + 返回按钮
  - 复用 add-app-shell 的 `<Suspense>` + `<LoadingOverlay>` 体系
- [ ] 1.2 `src/pages/plans/PlanDetailSkeleton.tsx` → 骨架屏组件
  - 与 DashboardSkeleton 模式一致：标题 + Hero 圆 + 关键数据 5 卡 + 事项 5 行 + 博客 3 卡

## 2. 进度环组件

- [ ] 2.1 `src/components/plans/ProgressRing.tsx` → SVG 进度环
  - props: `{ value, size = 160, strokeWidth = 8, showLabel = true, animate = true }`
  - 2 个 `<circle>`：底层静态 + 顶层 stroke-dasharray
  - 颜色按 pct 切换：0-49 stone-700, 50-99 brand-900, 100 emerald-500
  - 中心文字（百分比 + "完成度"）
  - 100% 触发动画（CSS @keyframes 300ms）
  - value 越界兜底（clamp 0-100）

## 3. 事项勾选 + 联动 hook

- [ ] 3.1 `src/features/plan/hooks/useToggleItem.ts` → 勾选 + 进度重算联动
  - 包装 useItemStore.toggle + usePlanStore.recomputeProgress
  - 内置 200ms debounce（用户连点只算 1 次）
  - 失败时回滚 UI 状态 + console.error
  - 暴露 `{ toggle, setStatus }` 两个方法
- [ ] 3.2 `src/features/plan/components/ItemChecklist.tsx` → 事项列表容器
  - props: `{ items, onToggle, onSetStatus }`
  - 按 order asc 排序
  - 空态：EmptyState compact（无事项时）
- [ ] 3.3 `src/features/plan/components/ItemRow.tsx` → 单条事项
  - props: `{ item, onToggle, onSetStatus }`
  - 视觉：checkbox + 标题 + hover 状态切换按钮
  - 状态视觉：pending / doing / done（3 套配色）
  - a11y：checkbox 自定义样式 + aria-label

## 4. 100% 完成横幅

- [ ] 4.1 `src/features/plan/hooks/useCompletionBanner.ts` → 横幅显示状态
  - 入参：plan
  - 状态：sessionStorage `planote:plan-detail:banner-dismissed` 存 Set<planId>
  - 返回：`[shouldShow, dismiss]`
  - 跨 plan 互不干扰（按 planId 区分）
  - 路由变化时清空 dismissed（不持久化）
- [ ] 4.2 `src/features/plan/components/CompletionBanner.tsx` → 横幅视觉
  - props: `{ plan, onDismiss, onGenerateBlog }`
  - 视觉：amber-50 背景 + 左侧 4px 琥珀边 + Sparkles icon + 主标题「恭喜！计划已完成」+ 副标题 + 主 CTA + X 关闭
  - 动画：slideDown 300ms

## 5. 关键数据区

- [ ] 5.1 `src/features/plan/components/PlanKeyMetrics.tsx` → 5 个只读数据卡
  - props: `{ plan, completedItems, totalItems }`
  - 5 个数据点：已完成/总事项、进度、坚持天数、截止/剩余、关联博客数
  - 视觉：grid-cols-5 网格 + 数字 + label + icon
  - 「坚持天数」简化为 `floor((now - createdAt) / 86400e3)`
  - 「截止/剩余」复用 `formatEnd` 工具

## 6. 关联博客区

- [ ] 6.1 `src/features/plan/components/PlanBlogsSection.tsx` → 关联博客卡片网格
  - props: `{ blogIds }`
  - 入参：useLiveQuery(blogRepo.listByIds(blogIds))
  - 3 列卡片网格（与 Dashboard「最近博客」一致）
  - 空态：EmptyState compact + 「生成总结博客」CTA
  - 单卡：封面占位（gradient）+ 标题（line-clamp-2）+ 日期
  - 点击 → `/blogs/:id`

## 7. 框架抽屉组件

- [ ] 7.1 `src/components/shell/Drawer.tsx` → 通用右侧抽屉壳
  - props: `{ open, onClose, title, children, width = 480 }`
  - 视觉：右侧滑入（transform translateX）+ 背景黑色/30 遮罩
  - 行为：ESC 关闭 + 背景点击关闭
  - a11y：role="dialog" + aria-modal="true"
- [ ] 7.2 `src/features/framework/components/FrameworkDrawer.tsx` → 业务抽屉
  - props: `{ sourcePlanId, onClose }`
  - 内部：标题 + 4 卡片（项目复盘 / 21天习惯 / 读书笔记 / 月度总结）
  - 卡片视觉：icon + 框架名 + 描述
  - 选框架 → console.log + onClose
- [ ] 7.3 `src/components/layout/AppLayout.tsx` 挂载 `<FrameworkDrawerHost />`
  - 全局挂载 + 监听 `useUIStore.drawerStack`
  - 路由变化 effect 中调用 `closeAllDrawers`（防幽灵抽屉）

## 8. 顶栏 + 详情页整合

- [ ] 8.1 `src/features/plan/components/PlanDetailTopBar.tsx` → 顶栏
  - props: `{ plan }`
  - 视觉：返回按钮 + 标题 + layer/dim/status badges + 「编辑」按钮（占位跳 `/plans/:id/edit`）
  - 复用 add-plan-list-view 的 badge 配色（LEVEL_BG / STATUS_*）
- [ ] 8.2 `src/pages/plans/PlanDetail.tsx` 整合所有子组件
  - 组装：TopBar + CompletionBanner + Hero(ProgressRing + KeyMetrics) + ItemChecklist + PlanBlogsSection
  - 通过 props 传递 onGenerateBlog → openDrawer('framework', { sourcePlanId })
  - 加载态 / ID 不存在态分别处理

## 9. 验证

- [ ] 9.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [ ] 9.2 `pnpm lint` 0 error / 0 warning
- [ ] 9.3 手动验证：构造 1 个 plan + 4 个事项，勾选全部事项 → 进度环 → 100% + 横幅出现
- [ ] 9.4 手动验证：关闭横幅 → 切换到另一个 100% 的 plan → 横幅重新出现
- [ ] 9.5 手动验证：刷新页面 → 横幅重新出现
- [ ] 9.6 手动验证：点 CTA → 抽屉滑入 → 4 卡片可见 → 选框架 → 抽屉关闭 + console.log
- [ ] 9.7 手动验证：访问 `/plans/不存在的ID` → 显示空态
- [ ] 9.8 手动验证：连续勾选 5 个事项（200ms 内）→ 进度环只更新 1 次
- [ ] 9.9 手动验证：编辑按钮跳 `/plans/:id/edit`（占位即可，add-plan-edit-form 接手）
- [ ] 9.10 `openspec validate add-plan-detail-view --strict` 通过

## 10. 提交与归档

- [ ] 10.1 `git add .` + `git commit -m "feat(plans): add plan detail view with item toggle + progress ring + 100% banner + framework drawer"`（git 留给用户）
- [ ] 10.2 `openspec archive add-plan-detail-view --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（路由可达 + 完整布局）| 1.1 + 1.2 + 8.2 | 浏览器访问 |
| AC-2（勾选实时联动）| 3.1 + 9.3 | 浏览器 + 构造数据 |
| AC-3（3 状态切换）| 3.3 + 9.3 | 浏览器 hover |
| AC-4（100% 横幅）| 4.1 + 4.2 + 9.3 | 浏览器 |
| AC-5（抽屉唤起 + 关闭）| 7.1 + 7.2 + 9.6 | 浏览器 |
| AC-6（选框架 log）| 7.2 + 9.6 | DevTools console |
| AC-7（关联博客区）| 6.1 | 浏览器 |
| AC-8（ID 不存在空态）| 1.1 + 9.7 | 浏览器 |
| AC-9（加载态）| 1.2 | 浏览器 |
| AC-10（进度环 SVG）| 2.1 | 视觉 + DevTools |
| AC-11（build + lint）| 9.1 + 9.2 | CLI |
| AC-12（openspec validate）| 9.10 | CLI |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（路由 + 骨架）| 0.3 | 复用现有模式 |
| 2（进度环）| 0.2 | SVG 算法 |
| 3（勾选 + 联动）| 0.4 | debounce + 失败回滚 |
| 4（横幅）| 0.2 | sessionStorage + 动画 |
| 5（关键数据）| 0.15 | 5 卡 + 计算 |
| 6（关联博客）| 0.2 | liveQuery + 卡片 |
| 7（抽屉）| 0.4 | 通用壳 + 业务壳 |
| 8（顶栏 + 整合）| 0.2 | 整合所有子组件 |
| 9（验证）| 0.4 | 10 项手动 + CLI |
| **合计** | **2.45 人天** | |
