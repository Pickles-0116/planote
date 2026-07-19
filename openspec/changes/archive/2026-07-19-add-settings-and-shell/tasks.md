# Tasks · 设置中心 + 应用外壳（Settings & Shell）

> 每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

> **时间预算**：~1.5 人天；每段工时按「单 task ≤ 20min」拆分。
> **依赖**：add-data-layer-dexie + add-zustand-stores + add-app-shell + add-kanban-board + 所有 9 个页面已落地
> **状态**：提案阶段（Round 12 提案，Round 13 实施；v1.0 收官 change）

---

## 1. dark mode 基建

- [ ] 1.1 `tailwind.config.ts` → 加 `darkMode: 'class'`
- [ ] 1.2 `src/stores/uiStore.ts` → theme 字段升级
  - 类型：'system' | 'light' | 'dark'（替换原 'light' | 'dark' | 'eye-care'）
  - 默认：'system'
  - persist version：1 → 2
  - migrate 函数：旧值 'eye-care' → 'light'；其他值透传
- [ ] 1.3 `src/main.tsx` → FOUC 防御
  - 同步读 localStorage
  - 解析 theme（含 system 检测）
  - `documentElement.classList.toggle('dark', isDark)`（在 createRoot 之前）
  - catch localStorage 损坏 → 默认 light
- [ ] 1.4 `src/types/domain.ts` 或新建 `src/types/theme.ts`（可选）→ ThemeMode type

## 2. useTheme + ThemeToggle

- [ ] 2.1 `src/features/settings/hooks/useTheme.ts`
  - 读 `useUIStore.theme`
  - 监听 `prefers-color-scheme` media query
  - 计算 resolvedTheme
  - 应用 `documentElement.classList.toggle('dark', isDark)`
  - 返回 `{ theme, resolvedTheme, setTheme }`
- [ ] 2.2 `src/features/settings/components/ThemeToggle.tsx`
  - 3 选项胶囊：跟随系统 / 浅色 / 深色
  - 选中态 ring-brand-500
  - 调 useUIStore.setTheme
  - Lucide icon: Monitor / Sun / Moon
- [ ] 2.3 `src/features/settings/index.ts` 统一导出

## 3. useDataIO + 导入/导出/清除

- [ ] 3.1 `src/features/settings/utils/dexieExport.ts`（纯函数）
  - 导出 schema: `{ version: 1, exportedAt, plans, items, blogs, frameworks, tags, attachments }`
  - 附件 blob → base64 dataURL
  - 6 张表 toArray()
- [ ] 3.2 `src/features/settings/utils/dexieImport.ts`（纯函数）
  - 读 file.text() → JSON.parse
  - 校验 version + 6 张表存在
  - 附件 base64 → Blob 还原（fetch dataURL）
  - bulkPut 写入（merge 或 replace 模式）
- [ ] 3.3 `src/features/settings/utils/dexieClear.ts`（纯函数）
  - `db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear() })`
- [ ] 3.4 `src/features/settings/hooks/useDataIO.ts`
  - 包装 exportData / importData / clearAllData
  - 返回同名方法
  - 不含 UI

## 4. Settings 4 区块

- [ ] 4.1 `src/pages/settings/Settings.tsx`（替换 src/pages/Settings.tsx 占位）
  - 左侧 240px 导航 + 右侧内容区
  - 4 区块切换：useState activeKey
  - 路由重定向：把 src/pages/Settings.tsx 改名为 re-export src/pages/settings/Settings.tsx
- [ ] 4.2 `src/pages/settings/ThemeSettings.tsx`
  - 标题 + 描述
  - `<ThemeToggle />`
  - 当前 resolvedTheme 显示
- [ ] 4.3 `src/pages/settings/DataSettings.tsx`
  - 3 Card：导出 / 导入 / 清除
  - 导出：按钮调 exportData + toast
  - 导入：模式切换（merge/replace）+ file input + 进度提示
  - 清除：调 ClearDataConfirm 组件
- [ ] 4.4 `src/pages/settings/AboutSettings.tsx`
  - Logo + 版本号
  - 致谢列表
  - 版权
- [ ] 4.5 `src/pages/settings/FeedbackSettings.tsx`
  - EmptyState 占位 + 「反馈功能 v1.1 计划内」

## 5. dark mode 全站适配

- [ ] 5.1 顶层组件：AppLayout / Sidebar / Header
  - 背景：bg-stone-50 → dark:bg-stone-900
  - 卡片：bg-white → dark:bg-stone-800
  - 文字：text-brand-900 → dark:text-stone-100
  - 边框：border-stone-200 → dark:border-stone-700
  - hover 边：dark:hover:border-stone-600
- [ ] 5.2 9 页面 dark 适配（每页独立 commit）
  - 5.2.1 Dashboard
  - 5.2.2 PlanList
  - 5.2.3 PlanDetail
  - 5.2.4 PlanEdit
  - 5.2.5 BlogList
  - 5.2.6 BlogDetail
  - 5.2.7 BlogEdit
  - 5.2.8 Kanban（保留拖拽 ring + 列态正常）
  - 5.2.9 Settings（本 change 新建，已含 dark）
- [ ] 5.3 共享组件 dark 适配
  - EmptyState / Skeleton / Stepper / Card / Drawer / Toast / ProgressRing / ErrorBoundary
- [ ] 5.4 业务组件 dark 适配
  - PlanCard / ItemRow / ItemChecklist / KanbanCard / KanbanColumn / FrameworkCard / BlogCard / BlogListFilters 等
- [ ] 5.5 review 段
  - 扫漏 + 边界组件（Modal / Tooltip / DatePicker / ConfirmDialog）
  - 验证紧急度 chip 保持原色
  - 验证状态 badge 保持原色

## 6. NavBar 主题显示

- [ ] 6.1 `src/components/layout/Header.tsx` → 加主题入口
  - 位置：右上角「设置」入口旁
  - 显示：当前 resolvedTheme（icon + 简短文本）
  - 交互：点击下拉 3 选项（系统 / 浅色 / 深色）
  - v1.0 简化：直接显示 + 点击跳 /settings#theme

## 7. FOUC + 持久化

- [ ] 7.1 `src/main.tsx` 完整 FOUC 防御（已含在 1.3）
  - 验证：刷新深色页面无闪屏
- [ ] 7.2 useUIStore persist version 迁移
  - 验证：旧值 'light' | 'dark' | 'eye-care' 正确迁移
  - 验证：localStorage 损坏不抛错

## 8. 验证

- [ ] 8.1 `pnpm build` 0 error
- [ ] 8.2 `pnpm lint` 0 warning
- [ ] 8.3 手动验证：Settings 4 区块切换 — 浏览器
- [ ] 8.4 手动验证：主题切换（3 选项）+ NavBar 实时显示 — 浏览器
- [ ] 8.5 手动验证：dark mode 全站适配（无白底残留）— 浏览器
- [ ] 8.6 手动验证：数据导出（含附件） + 导入 merge/replace — 浏览器
- [ ] 8.7 手动验证：清除数据 + 二次确认 — 浏览器
- [ ] 8.8 手动验证：FOUC 防御（刷新深色页面无闪屏）— 浏览器
- [ ] 8.9 手动验证：持久化（刷新后主题保持）— 浏览器
- [ ] 8.10 手动验证：导入失败边界（版本错/字段缺/JSON 坏）— 浏览器
- [ ] 8.11 手动验证：9 页面在 dark 模式视觉一致 — 浏览器
- [ ] 8.12 手动验证：看板 dark 模式拖拽正常 — 浏览器
- [ ] 8.13 手动验证：现有 change（add-kanban-board）不破坏 — 浏览器
- [ ] 8.14 `openspec validate add-settings-and-shell --strict` 通过

## 9. 提交与归档

- [ ] 9.1 `git add .` + `git commit -m "feat(settings): add settings center + dark mode + data IO + shell"`
- [ ] 9.2 `openspec archive add-settings-and-shell --yes`
- [ ] 9.3 v1.0 收官检查
  - `openspec list` → 空
  - `openspec/changes/archive/` 累计 ≥ 16 个 change
  - v1.0 全部 capability 落地
  - v1.1 启动条件确认

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（4 区块）| 4.1-4.5 | 浏览器 |
| AC-2（主题 3 选项 + NavBar）| 2.1-2.2 + 6.1 | 浏览器 |
| AC-3（dark 全站适配）| 5.1-5.5 | 浏览器 |
| AC-4（数据导出）| 3.1 + 3.4 + 4.3 | 浏览器 |
| AC-5（数据导入 merge/replace）| 3.2 + 3.4 + 4.3 | 浏览器 |
| AC-6（清除数据 + 二次确认）| 3.3 + 3.4 + 4.3 | 浏览器 |
| AC-7（关于页）| 4.4 | 浏览器 |
| AC-8（build + lint + validate）| 8.1 + 8.2 + 8.14 | CLI ✓ |
| AC-9（FOUC）| 1.3 + 7.1 | 浏览器 |
| AC-10（theme 字段升级）| 1.2 + 7.2 | 浏览器 + 单测 |
| AC-11（现有 change 不破坏）| 5.2.8 + 8.13 | 浏览器 |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（dark mode 基建）| 0.1 | tailwind + uiStore 升级 + FOUC |
| 2（useTheme + ThemeToggle）| 0.1 | hook + 组件 |
| 3（useDataIO）| 0.2 | 3 个 util + 1 个 hook |
| 4（Settings 4 区块）| 0.2 | 5 个页面文件 |
| 5（dark mode 全站适配）| 0.4 | 9 页面 + 共享 + 业务 + review |
| 6（NavBar 主题显示）| 0.05 | Header 增量 |
| 7（FOUC + 持久化）| 0.05 | 已含在 1.3 / 1.2 |
| 8（验证）| 0.2 | build + lint + 浏览器 14 项 |
| 9（提交归档）| 0.05 | git + archive + 收官检查 |
| **合计** | **1.35 人天** | Round 13 实施预算 |
