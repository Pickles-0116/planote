# Tasks · 博客框架库抽屉

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **时间预算**：~1.2 人天；每段工时按「单 task ≤ 25min」拆分。
> **完成日期**：2026-07-19 (Round 9)
> **依赖**：add-blog-tiptap-editor 已落地（`useApplyFramework` + `<RichEditor>` 可用）

---

## 1. 预置数据

- [x] 1.1 `src/features/framework/data/presets.ts` → 6-10 个预置框架数据
  - 导出 `PresetFramework` / `PresetSection` interface
  - 导出 `FRAMEWORK_PRESETS` 常量（10 条）：周复盘 / 项目复盘 / 读书笔记 / OKR / 月度目标 / 21天习惯 / 决策日志 / 学习笔记 / 问题分析 / 回顾模板
  - 每个 preset 含 3-5 个 sections（heading + guide + placeholder）
  - 每个 preset 含 2-4 个 tags
  - 包含 `id`（字符串 ULID 风格）、`name` / `description` / `icon` / `category`
- [x] 1.2 `src/features/framework/data/presets.ts` → 导出 `ALL_PRESET_TAGS`
  - 从 `FRAMEWORK_PRESETS` 聚合所有 tags + 去重 + 字母排序
  - 供 TagFilter 用
- [x] 1.3 `src/features/framework/data/presets.ts` → 导出 `toDexieFramework(preset)`
  - 工具函数：把 `PresetFramework` 转成 Dexie `Framework`（给 `useApplyFramework.apply` 用）
  - 字段映射：`id / name / description / category / icon / sections / useCount=0 / builtin=true`
  - v1.0 实际未用（BlogEdit 直接处理 preset），保留供未来 v1.1 复用

## 2. Store 状态扩展

- [x] 2.1 `src/stores/uiStore.ts` → 增 `frameworkDrawerOpen` 字段
  - 类型：`boolean`，默认 `false`
  - 持久化白名单**不**追加（抽屉不写 localStorage）
- [x] 2.2 `src/stores/uiStore.ts` → 增 `frameworkDrawerInitialFrameworkId` 字段
  - 类型：`ID | null`，默认 `null`
  - 同上不持久化
- [x] 2.3 `src/stores/uiStore.ts` → 增 `openFrameworkDrawer(initialFrameworkId?: ID)` action
  - 设置 `frameworkDrawerOpen = true` + `frameworkDrawerInitialFrameworkId = initialFrameworkId ?? null`
- [x] 2.4 `src/stores/uiStore.ts` → 增 `closeFrameworkDrawer()` action
  - 设置 `frameworkDrawerOpen = false`（保留 `frameworkDrawerInitialFrameworkId`，方便下次打开复用）
- [x] 2.5 `src/stores/uiStore.ts` → 类型导出
  - 现有 `UIStoreState` 已自动含新字段；从 `uiStore.ts` 导出类型，组件复用

## 3. 状态机 hook

- [x] 3.1 `src/features/framework/hooks/useFrameworkDrawer.ts` → 状态定义
  - useState：`query: string` / `selectedTags: string[]` / `selectedId: ID | null`
  - 内部 setter：`setQuery` / `toggleTag(tag)` / `selectFramework(id)`
  - `toggleTag`：在 `selectedTags` 中切换 tag（push / filter）
- [x] 3.2 `src/features/framework/hooks/useFrameworkDrawer.ts` → 过滤逻辑
  - useMemo 计算 `filtered: PresetFramework[]`
  - 逻辑：先 tag OR 过滤，再 query 包含过滤（name / section.heading / description 任一）
- [x] 3.3 `src/features/framework/hooks/useFrameworkDrawer.ts` → 选中实例
  - useMemo 计算 `selected: PresetFramework | null`（从 `filtered` 找 `selectedId`）
- [x] 3.4 `src/features/framework/hooks/useFrameworkDrawer.ts` → 清除筛选
  - `clearFilters()`：清空 query + selectedTags
  - 用于「清除筛选」按钮

## 4. 搜索 + Tag 筛选子组件

- [x] 4.1 `src/features/framework/components/SearchBar.tsx` → 搜索框
  - props: `{ value, onChange }`
  - input + 左侧 `<Search>` icon + 右侧 `<X>` 清除按钮（value 非空时显）
  - 高 36px，rounded-xl，bg-stone-50
  - a11y：`aria-label="搜索框架"`
- [x] 4.2 `src/features/framework/components/TagFilter.tsx` → tag 筛选
  - props: `{ tags: string[]; selected: string[]; onToggle: (tag: string) => void }`
  - chip 列表：横向 scroll，激活态 brand-900 背景白字
  - a11y：`role="switch" aria-checked` + `aria-label="筛选标签 {tag}"`

## 5. 列表 + 卡片

- [x] 5.1 `src/features/framework/components/FrameworkCard.tsx` → 单卡片
  - props: `{ framework: PresetFramework; isSelected: boolean; onClick: () => void; isApplied?: boolean }`
  - 内部：icon + name + description + sections 预览（截前 5 条） + tag chips
  - 选中态：border-2 border-accent-300 + bg-accent-50/30 + 右侧 `<Check>` 图标
  - a11y：`role="button" aria-pressed={isSelected} aria-label="{name}：{description}"`
- [x] 5.2 `src/features/framework/components/FrameworkList.tsx` → 列表容器
  - props: `{ items: PresetFramework[]; selectedId: ID | null; onSelect: (id: ID) => void; onClearFilters: () => void; hasFilters: boolean; appliedId?: ID | null }`
  - 渲染 items
  - 空态：`hasFilters ? "没有匹配的框架" + "清除筛选"按钮 : "暂无可用框架"`
  - max-height + overflow-y-auto
- [x] 5.3 `src/features/framework/components/ApplyBar.tsx` → 底部 CTA
  - props: `{ selected: PresetFramework | null; onApply: () => void }` + `ref`
  - 禁用态：未选时显「请先选择一个框架」+ bg-stone-100
  - 启用态：显「应用《{selected.name}」」+ bg-brand-900
  - sticky bottom，shadow 提升

## 6. 抽屉壳

- [x] 6.1 `src/features/framework/components/FrameworkDrawer.tsx` → 抽屉壳
  - props: `{ open, onClose, onApply, appliedFrameworkId? }`
  - 内部用 `useFrameworkDrawer` hook
  - 布局：`<Drawer>` 包裹（标题"选择博客框架"+副标题）→ `<SearchBar>` → `<TagFilter>` → `<FrameworkList>` → `<ApplyBar>`
  - ApplyBar 点击：调 `onApply(selected!)`（未选时按钮 disabled 拦截）
  - 焦点：open 时 useEffect 聚焦 ApplyBar「应用」按钮
  - body 滚动锁：open 时 `document.body.style.overflow = 'hidden'`
- [x] 6.2 `src/features/framework/components/FrameworkDrawerHost.tsx` → 顶层挂载
  - 订阅 `useUIStore.frameworkDrawerOpen` + `closeFrameworkDrawer`
  - 渲染 `<FrameworkDrawer>` 注入 open / onClose
  - props: `{ onApply, appliedFrameworkId? }`
- [x] 6.3（新增）`src/features/framework/components/FrameworkGenerationDrawer.tsx` + `FrameworkGenerationDrawerHost.tsx`
  - 原 PlanDetail 侧 drawer 重命名（按 design.md §2.1）
  - AppLayout 改用 FrameworkGenerationDrawerHost

## 7. BlogEdit 集成

- [x] 7.1 `src/pages/blogs/BlogEdit.tsx` → 工具栏按钮改为触发抽屉
  - `EditorToolbar` 的 `onApplyFramework` prop 改为：`useUIStore.openFrameworkDrawer()`
  - 不再调 `useApplyFramework.apply`（apply 流程改走抽屉）
- [x] 7.2 `src/pages/blogs/BlogEdit.tsx` → mount `<FrameworkDrawerHost>`
  - 引入 `FrameworkDrawerHost` + `PresetFramework` type
  - handleApplyFromDrawer：直接把 preset.sections 注入 editor（避免 toDexieFramework 状态时序问题）
  - 同时 `setFrameworkId(preset.id)` 同步 select
- [x] 7.3 `src/pages/blogs/BlogEdit.tsx` → 处理 isApplied 同步
  - 保留 `useApplyFramework(editor, framework).isApplied`（用于工具栏「已应用」状态）
  - `framework` 仍来自 Dexie（select 的 4 套内置），preset 路径独立
- [x] 7.4 `src/pages/blogs/BlogEdit.tsx` → 防止重复挂载
  - FrameworkDrawerHost 只在 BlogEdit 挂载期存在（详情页不挂载）

## 8. 验证

- [x] 8.1 `pnpm build` 通过 TS 严格模式编译，0 error
- [x] 8.2 `pnpm lint` 0 error / 0 warning
- [ ] 8.3 手动验证：工具栏「应用框架」按钮 → 抽屉从右侧滑入 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.4 手动验证：抽屉内显示 ≥ 6 个预置框架卡片 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.5 手动验证：搜索框输入即筛（标题 / 章节名 / 描述）— 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.6 手动验证：tag 多选 OR 筛选 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.7 手动验证：选中卡片 + 点「应用」 → 编辑器注入 H2 + 关闭抽屉 + 工具栏显对勾 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.8 手动验证：Esc 关闭、背景点击关闭、Tab 焦点环 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.9 手动验证：搜索无结果显示空态 — 浏览器
  > **agent 环境受限，留待人工验证**
- [ ] 8.10 手动验证：详情页 /blogs/:id 不出现抽屉入口 — 浏览器
  > **agent 环境受限，留待人工验证**
- [x] 8.11 `openspec validate add-framework-drawer --strict` 通过

## 9. 提交与归档

- [ ] 9.1 `git add .` + `git commit -m "feat(framework): add framework library drawer for blog editor"`
  > **agent 不做 git，由父会话提交**
- [x] 9.2 `openspec archive add-framework-drawer --yes`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（触发抽屉）| 7.1 + 7.2 | 浏览器 |
| AC-2（≥ 6 预置）| 1.1 + 5.1 + 5.2 | 浏览器 |
| AC-3（搜索）| 4.1 + 3.2 | 浏览器 |
| AC-4（tag OR）| 4.2 + 3.2 | 浏览器 |
| AC-5（应用流程）| 6.1 + 7.2 + 7.3 | 浏览器 |
| AC-6（a11y）| 6.1 + 5.1 + 4.1 | 浏览器（Tab 键 + Esc）|
| AC-7（build + lint）| 8.1 + 8.2 | CLI ✓ |
| AC-8（validate）| 8.11 | CLI ✓ |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（预置数据）| 0.2 | 10 条 preset + 类型 |
| 2（store 扩展）| 0.1 | 4 个字段 + 2 action |
| 3（状态机 hook）| 0.1 | useState + useMemo |
| 4（搜索/tag 组件）| 0.2 | 2 个组件 |
| 5（列表/卡片）| 0.2 | 2 个组件 |
| 6（抽屉壳）| 0.2 | 1 个壳 + 1 个 host |
| 7（BlogEdit 集成）| 0.1 | 3 处改动 |
| 8（验证）| 0.2 | build / lint / validate + 浏览器 7 项 |
| **合计** | **1.3 人天** | 略超 1.2h；可压缩 preset 数据段到 0.15 |
