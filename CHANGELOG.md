# Changelog

All notable changes to Planote will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-19

🎉 **v1.0 收官（核心可用版）** —— 跑通"创建计划 → 勾选完成 → 生成博客 → 发布"主流程。

### Added

**仪表盘与全局**
- 仪表盘：4 个关键数字（本月完成率 / 进行中计划 / 累计完成事项 / 已发布博客）+ 今日聚焦 + 即将到期 + 最近博客 + 活动流（liveQuery 接入真实数据）
- 全局布局：左侧栏 + 顶栏 + 9 路由 Outlet，主题/主色/字号切换（dark / 浅色 / 护眼）
- 键盘快捷键：`Cmd/Ctrl + N` 新建计划，`Cmd/Ctrl + B` 新建博客，`Cmd/Ctrl + K` 全局搜索，`Cmd/Ctrl + S` 保存，`Cmd/Ctrl + \` 折叠侧边栏
- 设置中心：主题 + 主色 + 字号 + 标签管理 + 数据导入 / 导出 / 清除

**计划模块**
- 计划 CRUD：3 步骤表单（基础信息 / 类型与维度 / 拆解事项），支持短 / 中 / 长期 × 每日 / 每月 / 每年 / 一次性
- 计划详情：SVG 进度环 + 进度条 + 百分比 + 计数（5+ UI 元素联动）
- 事项管理：增删改、勾选自动联动进度、@dnd-kit 拖拽排序（限 50 项）
- 100% 完成金色 shimmer 横幅 + "生成总结博客" CTA
- 计划列表三种视图模式：分组（默认，每组前 5 + 折叠）/ 全部（紧凑横排 + 分页）/ 表格（TanStack Table + 多选 + 批量操作）
- 计划智能排序：🔴 今天截止 → 🟠 1-3 天 → 🟡 4-7 天 → 进度从高到低
- 全局实时搜索 + 删除二次确认

**博客模块**
- Tiptap v2 富文本编辑器：三栏布局（标题 / 工具栏 / 正文）+ 右侧发布设置 + 自动保存（5s debounce + 状态指示器）
- 工具栏 9 个格式按钮 + "使用框架"高亮按钮（amber 色）
- 框架抽屉：4 套内置框架（项目复盘 / 21 天习惯复盘 / 读书笔记 / 月度总结），分类 Tab + 卡片 + 预览 + 一键应用，Esc / 背景点击 / 背景滑动均可关闭
- 应用框架：把章节结构 + 引导问题注入编辑器，预填计划数据
- 附件上传：图片（PNG / JPG / GIF）+ Markdown / TXT 解析入正文，Blob 存 IndexedDB
- 博客列表：卡片网格 + 状态 Tab（全部 / 草稿 / 已发布 / 归档）+ 标签云 + 分页
- 博客详情：阅读模式 + 来源计划绿色提示条 + 附件下载
- 关联计划选择器（搜索 + 多选）+ 网络搜索面板 UI 占位

**看板与集成**
- 看板：4 列状态视图（未开始 / 进行中 / 已完成 / 已搁置）+ 5 维时间过滤（今日 / 本周 / 本月 / 本年 / 全部）+ 类型 / 层级 / 标签筛选 + 卡片状态切换
- 数据导入 / 导出 / 清除：JSON 格式全量备份 + 合并导入 + 二次确认
- 关于页：版本号、技术栈、致谢
- 撤销 / 重做栈（最近 20 步）

### Tech Stack

| 维度 | 选型 | 版本 |
|------|------|------|
| 框架 | React | 18.3+ |
| 语言 | TypeScript | 5.6+（strict） |
| 构建 | Vite | 5.4+ |
| 样式 | Tailwind CSS | 3.4+（CSS 变量驱动主题） |
| 状态 | Zustand | 5.0+（含 persist 中间件） |
| 数据 | Dexie + IndexedDB | 4.4+ |
| 路由 | React Router | 6.26+（data router） |
| 编辑器 | Tiptap | 2.6+（基于 ProseMirror） |
| 表格 | TanStack Table | 8.x |
| 拖拽 | @dnd-kit | 6.x |
| 虚拟列表 | react-virtuoso | 4.x |
| 图标 | Lucide React | latest |
| ID | ULID | 3.x |

### OpenSpec

v1.0 通过 OpenSpec 流程闭环，**14 个 change 全部归档**：

| # | Change | 归档目录 | 关联 spec |
|---|--------|---------|-----------|
| 1 | add-data-layer-dexie | `archive/2026-07-19-add-data-layer-dexie/` | `plan-data` |
| 2 | add-zustand-stores | `archive/2026-07-19-add-zustand-stores/` | `ui-state` |
| 3 | add-app-shell | `archive/2026-07-19-add-app-shell/` | `ui-shell` |
| 4 | add-data-binding-dashboard | `archive/2026-07-19-add-data-binding-dashboard/` | `dashboard-data` |
| 5 | add-plan-edit-form | `archive/2026-07-19-add-plan-edit-form/` | `plan-edit` |
| 6 | add-plan-detail-view | `archive/2026-07-19-add-plan-detail-view/` | `plan-detail` |
| 7 | add-plan-list-view | `archive/2026-07-19-add-plan-list-view/` | `plan-list` |
| 8 | add-smart-sort | `archive/2026-07-19-add-smart-sort/` | `sort-engine` |
| 9 | add-blog-tiptap-editor | `archive/2026-07-19-add-blog-tiptap-editor/` | `blog-editor` |
| 10 | add-framework-drawer | `archive/2026-07-19-add-framework-drawer/` | `framework-drawer` |
| 11 | add-blog-attachment | `archive/2026-07-19-add-blog-attachment/` | `blog-attachment` |
| 12 | add-blog-list-and-detail | `archive/2026-07-19-add-blog-list-and-detail/` | `blog-list-and-detail` |
| 13 | add-kanban-board | `archive/2026-07-19-add-kanban-board/` | `kanban-board` |
| 14 | add-settings-and-shell | `archive/2026-07-19-add-settings-and-shell/` | `settings-and-shell` |

`openspec list` 当前为空（全部归档），新增需求走 `proposal → design → specs → tasks → archive` 闭环。

### Notes

- 数据全部本地存储（IndexedDB + localStorage），无任何网络请求
- 真实网络搜索、PDF/DOCX 解析、云同步推迟到 v1.1+
- dark mode 在 v1.0 已全站适配（v1.0 末班车补齐）

[1.0.0]: https://example.com/planote/releases/tag/v1.0.0
