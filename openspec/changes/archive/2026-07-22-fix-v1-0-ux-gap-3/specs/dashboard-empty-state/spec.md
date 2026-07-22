# Spec · dashboard-empty-state（fix-v1-0-ux-gap-3）

> 修仪表盘空数据时永远卡 skeleton 不显示引导页的 bug。

## ADDED Requirements

### Requirement: 仪表盘空数据时必须显示引导页

当 Dexie plans 表为空时，仪表盘 MUST NOT 永远卡在 skeleton / loading 状态，必须显示「欢迎来到 Planote」引导页。

#### Scenario: 无数据时显示引导页
- GIVEN 用户首次访问 / 已清空数据 / plans 表 0 行
- WHEN 渲染仪表盘
- THEN MUST NOT 永远显示 DashboardSkeleton
- AND MUST 在 1 秒内显示 DashboardEmpty 组件（含「新建计划」按钮）
- AND 「新建计划」按钮 MUST 可点击 → 跳 `/plans/new`

#### Scenario: 有数据时正常渲染
- GIVEN plans 表 ≥ 1 行
- WHEN 渲染仪表盘
- THEN MUST 正常显示 4 个数字卡 + 今日聚焦 + 最近博客 + 即将到期
- AND MUST NOT 错误显示 DashboardEmpty

#### Scenario: 删除最后一条 plan 后回到引导页
- GIVEN plans 表从 1 行变成 0 行（用户删除最后一条 plan）
- WHEN 仪表盘重新渲染（useLiveQuery 触发）
- THEN MUST 自动切换回 DashboardEmpty
- AND MUST NOT 残留 skeleton 或空白

### Requirement: isLoading 守卫不得误判空数据为 loading

`Dashboard.tsx` 的 isLoading 守卫 MUST 仅基于真正在 loading 的 hook（stats / upcoming / recentBlogs），不得把 useTodayFocus 的空数据语义误判为 loading。

#### Scenario: isLoading 守卫语义
- GIVEN plans 表为空
- WHEN 计算 `isLoading = stats === undefined || upcoming === undefined || recentBlogs === undefined`
- THEN `isLoading` MUST 在所有 hook 就绪后立即为 false
- AND MUST NOT 受 `focus === undefined`（空数据）影响

### Requirement: 验证三关全过

变更实施后 MUST 通过 build / lint / validate 三关。

#### Scenario: 验证
- WHEN 实施完成
- THEN `pnpm build` MUST exit 0 / 0 error
- AND `pnpm lint` MUST exit 0 / 0 warning
- AND `cmd /c openspec.cmd validate fix-v1-0-ux-gap-3 --strict` MUST valid
