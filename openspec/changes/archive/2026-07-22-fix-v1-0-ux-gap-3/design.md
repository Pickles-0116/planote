# Design · fix-v1-0-ux-gap-3

## 1. 根因分析

### 1.1 useTodayFocus 语义冲突

`src/stores/hooks/useTodayFocus.ts` 第 43-44 行：

```ts
export function pickFocusPlan(plans: Plan[]): TodayFocus | undefined {
  if (plans.length === 0) return undefined;  // ← 关键：空数据也返回 undefined
  // ...
}
```

`useLiveQuery` 全局约定：**首帧返回 undefined 表示「还在加载」**。

`useTodayFocus` 把「无 focus plan」和「loading」混用同一个 `undefined`，违反约定。

### 1.2 Dashboard isLoading 误把 focus 算作 loading 守卫

`src/pages/Dashboard.tsx`（fix 前）：

```ts
const isLoading =
  stats === undefined ||
  focus === undefined ||          // ← 空数据时永远 true
  focusItems === undefined ||    // 冗余：useItemsForPlan 永远返回 []
  upcoming === undefined ||
  recentBlogs === undefined;
```

### 1.3 链式失败

1. 用户清空数据（plans = []）
2. `useTodayFocus` 内部 `plans.length === 0` → 返回 undefined
3. Dashboard `focus === undefined` → `isLoading` true
4. 渲染 `DashboardSkeleton`（永远不显示 DashboardEmpty）

## 2. 修复方案

### 2.1 决策：仅改 Dashboard.tsx

**为什么不动 useTodayFocus**：
- 改动传播广：focus 是多个页面的状态（Dashboard、可能还有 PlanDetail 等）
- 「undefined = loading」约定是 useLiveQuery 的全局语义，动 hook 风险大
- Dashboard 自身已有 `{focus && <section>}` 渲染守卫，足够安全

**为什么不动 useItemsForPlan**：
- 已正确处理 `planId === undefined` → 返回 `[]`
- 不需要再改

### 2.2 改动详情

**Dashboard.tsx**：

```diff
   const isLoading =
     stats === undefined ||
-    focus === undefined ||
-    focusItems === undefined ||
     upcoming === undefined ||
     recentBlogs === undefined;
```

```diff
   // 空状态：没有任何 plan（不论进行中还是已完成）时，引导用户创建
   const hasAnyPlan =
     stats.activePlans + stats.completedItems > 0 ||
     upcoming.length > 0 ||
+    focus !== undefined ||  // focus 有值 = 至少有 1 个 plan
     false;
   if (!hasAnyPlan) {
     return <DashboardEmpty />;
   }
```

### 2.3 渲染层（不改，已有守卫）

```tsx
{focus && (
  <section className="... 今日聚焦 ...">
    {/* ... */}
    {focusItems.slice(0, 4).map(...)}  // focusItems 永远是数组
  </section>
)}
```

`focus` 为 undefined/null 时整个 section 不渲染，**0 渲染开销**。

## 3. 验证清单

| 测试 | 预期 |
|------|------|
| 1. 全新访问（无数据） | DashboardEmpty 立即显示（< 1s） |
| 2. 刷新页面（无数据） | DashboardEmpty 显示，不卡 skeleton |
| 3. 新建 1 条 plan → 刷新 | 4 数字卡 + 今日聚焦 + 即将到期 正常渲染 |
| 4. 删除该 plan → 刷新 | 重新回到 DashboardEmpty（不卡 skeleton） |
| 5. 多 plan 时 | focus 选紧急度最高的 plan 正常显示 |
| 6. pnpm build | 0 error |
| 7. pnpm lint | 0 warning |
| 8. openspec validate | valid |

## 4. 风险评估

- 风险等级：低
- 改动 1 个文件 3 行
- 已有 `{focus && ...}` 守卫 + `useItemsForPlan` 的 [] fallback 双层保护
- 不动 hook 语义 → 其他页面零影响
