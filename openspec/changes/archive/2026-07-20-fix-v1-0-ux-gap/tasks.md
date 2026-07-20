# Tasks · fix-v1-0-ux-gap

> v1.0 收尾补漏，纯减法。每条任务可独立 commit。

## 1. Header.tsx 精简（3 处删除）

- [ ] 1.1 删除顶部搜索框 div（`flex-1 max-w-md` 容器，含 Search icon + input + ⌘K kbd）
- [ ] 1.2 删除通知 button（`Bell` icon + 假红点 span + `aria-label="通知"`）
- [ ] 1.3 删除右上角「+」Link（`Plus` icon + `to="/plans/new"`）
- [ ] 1.4 清理 import：删除 `Search` / `Bell` / `Plus`（保留 `Sun` / `Moon` / `Monitor` 给主题切换）
- [ ] 1.5 验证 Header 剩余元素：主题切换 3 选项 + 设置入口（齿轮 SVG）

## 2. Sidebar.tsx 精简（3 处删除）

- [ ] 2.1 删除 `CATEGORY_NAV` 数组常量（4 项：每日/每月/每年/一次性）
- [ ] 2.2 删除「分类」小标题 `<div>`（「分类」text + uppercase 样式）
- [ ] 2.3 删除 CATEGORY_NAV.map 渲染循环
- [ ] 2.4 验证 Sidebar 剩余：Logo + PRIMARY_NAV（4 项）+「其他」+「设置」+ 用户卡片

## 3. Dashboard.tsx 精简（2 处改动）

- [ ] 3.1 删除「最近活动」Card 区块（h3 + activities.map + 空态）
- [ ] 3.2 「可以总结一下了」改为条件渲染：`{stats.completedItems > 0 && <section>...</section>}`
- [ ] 3.3 清理 Dashboard 中不再使用的 icon import（按 unused-imports lint 自动检测）
- [ ] 3.4 保留 `useRecentActivity` import（hook 仍为公共 API，v1.0 不渲染但代码不删）

## 4. 验证

- [ ] 4.1 `pnpm build` 0 error
- [ ] 4.2 `pnpm lint` 0 warning
- [ ] 4.3 `cmd /c openspec.cmd validate fix-v1-0-ux-gap --strict` valid
- [ ] 4.4 浏览器手验：dev server → `/` → 肉眼确认 4 处删除 + 1 处条件化生效
  - Header：仅主题切换 + 设置齿轮
  - Sidebar：无「分类」组
  - Dashboard 右侧：无「最近活动」+ 「可以总结一下了」在无 completed plan 时不显示

## 5. 归档

- [ ] 5.1 `cmd /c openspec.cmd archive fix-v1-0-ux-gap --yes`
- [ ] 5.2 确认：changes/fix-v1-0-ux-gap/ 不再存在 + archive/2026-07-19-fix-v1-0-ux-gap/ 出现
- [ ] 5.3 确认：specs/dashboard-trim/spec.md 合并到 specs/ 目录
- [ ] 5.4 确认：`openspec validate --specs --strict` 15/15 通过（14 + 新 1）

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（Header）| 0.1 | 3 处删除 + import 清理 |
| 2（Sidebar）| 0.05 | 数组 + 标题 + 渲染 |
| 3（Dashboard）| 0.1 | 删 Card + 条件化 + 清理 import |
| 4（验证）| 0.1 | build/lint/validate + 浏览器肉眼 |
| 5（归档）| 0.05 | archive + 自检 |
| **合计** | **0.4 人时** | 纯减法 + 条件化，预计 30 分钟内完成 |
