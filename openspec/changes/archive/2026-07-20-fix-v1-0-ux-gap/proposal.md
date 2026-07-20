# Change · fix-v1-0-ux-gap

> v1.0 收尾补漏：删未实装 / 与现有功能重复的 UI 元素，缩小「承诺与现实」的差距。

## Why

v1.0 收官后实测发现：仪表盘 / Header / Sidebar 中存在若干「仅占位、未实装」或「与已有功能重复」的 UI 元素，违背「把事做对」原则，干扰首次用户体验。

具体问题（按用户截图整理）：
1. **Header 顶部「+」按钮**：仅跳 `/plans/new`，与右上「新建计划」+「写博客」两按钮重复
2. **Sidebar「分类」组**（每日/每月/每年/一次性）：不可点击、无筛选行为、纯展示
3. **Header 全局搜索框 + ⌘K 提示**：未实装任何搜索行为
4. **Header 通知中心（铃铛）**：占位 + 假红点，无通知体系
5. **Dashboard「最近活动」feed**：useRecentActivity hook 已就绪但渲染依赖未来 4 项，无稳定数据源
6. **Dashboard「可以总结一下了」引导卡**：始终显示，未与「是否有已完成计划」联动

## What

实施 6 项 v1.0 收尾精简（删除 / 条件化），不动其他任何业务代码：

| # | 改动 | 类型 |
|---|------|------|
| 1 | 删 Header 顶部「+」按钮 | 删除 |
| 2 | 删 Sidebar「分类」组区块 | 删除 |
| 3 | 删 Header 全局搜索框 + ⌘K 提示 | 删除 |
| 4 | 删 Header 通知中心按钮 | 删除 |
| 5 | 删 Dashboard「最近活动」Card 区块（hook 保留） | 删除 |
| 6 | 「可以总结一下了」改为条件显示：仅当存在 completed plan 时渲染 | 条件化 |

## Scope

### 改动文件（4 个）
- `src/components/layout/Header.tsx` — 删搜索框 / 通知 / 「+」按钮（3 处）
- `src/components/layout/Sidebar.tsx` — 删 CATEGORY_NAV 数组 + 渲染 + 「分类」标题（3 处）
- `src/pages/Dashboard.tsx` — 删「最近活动」Card + 修「可以总结一下了」条件（2 处）
- `src/stores/hooks/useRecentActivity.ts` — **不改文件**，但加 `@deprecated` 注记，v1.0 不使用，v1.1 评估

### 验证
- `pnpm build` 0 error
- `pnpm lint` 0 warning
- `openspec validate fix-v1-0-ux-gap --strict` valid
- 浏览器手验：dev server 跑起来，确认 4 处删除生效 + 「可以总结一下了」条件正确

## AC

- AC-1：Header 不再有「+」按钮 / 搜索框 / 通知按钮
- AC-2：Sidebar 不再有「分类」组区块（PRIMARY_NAV 仍保留）
- AC-3：Dashboard 不再有「最近活动」Card
- AC-4：「可以总结一下了」在有 completed plan 时显示，无 completed plan 时隐藏
- AC-5：build / lint / validate 三关全过
- AC-6：浏览器肉眼验证 4 项删除 + 1 项条件化生效

## Out-of-Scope

- 通知中心实装（v1.1）
- 全局搜索（v1.1 MiniSearch）
- 「最近活动」数据源重设计（v1.1）
- Sidebar 分类导航加点击行为（v1.1）
- 新增菜单替代顶部「+」（v1.1 评估）

## Risks

- 极低：纯删 / 条件化，不动数据层、stores 业务逻辑
- 回归风险：仅 Header / Sidebar / Dashboard 三个高曝光页
