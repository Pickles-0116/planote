# Changelog

All notable changes to Planote（栖记）are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2025-xx-xx

### 新增 (Added)

- **文件夹体系（F1/F2/F3/F4）**
  - 新增 `folders` 数据表与 `Folder` 领域模型（深度 ≤ 2：root → main → date），支持文件夹树、面包屑路径计算。
  - 全部博客页（`/blogs`）升级为文件夹视图：文件夹筛选下拉、breadcrumb 上钻、按文件夹分组、侧边「管理文件夹」抽屉（新建/重命名/删除/拖拽 reparent）。
  - 博客编辑页新增「所属文件夹」选择器，支持归入任意文件夹；删除文件夹时对子目录与博客做 re-parent（上移一层 / 归入「未分类」），并二次确认，禁止静默丢失数据。
  - 文件夹博客计数（`blogCount`）由 `FolderRepo.bumpBlogCount` 在博客增删/移动时维护。

- **全文检索（B4）**
  - 新增零依赖 `BlogSearchService`（加权子串 / 词频），对标题、标签、正文纯文本（contentText）做本地全文检索。
  - 全部博客页检索结果自动高亮命中的 `searchSnippet`，并纳入 contentText 命中。

- **标签等多维筛选统一（B5）**
  - 新增 `useEntityFilters` 统一筛选 hook 与 `EntityFilterBar` 复用筛选条（状态/时间维度/层级/标签/日期）。
  - 计划列表（`/plans`）接入标签等多维筛选；看板（`/kanban`）接入统一多维筛选（标签/层级/时间维度），并由所属 plan 派生维度。

- **AI 停止按钮与状态条（B10）**
  - 新增共享 `AIStatusBar` 组件，在润色 / 模板 / 仿写三个 AI 生成器中展示生成状态并提供「停止」按钮（调用 `useAIGenerate().cancel()`）；三个生成器统一以 `cancelledRef` 防护，取消后均跳过 `editor.commands.setContent`，避免把不完整片段注入编辑器。

### 变更 (Changed)

- 版本号由 `0.1.0` 提升至 `1.2.0`。
- Dexie schema 升至 `version(5)`，增量补齐 `folders` 表与 `blogs.folderId` 字段（每个 version 完整重声明全部表）。
- 启动初始化链补充 `ensureFolders()`（保证 root 存在）与 `reconcileTags()`（一次性标签修复）。

### 已核对 / 已完成 (Verified / Done)

- **A3 归档 OpenSpec changes**：将原 6 个活跃 `ai-chat-*` 变更（ai-chat-core-ui、ai-chat-create-content、ai-chat-foundation、ai-chat-intent-routing、ai-chat-smart-qa、ai-chat-telemetry-polish）整体移动至 `openspec/changes/archive/`（目录名与内容保持完整）。`changes/` 下仅余 `ai-config-improvements` 待后续处理。

### 备注 (Notes)

- 关于依赖：原计划使用 MiniSearch 做全文检索，因沙箱环境安装被拦截，改用零依赖自研 `BlogSearchService`（百条级数据检索 < 50ms，满足本地面板场景）。
- 实现以已批准的 `docs/v1.2/design.md` 架构设计 + 团队拍板的 5 项决策为准。

## [1.3.0] - AI 助理（规划中 / Planned）

> 以下为已在路线图中规划、尚未在本迭代落地的 AI 能力，列出以供前瞻：

- **AI 对话 / 总结模块（v1.3-AI）**
  - 基于 `ai-chat` 已调研方案，提供计划/博客的对话式问答与自动总结。
  - 复用本迭代新增的 `contentText`、`searchSnippet`、标签与文件夹维度作为检索与上下文输入。
  - 复用 `useAIGenerate` 生成管线和 `AIStatusBar` 停止/状态条交互。
  - 设计阶段产出见 `openspec/changes/ai-chat-create-content/design.md` 等历史调研文档。

<!-- 历史版本保留区（0.1.0 之前的脚手架与仪表盘迭代） -->
