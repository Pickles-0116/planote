# Tasks · fix-v1-0-ux-gap-3

> v1.0 收尾第三轮：修仪表盘空数据永远卡 skeleton 的 bug。

## 1. 修 Dashboard isLoading 守卫

- [ ] 1.1 改 `src/pages/Dashboard.tsx` 的 isLoading：移除 `focus === undefined` 和 `focusItems === undefined` 守卫项
- [ ] 1.2 改 hasAnyPlan：增加 `focus !== undefined` 兜底条件
- [ ] 1.3 验证渲染层已有 `{focus && <section>}` 守卫，focusItems 已正确处理 undefined → []

## 2. 验证

- [ ] 2.1 `pnpm build` 0 error
- [ ] 2.2 `pnpm lint` 0 warning
- [ ] 2.3 `cmd /c openspec.cmd validate fix-v1-0-ux-gap-3 --strict` valid
- [ ] 2.4 浏览器手验：空数据时仪表盘 1 秒内显示 DashboardEmpty
- [ ] 2.5 浏览器手验：新建 1 条 plan → 仪表盘正常渲染
- [ ] 2.6 浏览器手验：删除该 plan → 仪表盘回到 DashboardEmpty

## 3. 归档

- [ ] 3.1 `cmd /c openspec.cmd archive fix-v1-0-ux-gap-3 --yes`
- [ ] 3.2 确认：changes/fix-v1-0-ux-gap-3/ 不再存在 + archive/2026-07-22-fix-v1-0-ux-gap-3/ 出现
- [ ] 3.3 确认：`openspec validate --specs --strict` 17/17 通过

## 时间预算

| 段 | 工时 |
|----|------|
| 1（Dashboard）| 0.02 |
| 2（验证）| 0.05 |
| 3（归档）| 0.02 |
| **合计** | **0.1 人时** | 预计 5 分钟内完成 |
