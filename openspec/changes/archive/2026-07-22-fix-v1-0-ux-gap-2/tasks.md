# Tasks · fix-v1-0-ux-gap-2

> v1.0 收尾第二轮微调。每条任务可独立 commit。

## 1. Sidebar 删 hardcode badge

- [ ] 1.1 删除 PRIMARY_NAV 中「计划」的 `badge: '100'` 字段

## 2. DataInspector 组件新建

- [ ] 2.1 新建 `src/features/settings/components/DataInspector.tsx`
- [ ] 2.2 实现 useLiveQuery 订阅 7 张表 count
- [ ] 2.3 渲染卡片：标题「数据状态」+ 文字说明 + 7 项 count 网格
- [ ] 2.4 处理 loading（useLiveQuery 首次返回 undefined → 显示 Skeleton）

## 3. Settings 页集成

- [ ] 3.1 `src/pages/settings/Settings.tsx` import DataInspector
- [ ] 3.2 在 Settings 末尾渲染 DataInspector

## 4. 验证

- [ ] 4.1 `pnpm build` 0 error
- [ ] 4.2 `pnpm lint` 0 warning
- [ ] 4.3 `cmd /c openspec.cmd validate fix-v1-0-ux-gap-2 --strict` valid
- [ ] 4.4 浏览器手验：Sidebar「计划」无 100 徽章
- [ ] 4.5 浏览器手验：`/settings` 底部显示「数据状态」+ 7 项 count

## 5. 归档

- [ ] 5.1 `cmd /c openspec.cmd archive fix-v1-0-ux-gap-2 --yes`
- [ ] 5.2 确认：changes/fix-v1-0-ux-gap-2/ 不再存在 + archive/2026-07-22-fix-v1-0-ux-gap-2/ 出现
- [ ] 5.3 确认：`openspec validate --specs --strict` 16/16 通过

## 时间预算

| 段 | 工时 |
|----|------|
| 1（Sidebar）| 0.01 |
| 2（DataInspector）| 0.1 |
| 3（Settings）| 0.02 |
| 4（验证）| 0.05 |
| 5（归档）| 0.02 |
| **合计** | **0.2 人时** | 预计 15 分钟内完成 |
