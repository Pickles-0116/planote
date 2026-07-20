# Design · fix-v1-0-ux-gap

## 1. 改动总览

3 个 UI 文件、6 处改动、净减少约 80 行代码。**无新增数据 / 新增依赖 / 新增路由**。

| 文件 | 改动类型 | 行数变化（估） |
|------|---------|---------------|
| `src/components/layout/Header.tsx` | 删搜索框 / 通知 / + 按钮 + 3 个 import | -45 行 |
| `src/components/layout/Sidebar.tsx` | 删 CATEGORY_NAV 数组 + 渲染 + 标题 | -25 行 |
| `src/pages/Dashboard.tsx` | 删「最近活动」Card + 修「可以总结一下了」条件 + 1 import | -30 行 |

## 2. 改动详情

### 2.1 Header.tsx

**删除**：
- 顶部「搜索框」div（含 `Search` / `kbd ⌘K`）
- 通知 `button`（含 `Bell` / 假红点 span）
- 「新建」`Link`（含 `Plus` 图标，跳 `/plans/new`）
- import：`Search` / `Bell` / `Plus`（保留 `useTheme` 用到的 `Sun` `Moon` `Monitor`）

**保留**：
- 主题切换 3 选项（system/light/dark）+ ResolvedBadge
- 设置入口（齿轮 SVG → `/settings#theme`）

**理由**：右侧已有完整入口（右上 Dashboard「新建计划」+「写博客」两按钮，Header 主题 + 设置），Header 顶部「+」是冗余。搜索框未实装，移除可避免「看起来能用」误导。通知同理。

### 2.2 Sidebar.tsx

**删除**：
- `CATEGORY_NAV` 数组（每日/每月/每年/一次性 4 项）
- 「分类」小标题 `<div>`
- CATEGORY_NAV 渲染循环

**保留**：
- PRIMARY_NAV（仪表盘 / 计划 / 博客 / 看板）
- 「其他」section（含「设置」）
- Logo + 用户卡片

**理由**：分类项不可点击、无数据驱动（颜色硬编码），属于「看起来可点其实不能」反模式，移除让 Sidebar 收敛为「可点击导航 + 设置」。

### 2.3 Dashboard.tsx

**改动 1**：删「最近活动」Card 区块（"最近活动" Card + activities.map 渲染），同时删除：
- 顶部 import 中不再用到的 icon（如 Wand2 / Notebook / ChevronRight 等 — 仅删未用项）
- `activities` 变量 + `useRecentActivity` 仍 import（hook 保留为公共 API）

**改动 2**：「可以总结一下了」条件化
- 现有：始终渲染（无判断）
- 改为：仅当 `stats.completedItems > 0` 时渲染该 Card

**实现**：
```tsx
{stats.completedItems > 0 && (
  <section className="... 总结卡 ...">...</section>
)}
```

`stats.completedItems` 来自 useDashboardStats()，值类型 `number`。这是已有的派生数据源，无新增查询。

## 3. 不动的事

- 不动 useRecentActivity hook（v1.0 不再使用，但保留公共 API，v1.1 可对接真实活动流）
- 不动 useDashboardStats / useTodayFocus / useUpcomingPlans / useRecentBlogs
- 不动 stores / db / types
- 不动任何业务页（Plan / Blog / Kanban / Settings）

## 4. 验证清单

1. `pnpm build` → 0 error
2. `pnpm lint` → 0 warning
3. `cmd /c openspec.cmd validate fix-v1-0-ux-gap --strict` → valid
4. 浏览器：dev server 起 → `/` → 肉眼确认：
   - Header 右侧仅剩：主题切换（3 选项）+ 设置齿轮
   - Sidebar 左侧无「分类」组
   - Dashboard 右侧无「最近活动」Card
   - 当无 completed plan 时（v1.0 新装环境天然成立），「可以总结一下了」不显示
5. `openspec archive fix-v1-0-ux-gap --yes` → 归档

## 5. 风险评估

- 风险等级：低
- 影响范围：3 个 UI 文件，纯减法
- 数据回滚：不需要（无数据层改动）
- 用户感知：Header / Sidebar / Dashboard 三个高曝光区视觉更收敛
