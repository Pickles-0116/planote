# dashboard-trim-2 Specification

## Purpose
TBD - created by archiving change fix-v1-0-ux-gap-2. Update Purpose after archive.
## Requirements
### Requirement: Sidebar「计划」NavItem 不含硬编码徽章

Sidebar 「计划」导航项 MUST NOT 包含任何硬编码 badge 数据。

#### Scenario: Sidebar「计划」无徽章
- GIVEN 用户进入任一页面
- WHEN 渲染 Sidebar
- THEN 「计划」导航项 MUST NOT 显示任何 badge（数字 / 文字）
- AND PRIMARY_NAV 中「计划」的 NavItem MUST NOT 包含 `badge` 字段

### Requirement: 设置页底部必须显示 DataInspector 区块

设置页底部 MUST 显示 DataInspector 组件，用于让用户直观确认 IndexedDB 持久化数据。

#### Scenario: DataInspector 渲染
- GIVEN 用户访问 `/settings` 页面
- WHEN 渲染 Settings
- THEN 页面底部 MUST 出现「数据状态」标题区块
- AND 区块 MUST 含说明文字「数据存于浏览器 IndexedDB」

#### Scenario: DataInspector 实时显示表行数
- GIVEN DataInspector 已挂载
- WHEN Dexie 任意表数据变化（新增 / 删除）
- THEN DataInspector MUST 自动更新对应表的 count
- AND MUST 显示 6 张业务表 + 1 张 meta 表 = 7 项的 count

### Requirement: 验证三关全过

变更实施后 MUST 通过 build / lint / validate 三关。

#### Scenario: 验证
- WHEN 实施完成
- THEN `pnpm build` MUST exit 0 / 0 error
- AND `pnpm lint` MUST exit 0 / 0 warning
- AND `cmd /c openspec.cmd validate fix-v1-0-ux-gap-2 --strict` MUST valid

