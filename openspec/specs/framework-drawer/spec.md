# framework-drawer Specification

## Purpose
TBD - created by archiving change add-framework-drawer. Update Purpose after archive.
## Requirements
### Requirement: 抽屉入口

系统 MUST 在 `BlogEdit` 工具栏的「应用框架」按钮处触发右侧抽屉。

#### Scenario: 工具栏按钮打开抽屉

- **GIVEN** 用户在 `/blogs/:id/edit` 路由
- **WHEN** 点击工具栏「应用框架」按钮
- **THEN** `useUIStore.frameworkDrawerOpen` 置为 `true`
- **AND** 抽屉从右侧滑入（duration 300ms）
- **AND** 焦点移到抽屉内第一个可聚焦元素

#### Scenario: 详情页不显示抽屉

- **GIVEN** 用户在 `/blogs/:id` 路由（只读详情页）
- **WHEN** 渲染 BlogDetail
- **THEN** 工具栏的「应用框架」按钮不显示（只读模式工具栏全部隐藏）
- **AND** `FrameworkDrawerHost` 不挂载

### Requirement: 抽屉壳

系统 MUST 用通用 `Drawer` 组件实现右侧滑入抽屉，宽 480px，含头部（标题+副标题+关闭按钮）+ 内容区 + 底部 CTA。

#### Scenario: 头部内容

- **GIVEN** 抽屉打开
- **WHEN** 渲染头部
- **THEN** 标题「选择博客框架」
- **AND** 副标题「选一个框架，让写作有结构」
- **AND** 关闭按钮（X 图标）

#### Scenario: Esc 关闭

- **GIVEN** 抽屉打开
- **WHEN** 用户按 Esc 键
- **THEN** `closeFrameworkDrawer` 触发
- **AND** 抽屉关闭

#### Scenario: 背景点击关闭

- **GIVEN** 抽屉打开
- **WHEN** 用户点击抽屉背景遮罩
- **THEN** 抽屉关闭

#### Scenario: 关闭按钮

- **GIVEN** 抽屉打开
- **WHEN** 用户点击头部 X 按钮
- **THEN** 抽屉关闭

### Requirement: 预置框架数据

系统 MUST 提供 6-10 个预置框架，覆盖常见写作场景。

#### Scenario: 至少 6 个预置

- **GIVEN** 抽屉首次打开
- **WHEN** 渲染 `FrameworkList`
- **THEN** 显 ≥ 6 个预置框架卡片
- **AND** 覆盖：周复盘 / 项目复盘 / 读书笔记 / OKR / 月度目标 / 习惯养成 / 决策日志 / 学习笔记 / 问题分析 / 回顾模板

#### Scenario: 卡片内容

- **GIVEN** 一个预置框架 `{ id, name, description, icon, category, tags, sections }`
- **WHEN** 渲染 `FrameworkCard`
- **THEN** 显 icon + name
- **AND** 显 description
- **AND** 显 sections 预览（截前 5 条 H2 章节名）
- **AND** 显 tag chips（`tags` 数组所有 tag）

### Requirement: 搜索筛选

系统 MUST 在抽屉内提供搜索框，输入即筛（不区分大小写）。

#### Scenario: 标题匹配

- **GIVEN** 搜索框输入「复盘」
- **WHEN** 过滤算法执行
- **THEN** 保留 name 含「复盘」的框架
- **AND** 其他框架被排除

#### Scenario: 章节名匹配

- **GIVEN** 搜索框输入「目标」
- **WHEN** 过滤算法执行
- **THEN** 保留 sections 任意 heading 含「目标」的框架

#### Scenario: 描述匹配

- **GIVEN** 搜索框输入「决策」
- **WHEN** 过滤算法执行
- **THEN** 保留 description 含「决策」的框架

#### Scenario: 搜索无结果

- **GIVEN** 搜索框输入「xyz_nomatch」
- **WHEN** 过滤完成
- **THEN** 列表为空
- **AND** 显「没有匹配的框架」+「清除筛选」按钮

#### Scenario: 清除搜索

- **GIVEN** 搜索框有内容
- **WHEN** 用户点击搜索框右侧的 X 按钮
- **THEN** 搜索框清空
- **AND** 列表恢复全部预置

### Requirement: Tag 多选筛选

系统 MUST 在搜索框下方提供 tag chips，单击切换选中态；多选 OR 关系（任一匹配即通过）。

#### Scenario: 单 tag 筛选

- **GIVEN** tag chip「学习」被点中
- **WHEN** 过滤算法执行
- **THEN** 保留 tags 含「学习」的框架
- **AND** 其他框架被排除

#### Scenario: 多 tag OR 筛选

- **GIVEN** tag chips「学习」「工作」都被点中
- **WHEN** 过滤算法执行
- **THEN** 保留 tags 含「学习」**或**「工作」的框架
- **AND** 同时含两个 tag 的框架也保留

#### Scenario: 取消 tag

- **GIVEN** tag chip「学习」已选中
- **WHEN** 用户再次点击该 chip
- **THEN** 取消选中
- **AND** 列表恢复（除非有其他筛选条件）

#### Scenario: tag 列表来源

- **GIVEN** 10 个预置框架，每个有 2-4 个 tag
- **WHEN** 渲染 TagFilter
- **THEN** tag chips 为所有预设的 tags 集合（去重后）
- **AND** 顺序按字母 / 出现频次（v1.0 按字母）

### Requirement: 选中态

系统 MUST 让用户能从列表选中一个框架，UI 上有明显视觉反馈。

#### Scenario: 单选

- **GIVEN** 用户点击任一 FrameworkCard
- **WHEN** 卡片被选中
- **THEN** 卡片显高亮（border-accent-300 + bg-accent-50/30 + Check 图标）
- **AND** `aria-pressed="true"`
- **AND** 底部 ApplyBar 按钮启用 + 显「应用《{name}》」

#### Scenario: 切换选中

- **GIVEN** 已选中框架 A
- **WHEN** 用户点击框架 B
- **THEN** A 取消高亮
- **AND** B 显高亮
- **AND** ApplyBar 文案更新为「应用《B 名》」

### Requirement: 应用流程

系统 MUST 让用户点底部「应用」按钮后，把选中的框架章节注入 Tiptap 编辑器，关闭抽屉。

#### Scenario: 应用成功

- **GIVEN** 已选中框架「项目复盘」
- **WHEN** 用户点 ApplyBar「应用《项目复盘》」按钮
- **THEN** 调用 `useApplyFramework.apply(editor, tempFramework)`
- **AND** 编辑器清空 + 注入 N 个 H2 + N 个空段
- **AND** 抽屉关闭
- **AND** 工具栏「应用框架」按钮显对勾（isApplied=true）

#### Scenario: 重复应用幂等

- **GIVEN** 已应用「项目复盘」
- **WHEN** 用户重新打开抽屉 + 再次点「应用《项目复盘》」
- **THEN** `useApplyFramework` 检测已应用，不动内容
- **AND** 抽屉正常关闭

#### Scenario: 切换框架

- **GIVEN** 已应用框架 A
- **WHEN** 用户在抽屉选框架 B + 点应用
- **THEN** 编辑器先 clearContent + 注入 B 的 sections
- **AND** 旧 A 的 H2 章节被替换

#### Scenario: 未选禁用

- **GIVEN** 用户未选任何框架
- **WHEN** 渲染 ApplyBar
- **THEN** 按钮 disabled + 文案「请先选择一个框架」

### Requirement: a11y 基础

系统 MUST 满足基础 a11y：role / aria-* / 焦点环 / 键盘交互。

#### Scenario: 角色与属性

- **GIVEN** 抽屉打开
- **WHEN** 渲染 Drawer
- **THEN** 容器有 `role="dialog" aria-modal="true" aria-labelledby="drawer-title"`
- **AND** 标题元素有 `id="drawer-title"`

#### Scenario: 焦点环

- **GIVEN** 抽屉内任一可聚焦元素
- **WHEN** 用 Tab 键聚焦
- **THEN** 元素显 `focus-visible:ring-2 ring-brand-500` 焦点环

#### Scenario: 简版 focus trap

- **GIVEN** 抽屉打开
- **WHEN** 抽屉滑入动画结束
- **THEN** 焦点移到 ApplyBar「应用」按钮
- **AND** 用户从该按钮按 Shift+Tab 可回到搜索框（v1.0 简版：允许焦点出抽屉；v1.1 完整 trap）

#### Scenario: Tab 顺序

- **GIVEN** 抽屉打开
- **WHEN** 用户连续按 Tab
- **THEN** 焦点顺序：搜索框 → tag chips（按顺序）→ 框架卡片（按顺序）→ ApplyBar 按钮
- **AND** 最后一项按 Tab 焦点循环到第一项

### Requirement: 状态隔离

系统 MUST 让 `frameworkDrawerOpen` / `useFrameworkDrawer` 的临时状态不持久化、不污染其他页面。

#### Scenario: 关闭后刷新

- **GIVEN** 抽屉打开 + query=「复盘」+ tag=「学习」
- **WHEN** 用户关闭抽屉 + 刷新页面
- **THEN** `frameworkDrawerOpen = false`（不持久化）
- **AND** 抽屉临时状态（query / tag / selected）丢失（v1.0 接受）

#### Scenario: 持久化白名单不变

- **GIVEN** `useUIStore` 的 persist 配置
- **WHEN** 验证 partialize 白名单
- **THEN** 不含 `frameworkDrawerOpen`
- **AND** 不含 `frameworkDrawerInitialFrameworkId`

#### Scenario: 跨页面干扰

- **GIVEN** 用户在 PlanDetail 打开 framework-drawer（v1.0 已存在）
- **WHEN** 切到 BlogEdit
- **THEN** PlanDetail 抽屉关闭（不共享状态）
- **AND** BlogEdit 抽屉独立开关

### Requirement: 与 BlogEdit 集成

系统 MUST 让 `BlogEdit` 工具栏的「应用框架」按钮触发抽屉，并把抽屉选中框架传入 `useApplyFramework`。

#### Scenario: BlogEdit 工具栏按钮

- **GIVEN** `BlogEdit` 渲染
- **WHEN** 渲染 EditorToolbar
- **THEN** 「应用框架」按钮 `onClick` 调 `useUIStore.openFrameworkDrawer()`
- **AND** 按钮文案与禁用态与 `add-blog-tiptap-editor` 一致

#### Scenario: 抽屉选中 → BlogEdit 状态更新

- **GIVEN** BlogEdit 渲染 + 抽屉打开
- **WHEN** 抽屉选中框架 + 点应用
- **THEN** BlogEdit 的 `frameworkId` 状态更新
- **AND** `useApplyFramework.apply(editor, tempFramework)` 触发
- **AND** `useApplyFramework.isApplied` 重算
- **AND** 工具栏「应用框架」按钮显对勾

#### Scenario: 不影响 detail 页

- **GIVEN** BlogDetail 用 `<RichEditor readOnly>` 渲染
- **WHEN** BlogDetail 挂载
- **THEN** `FrameworkDrawerHost` 不挂载
- **AND** BlogEdit 抽屉开关不影响 BlogDetail

---

