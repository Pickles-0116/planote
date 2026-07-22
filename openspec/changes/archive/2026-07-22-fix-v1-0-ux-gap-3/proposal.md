# Change · fix-v1-0-ux-gap-3

> v1.0 收尾第三轮：修仪表盘空数据时永远卡 skeleton 不显示引导页的 bug。

## Why

用户实测反馈：仪表盘「没有数据的情况下，按钮和默认的页面都没加载出来」。

**根因**：
- `useTodayFocus` 在 plans 数组为空时返回 `undefined`（混入了"loading"语义，实际是"无 focus plan"）
- `Dashboard.tsx` 的 `isLoading` 判断把 `focus === undefined` 算进 loading 守卫
- 两者结合 → 无数据时 `isLoading` 永远 true → 永远显示 `DashboardSkeleton`，从不显示 `DashboardEmpty` 引导页

## What

修复 `Dashboard.tsx` 的 isLoading 判断语义：

| # | 改动 | 类型 |
|---|------|------|
| 1 | `isLoading` 移除 `focus === undefined` 和 `focusItems === undefined` 两个守卫项 | 修复 |
| 2 | `hasAnyPlan` 兜底：focus 也参与判断（防止 stats 计算漏判） | 强化 |

**核心修复**：
- `focus` / `focusItems` 不再代表 loading 状态（它们对"无数据"的语义就是 falsy）
- 只有真正在 loading 的 hook（stats / upcoming / recentBlogs）参与 isLoading 守卫
- 渲染时：`{focus && <section>...</section>}` 和 `focusItems.slice(0, 4)` 已有 truthy 守卫，无需额外改

## Scope

### 改动文件（1 个）
- `src/pages/Dashboard.tsx` — 改 isLoading 守卫（删 2 行）+ 改 hasAnyPlan（加 1 个条件）

### 不动
- `useTodayFocus.ts` / `useItemsForPlan.ts` / 其他 hook：不动它们的 undefined 语义（其他页面可能依赖）
- 不动 useLiveQuery 的「首帧 undefined」全局约定
- 不动 DashboardSkeleton / DashboardEmpty 组件

## AC

- AC-1：空数据时（plans 表 0 行），仪表盘 MUST NOT 永远卡 skeleton
- AC-2：空数据时，仪表盘 MUST 显示 DashboardEmpty 引导页（含「新建计划」按钮）
- AC-3：新建 1 条 plan 后，仪表盘 MUST 正常渲染 4 个数字卡 + 今日聚焦 + 即将到期
- AC-4：删除所有 plan 后，仪表盘 MUST 重新显示 DashboardEmpty（不被 skeleton 卡）
- AC-5：build / lint / validate 三关全过

## Risks

- 风险等级：低
- 改动 1 个文件 ~3 行
- 已有 `{focus && ...}` 守卫保护渲染安全
- 唯一边界：如果 `focusItems.slice(0, 4)` 在 undefined 上调用会崩 — 但 useItemsForPlan 实现是 planId 为 undefined 时返回 `[]`，所以 focusItems 永远是数组
