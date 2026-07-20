# Spec · dashboard-trim（fix-v1-0-ux-gap）

> 仪表盘 / Header / Sidebar 三个高曝光区的 UI 精简。纯减法 + 一处条件化，无数据层 / store / 业务逻辑变更。

## ADDED Requirements

### Requirement: Header 顶部不得含未实装的全局功能按钮

仪表盘 Header SHALL NOT 显示未实装的全局功能（搜索框 / 通知 / 单一新建按钮），避免「看起来能用」误导。

#### Scenario: Header 不含全局搜索框
- GIVEN 用户进入任一页面
- WHEN 渲染 Header
- THEN 顶部 MUST NOT 出现「搜索计划、博客、标签…」输入框
- AND MUST NOT 出现 `⌘K` 快捷键提示
- AND MUST NOT 调用 Search icon 组件

#### Scenario: Header 不含通知按钮
- WHEN 渲染 Header
- THEN MUST NOT 出现通知（铃铛）按钮
- AND MUST NOT 出现假红点
- AND MUST NOT 调用 Bell icon 组件

#### Scenario: Header 不含「+」按钮
- WHEN 渲染 Header
- THEN MUST NOT 出现右上角「+」图标
- AND MUST NOT 出现指向 `/plans/new` 的 Link 组件（Header 内部）
- AND 主题切换（system/light/dark）+ 设置入口 MUST 仍保留

### Requirement: Sidebar 不含「分类」组

Sidebar MUST NOT 显示「分类」组（每日/每月/每年/一次性）4 个色点 + 标题，因为这些项不可点击、无数据驱动。

#### Scenario: Sidebar 导航收敛
- WHEN 渲染 Sidebar
- THEN MUST 仅出现 PRIMARY_NAV（仪表盘 / 计划 / 博客 / 看板）+ 「其他」section（含「设置」）
- AND MUST NOT 出现「分类」标题
- AND MUST NOT 出现 4 个色点（绿/蓝/紫/橙）

### Requirement: Dashboard 不显示「最近活动」区块

Dashboard 右侧 MUST NOT 显示「最近活动」feed（依赖未稳定的活动数据源）。

#### Scenario: Dashboard 主体布局
- WHEN 渲染 Dashboard
- THEN 右 1/3 栏 MUST 仅含「可以总结一下了」（条件渲染）+「即将到期」2 个 Card
- AND MUST NOT 出现「最近活动」Card
- AND MUST NOT 调用 useRecentActivity 的渲染逻辑

### Requirement: 「可以总结一下了」引导卡条件化

「可以总结一下了」引导卡 MUST 仅在用户有已完成计划（completedItems > 0）时显示。

#### Scenario: 有已完成计划时显示
- GIVEN 用户存在至少 1 个 completed plan
- WHEN 渲染 Dashboard
- THEN 「可以总结一下了」Card MUST 显示
- AND 「写一篇博客」按钮 MUST 可点击 → 跳 `/blogs/new`

#### Scenario: 无已完成计划时隐藏
- GIVEN 用户无 completed plan（v1.0 新装环境天然成立）
- WHEN 渲染 Dashboard
- THEN 「可以总结一下了」Card MUST NOT 渲染
- AND DOM 中 MUST NOT 含 "可以总结一下了" 文本
- AND DOM 中 MUST NOT 含「写一篇博客」按钮（在该 Card 内）

### Requirement: 验证三关全过

变更实施后 MUST 通过 build / lint / validate 三关。

#### Scenario: 验证
- WHEN 实施完成
- THEN `pnpm build` MUST exit 0 / 0 error
- AND `pnpm lint` MUST exit 0 / 0 warning
- AND `cmd /c openspec.cmd validate fix-v1-0-ux-gap --strict` MUST valid
