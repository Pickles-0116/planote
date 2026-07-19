# settings-and-shell Specification

## Purpose
TBD - created by archiving change add-settings-and-shell. Update Purpose after archive.
## Requirements
### Requirement: Settings 中心 4 区块

系统 MUST 在 `/settings` 路由提供 4 区块设置中心（主题 / 数据 / 关于 / 反馈占位），左侧导航切换。

#### Scenario: 默认进入主题设置

- **GIVEN** 用户首次访问 `/settings`
- **WHEN** 页面加载
- **THEN** 默认显示「主题」区块（4 选项：跟随系统 / 浅色 / 深色）

#### Scenario: 点击「数据」切换

- **GIVEN** 当前在「主题」区块
- **WHEN** 点击左侧「数据」导航项
- **THEN** 右侧内容切换为「数据」区块（导出 / 导入 / 清除）

#### Scenario: 4 区块齐全

- **GIVEN** Settings 页加载
- **WHEN** 检查左侧导航
- **THEN** 含 4 项：主题 / 数据 / 关于 / 反馈（v1.0 反馈区块显示「v1.1 计划内」占位）

---

### Requirement: 主题切换（system / light / dark）

系统 MUST 提供 3 档主题切换：跟随系统 / 浅色 / 深色；切换立即生效；持久化到 localStorage。

#### Scenario: 切换到深色

- **GIVEN** 当前主题为浅色
- **WHEN** 用户选择「深色」
- **THEN** `useUIStore.theme` 设为 `'dark'`
- **AND** `document.documentElement` 加 `class="dark"`
- **AND** 全站 dark 模式立即生效（无刷新）

#### Scenario: 跟随系统

- **GIVEN** 当前主题为浅色
- **WHEN** 用户选择「跟随系统」
- **THEN** `useUIStore.theme` 设为 `'system'`
- **AND** resolvedTheme 跟随 `prefers-color-scheme` media query
- **AND** 系统切到深色时，全站自动 dark 模式

#### Scenario: 持久化

- **GIVEN** 用户选择「深色」并刷新页面
- **WHEN** 页面重新加载
- **THEN** 主题保持「深色」（useUIStore persist 生效）
- **AND** 无 FOUC（main.tsx 内联 init 在 React 渲染前应用 class）

#### Scenario: NavBar 显示当前主题

- **GIVEN** Header 右上角主题入口
- **WHEN** 当前 resolvedTheme 为深色
- **THEN** 显示 🌙 图标 + 「深色」文字

---

### Requirement: dark mode 全站适配

系统 MUST 在 dark 模式下，全站（AppLayout / Sidebar / Header / 9 页面 + 共享组件）有合理 dark 颜色，无白底残留或文字不可见。

#### Scenario: 浅色 → 深色切换

- **GIVEN** 当前浅色模式
- **WHEN** 切换到深色
- **THEN** 主背景：`bg-stone-50` → `dark:bg-stone-900`
- **AND** 卡片背景：`bg-white` → `dark:bg-stone-800`
- **AND** 主文字：`text-brand-900` → `dark:text-stone-100`
- **AND** 边框：`border-stone-200` → `dark:border-stone-700`

#### Scenario: 看板页 dark 适配

- **GIVEN** 切换到深色
- **WHEN** 访问 `/kanban`
- **THEN** 看板 4 列 `bg-stone-50` → `dark:bg-stone-800`
- **AND** KanbanCard `bg-white` → `dark:bg-stone-800`
- **AND** 拖拽 ring-brand-500 在 dark 模式仍可见
- **AND** 拖拽交互（onDragStart / onDragOver / onDrop）正常（dark 模式不影响逻辑）

#### Scenario: 计划详情 dark 适配

- **GIVEN** 切换到深色
- **WHEN** 访问 `/plans/:id`
- **THEN** ItemRow dark 背景 + dark 文字
- **AND** 进度环 dark 模式正常显示
- **AND** 关联博客区 dark 适配

#### Scenario: 紧急度 chip 保持语义色

- **GIVEN** 计划紧急度为 🔴 红
- **WHEN** 切换到 dark 模式
- **THEN** 红色 chip 仍为红色（语义色不跟随 dark 变）

---

### Requirement: 数据导出 JSON

系统 MUST 在「数据」区块提供「导出 JSON 备份」按钮，导出全部 6 张表 + 版本号 + 导出时间。

#### Scenario: 导出成功

- **GIVEN** 用户点击「导出 JSON 备份」
- **WHEN** 按钮触发
- **THEN** 浏览器下载 `planote-backup-2026-07-19.json`
- **AND** 文件含 `{ version: 1, exportedAt, plans, items, blogs, frameworks, tags, attachments }`
- **AND** 附件 blob 转为 base64 dataURL 嵌入

#### Scenario: 0 数据导出

- **GIVEN** 数据库全空
- **WHEN** 导出
- **THEN** JSON 含空数组（不是 null） + 仍可下载

#### Scenario: 导出失败

- **GIVEN** 附件过大或存储损坏
- **WHEN** 导出过程抛错
- **THEN** toast「导出失败」+ 不下载文件

---

### Requirement: 数据导入（merge / replace）

系统 MUST 在「数据」区块提供「导入」功能，支持「合并」与「替换」两模式。

#### Scenario: 合并导入

- **GIVEN** 模式切换到「合并」
- **WHEN** 用户选 JSON 文件 + 确认
- **THEN** 6 张表 `bulkPut` 写入（不删除现有数据）
- **AND** 同 id 数据被覆盖（id 冲突时新数据胜）
- **AND** toast「导入成功」

#### Scenario: 替换导入

- **GIVEN** 模式切换到「替换」
- **WHEN** 用户选 JSON 文件 + 确认
- **THEN** 6 张表先 `clear()` 再 `bulkPut`
- **AND** 旧数据全部清空
- **AND** toast「导入成功」+ 提示「已清空 N 条旧数据」

#### Scenario: 版本不匹配

- **GIVEN** 导入文件 `version: 2`（v1.1 格式）
- **WHEN** 导入
- **THEN** toast「导出文件版本不匹配（v1.0 仅支持 v1）」+ 不动原数据

#### Scenario: 字段缺失

- **GIVEN** 导入文件缺 `items` 数组
- **WHEN** 导入
- **THEN** toast「导出文件格式错误：缺少 items 表」+ 不动原数据

#### Scenario: JSON 解析失败

- **GIVEN** 选的文件不是有效 JSON
- **WHEN** 导入
- **THEN** toast「JSON 解析失败」+ 不动原数据

---

### Requirement: 清除数据（二次确认）

系统 MUST 在「数据」区块提供「清除全部数据」按钮，需双层确认（弹窗 + 输入「确认清除」文字）。

#### Scenario: 第一次点击

- **GIVEN** 用户点击「清除全部数据」
- **WHEN** 按钮触发
- **THEN** 弹窗打开，含提示「将删除全部 N 条数据，此操作不可逆」+ 输入框 + 「我已了解风险，清除」按钮（默认 disabled）

#### Scenario: 输入文字启用按钮

- **GIVEN** 弹窗打开 + 输入框为空
- **WHEN** 用户输入「确认清除」
- **THEN** 「我已了解风险，清除」按钮 enabled
- **AND** 输入其他文字（如「确认」）按钮仍 disabled

#### Scenario: 执行清除

- **GIVEN** 弹窗 enabled 按钮
- **WHEN** 用户点击「我已了解风险，清除」
- **THEN** 6 张表 `clear()` 事务执行
- **AND** toast「已清除全部数据」+ 跳 `/` Dashboard
- **AND** Dashboard 显示空态（EmptyState illustration）

#### Scenario: 取消

- **GIVEN** 弹窗打开
- **WHEN** 用户点击「取消」或按 Esc
- **THEN** 弹窗关闭 + 数据库不动

---

### Requirement: FOUC 防御

系统 MUST 在页面刷新时，无 dark/light 模式闪烁（FOUC = Flash of Unstyled Content）。

#### Scenario: 深色用户刷新页面

- **GIVEN** localStorage 存 `theme: 'dark'`
- **WHEN** 浏览器刷新
- **THEN** main.tsx 内联 init 同步读 localStorage
- **AND** 在 createRoot 之前 `documentElement.classList.add('dark')`
- **AND** 用户视觉看到的是稳定的深色（无浅色闪屏）

#### Scenario: 跟随系统 + 系统深色

- **GIVEN** `theme: 'system'` + 系统 `prefers-color-scheme: dark`
- **WHEN** 浏览器刷新
- **THEN** main.tsx 检测系统主题 + 应用 dark class
- **AND** 无闪屏

#### Scenario: localStorage 损坏

- **GIVEN** localStorage 含无效 JSON
- **WHEN** 浏览器刷新
- **THEN** catch 错误 + 默认 light 模式 + 不抛错

---

### Requirement: 关于页

系统 MUST 在「关于」区块显示版本号 + 开源致谢 + 版权。

#### Scenario: 显示版本号

- **GIVEN** 用户点击「关于」
- **WHEN** 渲染 AboutSettings
- **THEN** 显示「Planote · 栖记 v1.0.0」+ 发布日期「2026.07」

#### Scenario: 致谢列表

- **GIVEN** AboutSettings 渲染
- **WHEN** 检查致谢区块
- **THEN** 列 ≥ 5 项开源项目：React / Tailwind / Dexie / Zustand / Tiptap（具体列表见 design.md §3.5）

#### Scenario: 版权声明

- **GIVEN** AboutSettings 渲染
- **WHEN** 检查底部
- **THEN** 显示「© 2026 Planote · 个人项目，仅供学习与个人使用」

---

### Requirement: useUIStore theme 字段语义升级

系统 MUST 将 `useUIStore.theme` 字段从「实际主题」（`light | dark | eye-care`）升级为「期望主题含 system」（`system | light | dark`），并通过 `useTheme` hook 解析为实际值。

#### Scenario: 新字段值

- **GIVEN** `useUIStore.theme` 字段
- **WHEN** 检查类型
- **THEN** 类型为 `'system' | 'light' | 'dark'`，默认 `'system'`

#### Scenario: 旧值迁移

- **GIVEN** localStorage 存旧 `theme: 'light' | 'dark' | 'eye-care'`
- **WHEN** 浏览器加载
- **THEN** useUIStore persist version 升级 1 → 2 + migrate 函数
- **AND** `eye-care` 降级为 `light`（v1.0 暂不实现 eye-care 主题）

#### Scenario: useTheme 解析

- **GIVEN** `useUIStore.theme = 'system'` + 系统 light
- **WHEN** 调 `useTheme()`
- **THEN** 返回 `{ theme: 'system', resolvedTheme: 'light', setTheme }`

#### Scenario: 系统主题变化监听

- **GIVEN** `theme = 'system'` + 系统从 light 切到 dark
- **WHEN** 系统主题变化
- **THEN** useTheme 监听 matchMedia → 自动应用 dark class
- **AND** 全站切到 dark 模式

---

### Requirement: 反馈占位

系统 MUST 在「反馈」区块显示 v1.1 计划内的占位说明。

#### Scenario: 反馈区块渲染

- **GIVEN** 用户点击「反馈」
- **WHEN** 渲染 FeedbackSettings
- **THEN** 显示占位 EmptyState + 「反馈功能 v1.1 计划内」+ 暂无可用反馈渠道

---

