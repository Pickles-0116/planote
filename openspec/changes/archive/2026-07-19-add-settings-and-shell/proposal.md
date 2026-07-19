## Why

Planote v1.0 进入收官阶段，但「应用外壳」仍存在 3 个未落地的核心场景：

1. **`/settings` 路由仍是占位页**：`Settings.tsx` 当前仅渲染 `PlaceholderPage` 文案「主题 / 主色 / 字体 / 标签管理 / 快捷键 / 数据管理。Sprint 3 实现。」PRD v1.0 §6.1「设置中心」要求最基础的主题切换 + 数据导入/导出 + 清除数据必须交付。
2. **主题系统未启用**：`useUIStore.theme` 字段已存在（`'light' | 'dark' | 'eye-care'`，参见 `src/stores/uiStore.ts`），但全站无任何代码消费它——`useUIStore.setTheme` 是「调了但什么都不发生」的死代码。Tailwind config 也未配置 `darkMode: 'class'`，无视觉差异。
3. **数据主控权未交付用户**：PRD v1.0 §7「数据所有权」要求用户能导出 / 导入 / 清除所有数据（IndexedDB 全表）。当前 Dexie 6 张表是「黑盒」，用户被锁定。无导入则升级 / 跨设备迁移无解。

本 change 作为 v1.0 收官 change，**只交付最基础 3 项**（主题切换 / 数据导入导出 / 清除数据 / 关于页），不做账户、云同步、自动备份等需要服务端的扩展。

完成后，v1.0 全部 16 个 change（数据层 + 9 个页面 + 4 个增量 + 看板 + 设置外壳）收官，可以宣告 Sprint 1-4 全部完成。

## What Changes

### 1. Settings 中心页（4 区块）

- 路径：`src/pages/settings/Settings.tsx`（替换当前 `src/pages/Settings.tsx` 占位）
- 布局：左侧 240px 导航 + 右侧内容区（与 prototype `settings.html` 一致）
- 4 个区块（按导航顺序）：
  1. **主题**（`ThemeSettings`）—— 浅色 / 深色 / 跟随系统
  2. **数据**（`DataSettings`）—— 导出 JSON / 导入 JSON（合并/替换）/ 清除全部
  3. **关于**（`AboutSettings`）—— 版本号 + 致谢
  4. **反馈**（占位，`FeedbackSettings`）—— 提示「v1.1 计划内」
- 区块切换：URL hash 锚点 `#theme` / `#data` / `#about` / `#feedback`（保留浏览器历史）

### 2. 主题切换（system / light / dark）

- 新增 `src/features/settings/hooks/useTheme.ts`：
  - 读 `useUIStore.theme`
  - 监听 `prefers-color-scheme` media query
  - 计算实际 theme（system → 跟随系统；light/dark → 固定）
  - 应用：`document.documentElement.classList.toggle('dark', isDark)`
  - 返回 `{ theme, resolvedTheme, setTheme }`
- 新增 `src/features/settings/components/ThemeToggle.tsx`：
  - 3 选项胶囊按钮：跟随系统 / 浅色 / 深色
  - 选中态 ring-brand-500
  - 调 `useUIStore.setTheme`
  - 当前实际主题显示在 NavBar（`useUIStore.theme` + 实际值）

### 3. 数据导入 / 导出 / 清除

- 新增 `src/features/settings/hooks/useDataIO.ts`：
  - `exportData()`：Dexie 6 张表 `toArray()` → 包装为 `{ version, exportedAt, plans, items, blogs, frameworks, tags, attachments }` → `JSON.stringify` → 创建 Blob → 触发 a[download]
  - `importData(file, mode: 'merge' | 'replace')`：FileReader → JSON.parse → schema 校验 → 写入（merge: `bulkPut`；replace: 清空再 `bulkPut`）
  - `clearAllData()`：`db.tables.forEach(t => t.clear())` → 跳 `/`
- 新增 `src/features/settings/components/DataSettings.tsx`：
  - 3 区块：导出 / 导入 / 清除
  - 导入：模式切换（合并 / 替换）+ 文件 input + 进度提示
  - 清除：双层确认（弹窗 + 输入「确认清除」文字）→ 才执行

### 4. 关于页

- `src/pages/settings/AboutSettings.tsx`：
  - Logo + 「Planote · 栖记 v1.0.0」
  - 致谢列表：开源项目（Tiptap / Tailwind / Dexie / Zustand / Lucide / dnd-kit / TanStack Table / react-virtuoso / React Router）
  - 版权：「© 2026 Planote · 个人项目，仅供学习与个人使用」

### 5. 应用外壳增量：dark mode 全站适配

- `tailwind.config.ts`：`darkMode: 'class'`（关键：v1.0 当前未配置）
- 全站组件 review：把 `bg-white` / `bg-stone-50` / `text-brand-900` 等硬编码颜色适配为 `bg-white dark:bg-stone-900` / `bg-stone-50 dark:bg-stone-800` / `text-brand-900 dark:text-stone-100` 等
- 范围：AppLayout / Sidebar / Header / 9 个页面 + 共享组件（Card / EmptyState / Skeleton / Stepper / Drawer / 表格头等）
- 视觉风格：dark mode 维持「栖记」品牌色（slate 主），背景从 stone-50 → stone-900

### 6. FOUC 防御

- `src/main.tsx` 改造：在 `<App />` 渲染前同步读 `useUIStore.theme` + 调 `document.documentElement.classList.toggle('dark', isDark)`
- 保证：刷新页面瞬间不会出现「浅色 → 深色」闪烁
- 实施细节：用 `useUIStore.persist.rehydrate()` 显式等待，或在 main.tsx 内 `localStorage.getItem('planote-ui')` 直接解析

## Scope

**In Scope**：

- 新建：`src/pages/settings/{Settings,ThemeSettings,DataSettings,AboutSettings}.tsx`
- 新建：`src/features/settings/components/ThemeToggle.tsx`
- 新建：`src/features/settings/hooks/{useTheme,useDataIO}.ts`
- 新建：`src/features/settings/utils/dexieExport.ts`（纯函数：导出 schema + 版本字段）
- 改造：`src/pages/Settings.tsx`（占位 → 真实入口；或删除由 `pages/settings/Settings.tsx` 取代）
- 改造：`src/components/layout/AppLayout.tsx`（深色适配 + NavBar 主题显示）
- 改造：`src/components/layout/Sidebar.tsx`（深色适配）
- 改造：`src/components/layout/Header.tsx`（深色适配）
- 改造：`src/tailwind.config.ts`（`darkMode: 'class'`）
- 改造：`src/main.tsx`（FOUC 防御内联初始化）
- 改造：全站 9 个页面 + 共享组件 review + dark 适配（**重点**：Dashboard / PlanList / PlanDetail / PlanEdit / BlogList / BlogDetail / BlogEdit / Kanban / Settings）
- 改造：`useUIStore` 增 `themeMode: 'system' | 'light' | 'dark'` 字段（替换原 `theme` 字段语义；保持向下兼容）
- 改造：`src/stores/uiStore.ts`：`theme` 字段含义从「实际主题」改为「期望主题（含 system）」
- spec 增量：新增 `settings-and-shell` capability 的 10-12 个 Requirements

**Out of Scope**：

- 账户系统（v1.1+）
- 云同步 / 自动备份（v2.0）
- 多设备同步（v2.0）
- 主题自定义色板（v1.1：保留 `primaryColor` 字段但 v1.0 不暴露 UI）
- 字体切换（v1.1）
- 标签管理（v1.1：标签系统已在 schema，预留 UI）
- 快捷键设置（v1.1）
- 国际化 i18n
- 服务端 API 接入
- 实时数据校验（导入时仅 schema + 字段类型，不做业务规则校验）
- 移动端专属布局（桌面端 Web 优先）
- 主题过渡动画（v1.0 直接切换；v1.1 评估 View Transitions API）

## Acceptance Criteria

- [ ] **AC-1**：Settings 中心页含 4 区块（主题 / 数据 / 关于 / 反馈占位），可点击切换
- [ ] **AC-2**：主题支持「跟随系统 / 浅色 / 深色」3 选项，NavBar 显示当前主题
- [ ] **AC-3**：dark mode 全站适配（AppLayout / Sidebar / Header / 9 页面 + 共享组件），无白底残留
- [ ] **AC-4**：数据导出 JSON 备份（含 plans / items / blogs / frameworks / tags / attachments + version + exportedAt）
- [ ] **AC-5**：数据导入支持「合并 / 替换」两模式，校验失败显示 toast
- [ ] **AC-6**：清除数据需二次确认（弹窗 + 输入「确认清除」），执行后跳 Dashboard
- [ ] **AC-7**：关于页显示 v1.0.0 版本号 + 开源致谢 + 版权
- [ ] **AC-8**：`pnpm build` 0 error + `pnpm lint` 0 warning + `openspec validate add-settings-and-shell --strict` 通过
- [ ] **AC-9**：dark mode 切换无 FOUC（刷新页面瞬间不闪浅色）
- [ ] **AC-10**：`useUIStore.theme` 字段语义统一为「期望主题（含 system）」，配合 `useTheme` hook 解析为实际值
- [ ] **AC-11**：所有现有 change（add-kanban-board 等）不被破坏——dark mode 不影响看板拖拽 / 排序 / 跨列交互

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| dark mode 全站适配范围广（200+ 处）易遗漏 | **高** | 任务拆 5 段：AppLayout → Sidebar/Header → 9 页面 → 共享组件 → review；每段独立 commit + build 验证 |
| FOUC 在深色用户首屏体验差 | 中 | main.tsx 同步内联 init；useUIStore.persist 已有 storage |
| 导入 JSON 解析失败导致数据损坏 | 中 | schema 校验（version 匹配 + 6 张表字段存在）；失败时显示 toast + 不动原数据；merge 模式用 bulkPut 原子性 |
| 清除数据不可逆 | 中 | 双层确认（弹窗 + 输入「确认清除」）；执行前再次提示「将删除全部 N 条数据」 |
| 主题切换引起部分组件视觉破坏（自定义颜色硬编码） | 中 | 任务设「review 段」专门扫一遍；hex 颜色统一抽 token（v1.1） |
| Dexie blob 数据（附件）导出大小 | 低 | JSON 含 base64；附件 < 10MB 实测无问题；超大附件给出 toast 提示 |
| 现有 `useUIStore.theme` 字段语义歧义 | 低 | 迁移：旧值 `'light' | 'dark' | 'eye-care'` → 新值 `'light' | 'dark'`；eye-care 降级为 light（v1.1 移除） |

## Dependencies

- **上游（已完成）**：
  - `add-data-layer-dexie`：6 张 Dexie 表（plans / items / blogs / frameworks / tags / attachments）
  - `add-zustand-stores`：`useUIStore.theme` 字段已存在
  - `add-app-shell`：`AppLayout` / `Sidebar` / `Header` / `EmptyState` / `Skeleton` 已落地
  - `add-kanban-board`（Round 12）：看板页可用
  - 所有 9 个页面已落地
- **下游（v1.0 收官）**：
  - 全部 v1.0 change 收官
  - v1.1 主题扩展（色板 / 字体 / 暗色 vs eye-care 三套主题）
  - v1.1 标签管理 UI
  - v2.0 账户 / 云同步 / 跨设备

## Out of Scope Reminder

- 不引 CSS-in-JS（继续用 Tailwind + dark mode class 切换）
- 不引主题管理库（styled-components / emotion）—— v1.0 Tailwind 足够
- 不写组件单测（v1.0 Sprint 1-2 暂不强制）
- 不重写 useUIStore persist（沿用现有 `planote-ui` localStorage key）
- 不改路由表（`/settings` 已存在，只改实现）
- 不引动效库（直接切；v1.1 评估 View Transitions API）

## v1.0 收官标注

本 change 是 v1.0 Sprint 1-4 的**最后一个 change**。归档后：
- `openspec/changes/` 应为空（无活跃 change）
- `openspec/changes/archive/` 累计 16+ 个 change（含本次 add-settings-and-shell）
- v1.0 全部 capability 落地：ui-shell / ui-state / plan-data / plan-list / plan-detail / plan-edit / sort-engine / kanban-board / blog-editor / blog-list-and-detail / blog-attachment / framework-drawer / dashboard-data / data-layer-dexie / zustand-stores / settings-and-shell
- v1.1 启动条件：所有上述 capability 稳定 + 用户反馈收集
