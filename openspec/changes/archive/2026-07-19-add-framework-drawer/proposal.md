# Proposal · 博客框架库抽屉

## Why

当前 PRD v1.0 已把"框架库"从"独立管理页面"降级为"轻量抽屉"——但博客编辑页目前仍是裸 Tiptap，工具栏上的"应用框架"按钮背后是 1 个空函数：

- 用户在 `BlogEdit` 写完博客后想用「项目复盘 / 21 天习惯 / 读书笔记 / 月度总结」等预设框架时，**无法快速浏览/搜索/筛选**全部预设框架
- 框架选择当前是 `<select>` 下拉，4 个选项挤在一行；超过 6 个之后下拉就难以阅读
- 抽屉是 v1.0 已锁定的 UI 模式（`src/components/shell/Drawer.tsx` 已实现），与 prototype `plan-detail.html` 的 framework-drawer 视觉一致，但目前**只暴露给 `PlanDetail` 用**
- 博客侧缺一个独立的 framework-drawer 入口；新建博客时也无法挑选框架起手

这一轮把"框架库抽屉"从计划详情页的能力外推到**博客编辑器**侧——工具栏触发，从右侧滑入，展示 6-10 个预置框架，支持搜索/标签筛选/选中后应用。

## What Changes

### 1. 框架库抽屉壳

- 新建 `src/features/framework/components/FrameworkDrawer.tsx` —— 复用现有 `src/components/shell/Drawer.tsx`（右侧滑入 + Esc 关闭 + 背景点击关闭）
- 新建 `FrameworkDrawerHost.tsx` —— 顶层挂载，订阅 `useUIStore.frameworkDrawerOpen` 控制 open 状态
- 视觉对齐 prototype `framework-drawer`：标题「选择博客框架」+ 副标题"选一个框架，让写作有结构"

### 2. 预置框架数据

- 新建 `src/features/framework/data/presets.ts` —— 6-10 个内置框架（与 v1.0 plan-store 4 套内置去重 + 扩展）
  - 周复盘 / 项目复盘 / 读书笔记 / OKR / 月度目标 / 习惯养成 / 决策日志 / 学习笔记 / 问题分析 / 回顾模板
- 每条带 `tags: string[]`（多标签）和 `description: string`，供筛选/搜索

### 3. 列表 + 卡片

- 新建 `src/features/framework/components/FrameworkList.tsx` —— 框架卡片列表（filter + search 后渲染）
- 新建 `FrameworkCard.tsx` —— 单个卡片：标题 + 描述 + 章节预览（最多 5 条）+ tag chips
- 选中态：左侧 2px brand-900 边 + 浅色背景

### 4. 搜索 + 标签筛选

- `src/features/framework/hooks/useFrameworkDrawer.ts` —— 状态机（query / selectedTags / selectedFrameworkId）+ 过滤逻辑
- 搜索框：输入即筛（按标题 / 章节名 / 描述 任意匹配）
- Tag 筛选：多选 chip，单击切换；多 tag 是 OR 还是 AND？**v1.0 用 OR**

### 5. Store 改造

- `src/stores/uiStore.ts` 新增 `frameworkDrawerOpen: boolean` + `frameworkDrawerInitialFrameworkId: ID | null`
- 配套 action：`openFrameworkDrawer(frameworkId?)` / `closeFrameworkDrawer()`
- 不持久化（与现有 `drawerStack` 规则一致：抽屉状态不写 localStorage）

### 6. BlogEdit 集成

- `src/pages/blogs/BlogEdit.tsx` 工具栏的"应用框架"按钮（已在 `add-blog-tiptap-editor` 落地）改为触发抽屉：`openFrameworkDrawer()`
- 抽屉选中框架后调 `useFrameworkStore.applyFramework(frameworkId)` → Tiptap editor 拿到 JSON 后用 `useApplyFramework.apply()` 注入章节
- 应用成功后：抽屉关闭 + 工具栏「应用框架」按钮显对勾

### 7. a11y

- `role="dialog" aria-modal="true" aria-labelledby="drawer-title"`
- Esc 关闭（沿用 `Drawer.tsx` 内建）
- Tab 焦点环（Tailwind `focus-visible:ring-2`）
- v1.0 简化的 focus trap：首次打开聚焦"应用"按钮（v1.1 完整 focus trap）

## Scope

**In Scope**：

- 新建 `src/features/framework/components/FrameworkDrawer.tsx` + `FrameworkDrawerHost.tsx` + `FrameworkList.tsx` + `FrameworkCard.tsx`
- 新建 `src/features/framework/data/presets.ts`（6-10 个预置框架）
- 新建 `src/features/framework/hooks/useFrameworkDrawer.ts`
- 改造 `src/stores/uiStore.ts`（增 `frameworkDrawerOpen` + 配套 action）
- 改造 `src/pages/blogs/BlogEdit.tsx`（工具栏按钮触发抽屉 + 集成 `useApplyFramework`）
- 新建 `src/stores/useFrameworkDrawer.ts`（按 tags 过滤、搜索）
- spec 增量：新增 `framework-drawer` capability，9-10 个 ADDED Requirements

**Out of Scope**（明确不做）：

- 框架 CRUD（新建 / 编辑 / 删除 / 排序）—— v1.0 只消费预置
- 用户自定义框架 —— v1.2 后续
- 框架版本管理（v1 → v2 迁移）—— v1.2
- 框架云同步（v1.1 之后）
- 完整 focus trap 实现（v1.0 简化为首次聚焦"应用"按钮）
- 抽屉嵌套抽屉（v1.0 同一时间只允许一个 framework-drawer）

## Acceptance Criteria

- [ ] **AC-1**：`BlogEdit` 工具栏「应用框架」按钮触发右侧抽屉
- [ ] **AC-2**：抽屉显示 ≥ 6 个预置框架卡片（标题 + 描述 + 章节预览 + tag）
- [ ] **AC-3**：搜索框输入即筛（按标题 / 章节名 / 描述）
- [ ] **AC-4**：tag 筛选（多选 chip，单击切换；v1.0 多选 OR）
- [ ] **AC-5**：选中卡片点「应用」→ 调用 `useApplyFramework.apply(editor, framework)` → 抽屉关闭 + 工具栏显示已应用对勾
- [ ] **AC-6**：键盘 Esc 关闭抽屉；Tab 焦点环可见
- [ ] **AC-7**：`pnpm build` 0 error / `pnpm lint` 0 warning
- [ ] **AC-8**：`openspec validate add-framework-drawer --strict` 通过

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| 预置框架数据膨胀（用户期待可删除/排序）| 中 | v1.0 显式说明只读；preset list 8-10 个封顶 |
| 多抽屉嵌套冲突 | 中 | v1.0 限制同时只一个 framework-drawer；store 维护单实例 |
| `useApplyFramework.apply()` 与「清空内容」的副作用 | 中 | apply 内已用 `editor.commands.clearContent()`，覆盖旧内容；用户必须主动点应用按钮，避免误清空 |
| 搜索性能（10 条以内无需虚拟化）| 低 | v1.0 仅 6-10 条；后续 v1.2 用户自建框架后再加虚拟化 |
| tag 筛选 UX 歧义（OR vs AND）| 中 | v1.0 显式 OR（任一匹配即筛过）；按钮文案"包含任一标签"避免歧义 |
| 抽屉与 `add-blog-tiptap-editor` 的「应用框架」按钮重复 | 低 | v1.0 工具栏按钮 = 抽屉触发器；apply 走抽屉路径；按钮仅做入口 |

## Dependencies

- **上游（已完成）**：
  - `add-blog-tiptap-editor`：`<RichEditor>` + `useApplyFramework.apply()` 已可用
  - `add-zustand-stores`：`useUIStore` + `useFrameworkStore`（含 `applyFramework` action）
  - `add-app-shell`：`<Drawer>` 通用壳已就绪
  - `add-data-layer-dexie`：`Framework` 模型 + 内置 4 套种子数据

- **下游（待启动）**：
  - `add-framework-management`：v1.2 用户自定义框架 UI（CRUD）
  - `add-blog-list`：博客列表页可能复用同一抽屉

## Out of Scope Reminder

- 不实现框架 CRUD
- 不实现用户自定义框架
- 不实现框架版本管理
- 不实现云同步
- 不写单测
- 不引入新依赖（用现有 Drawer / Lucide / Tailwind）
- 不破坏现有 `PlanDetail` 侧的 framework-drawer（独立共存）
