# Tasks · 计划列表页

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. 数据 pipeline hooks

- [x] 1.1 `src/stores/hooks/useSortedPlans.ts` → 智能排序 hook
  - 4 关键字：urgency 升序 → progress 降序 → endDate 升序 → createdAt 降序
  - 输入 undefined 返回 undefined（让上层走骨架屏）
  - useMemo 缓存
- [x] 1.2 `src/stores/hooks/usePlanSearch.ts` → 搜索过滤 hook
  - 匹配 title + description，大小写不敏感
  - 空 query 透传原数组
  - useMemo 缓存

## 2. 视图切换器

- [x] 2.1 `src/components/plans/PlanViewSwitcher.tsx` → 3 段按钮切换器
  - props: `{ value, onChange }`（value: 'group' | 'all' | 'table'）
  - 视觉：白底胶囊容器 + 选中态 bg-brand-900 text-white
  - a11y：role="tablist" / role="tab" / aria-selected
- [x] 2.2 `useUIStore` 增量：新增 `planListView` 字段 + `setPlanListView` action
  - 默认值 `'group'`
  - 复用已有 persist 中间件（localStorage）

## 3. 搜索框

- [x] 3.1 搜索框 UI（在 PlanList 页面内实现或拆 `<PlanSearchBox>` 子组件）
  - input type="search" + Lucide Search icon + 清除 X 按钮
  - placeholder「搜索计划标题或描述…」
  - aria-label="搜索计划"

## 4. PlanCard 组件（3 视图共用）

- [x] 4.1 `src/features/plan/components/PlanCard.tsx`
  - props: `{ plan, density: 'full' | 'compact' | 'table-row' }`
  - 'full'：标题 + 描述（line-clamp-2）+ 进度条 + 标签 + 起止日期 + 状态 badge
  - 'compact'：单行 + 进度环（24px）+ 标题 + 紧急度 tag
  - 'table-row'：6 列单元格（由 TanStack Table 调用方决定列布局）
  - 紧急度左边框 4px（red/orange/yellow/none）
  - 进度条用 `<Skeleton>` 同款 animate-pulse 风格？或直接用 Tailwind `bg-stone-200` 静态条

## 5. 折叠展开组件

- [x] 5.1 `src/features/plan/components/PlanGroupCollapse.tsx`
  - props: `{ title, count, threshold = 5, children }`
  - 折叠：显示前 5 个 + 「展开剩余 N 个」虚线按钮
  - 展开：显示全部 + 「收起」按钮
  - useState 内部维护展开状态（不持久化）

## 6. 分组视图

- [x] 6.1 `src/features/plan/components/PlanGroupedView.tsx`
  - 按 `level` 分 3 组：短期 / 中期 / 长期
  - 0 元素的组隐藏
  - 每组用 `<PlanGroupCollapse>` 包裹
  - 每组内 plan 用 `<PlanCard density="full" />`
  - 组标题 h3 + 计数 badge

## 7. 全部视图

- [x] 7.1 `src/features/plan/components/PlanListAllView.tsx`
  - 一列紧凑横排（flex + gap-2）
  - 100+ plan 时启用 react-virtuoso
  - 底部「加载更多」按钮（v1.0 简化分页）

## 8. 表格视图

- [x] 8.1 `src/features/plan/components/PlanTableView.tsx`
  - TanStack Table v8 渲染 6 列：勾选 / 标题 / 层级 / 紧急度 / 进度 / 起止日期
  - 列头点击切换 asc/desc，覆盖智能排序
  - 勾选列多选（仅 UI 状态，批量操作留给 `add-plan-batch-ops`）
  - 选中行视觉：`bg-accent-50/30`
  - 1000+ 行启用 react-virtuoso
- [x] 8.2 列定义文件 `src/features/plan/components/planTableColumns.tsx`
  - 6 个 column defs（cell renderer 复用 PlanCard density='table-row'）

## 9. 路由页面

- [x] 9.1 `src/pages/plans/PlanList.tsx` 替换 PlaceholderPage
  - 顶层 hooks pipeline：useLiveQuery → useSortedPlans → usePlanSearch
  - 加载态：`<PlanListSkeleton />`（多个 `<Skeleton>` 组合）
  - 空态：无 query 时 `<EmptyState variant="illustration" />`
  - 搜索空态：`<EmptyState variant="compact" />` + 清除筛选按钮
  - 标题栏：`<PageHeader count={plans.length} />`
  - 排序说明条：amber 背景 + Sparkles icon + 文案
  - 工具栏：搜索框 + 视图切换器
  - 内容区：根据 `view` 切换 3 视图组件
  - 复用 add-app-shell 的 `<LoadingOverlay>` / `<EmptyState>` / `<Skeleton>`
- [x] 9.2 `src/pages/plans/PlanListSkeleton.tsx`（骨架屏）
  - 9.3 顶层复用的 `<PageHeader>` 子组件（如未在 shared 抽）
  - 9.4 `<SortHint>` 子组件（amber 背景排序说明条）

## 10. Sidebar 跳转验证

- [x] 10.1 验证 Sidebar 已有「计划列表」入口跳转 `/plans`（无变化，仅冒烟）
- [x] 10.2 验证「新建计划」按钮跳转 `/plans/new`（占位页，不在本 change 范围）

## 11. 验证

- [x] 11.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 11.2 `pnpm lint` 0 error / 0 warning
- [x] 11.3 手动验证 3 视图切换视觉一致（不白屏、不闪烁）
- [x] 11.4 手动验证智能排序：构造测试数据（red 紧急度 + 100% 进度的 plan 应该排在 red 紧急度 + 0% 之前）
- [x] 11.5 手动验证搜索：输入「复盘」过滤，title 或 description 包含「复盘」的 plan 留下
- [x] 11.6 手动验证折叠：构造每组 8 个 plan，验证前 5 个展示 + 「展开剩余 3 个」按钮
- [x] 11.7 手动验证视图偏好持久化：选「表格」→ 刷新页面 → 仍为「表格」
- [x] 11.8 `openspec validate add-plan-list-view --strict` 通过

## 12. 提交与归档

- [ ] 12.1 `git add .` + `git commit -m "feat(plans): add plan list view with 3 modes + smart sort + search"`（git 留给用户）
- [ ] 12.2 `openspec archive add-plan-list-view --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（/plans 路由可访问 + 完整布局）| 9.1 + 9.2 + 9.3 + 9.4 | 浏览器访问 |
| AC-2（视图切换器 3 段）| 2.1 | 视觉 + 点击 |
| AC-3（智能排序生效）| 1.1 + 11.4 | 视觉 + 构造数据 |
| AC-4（搜索实时过滤）| 1.2 + 3.1 + 11.5 | 浏览器 |
| AC-5（分组视图折叠）| 5.1 + 6.1 + 11.6 | 浏览器 |
| AC-6（全部视图虚拟滚动）| 7.1 | 100+ 数据 |
| AC-7（表格视图 6 列 + 排序覆盖）| 8.1 + 8.2 | 浏览器 + 列头点击 |
| AC-8（视图切换无白屏）| 9.1 | 浏览器（复用 add-app-shell Suspense）|
| AC-9（空态 / 搜索空态）| 9.1 | 浏览器 |
| AC-10（视图偏好持久化）| 2.2 + 11.7 | localStorage 验证 |
| AC-11（build + lint 0 error）| 11.1 + 11.2 | CLI |
| AC-12（openspec validate）| 11.8 | CLI |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（数据 hooks）| 0.15 | 2 个 hook 简单 |
| 2（视图切换器）| 0.1 | 3 按钮组件 |
| 3（搜索框）| 0.1 | input + icon |
| 4（PlanCard）| 0.3 | 3 密度适配 |
| 5（折叠组件）| 0.15 | useState 容器 |
| 6（分组视图）| 0.2 | 组分类 + 折叠组合 |
| 7（全部视图）| 0.2 | virtuoso 集成 |
| 8（表格视图）| 0.4 | TanStack Table + 列定义 + 多选 |
| 9（路由页面）| 0.4 | pipeline + 3 视图组装 |
| 10（Sidebar 验证）| 0.05 | 冒烟 |
| 11（验证）| 0.3 | 8 项手动 + CLI |
| **合计** | **2.35 人天** | |
