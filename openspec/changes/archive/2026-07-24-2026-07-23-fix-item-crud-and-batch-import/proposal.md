# Change · fix-item-crud-and-batch-import

> v1.1 增强包：**修 item-crud 三个核心 bug** + **Markdown 导入升级为批量**。
>
> 把 v1.0 收官时遗留的「add-item-crud 占位」彻底落地,并把 v1.1 第一炮的单文件导入升级为批量。

## Why

### 现状问题（代码层静态扫描发现）

| 编号 | 现象 | 严重度 | 根因 |
|------|------|--------|------|
| B1 | 计划详情页「+ 添加事项」按钮永远 disabled | 🔴 | `ItemChecklist.tsx` 占位,v1.0 标"add-item-crud 接手"但未做 |
| B2 | 计划编辑页 Step3 永远显示空,用户看不到现有事项 | 🔴 | `PlanEdit.tsx` 写死 `items: []`,注释说"edit 模式不携带 items" |
| B3 | 编辑模式保存后,事项的增删改/重排全部丢失 | 🔴 | `usePlanEditSubmit.ts` edit 分支只 `updatePlan`,完全忽略 items 变更 |
| B4 | 导入按钮只支持单文件,选 10 个 .md 需重复 10 次 | 🟠 | v1.1 第一炮只做了单文件 (`ImportMarkdownButton` 无 `multiple`) |
| B5 | 导入超 1MB 文件直接拒绝,无 override 入口 | 🟡 | `useMarkdownImport` 硬限 1MB |
| B6 | 导入失败 toast 后,需重选文件才能继续 | 🟡 | hook `return` 后 input.value 已被 reset,无重试机制 |

B1+B2+B3 是同一根因（`add-item-crud` change 在 v1.0 收官时未实现,代码到处写"留给 add-item-crud 接手"占位）。

### 用户场景

1. **建立计划后必须能补事项**:用户创建了一个只有标题的计划（没在 Step3 写事项),回头想补 → 现在加不了。
2. **想调整事项顺序或加几条**:用户打开了已有计划 → 想加 2 条事项、改个标题、调下顺序 → 现在改了全丢。
3. **搬家式导入**:用户从 Notion / 语雀 / Obsidian 导出了 30 个 .md → 想一次性搬进来 → 现在得选 30 次。

## What Changes

| # | 改动 | 类型 |
|---|------|------|
| 1 | `ItemChecklist` 加 inline 添加/删除/编辑事项交互 | 新增（解锁 disabled 占位）|
| 2 | `PlanEdit` edit 模式正确预填 `items`,保存时 diff + 批量更新 | 修复 |
| 3 | `usePlanEditSubmit` edit 分支支持 `createItem / updateItem / deleteItem` 混合操作 | 修复 |
| 4 | `ImportMarkdownButton` 加 `multiple` 属性 + 改文案 | 升级 |
| 5 | `useMarkdownImport` 重构为 `importFiles(files: File[])` | 升级 |
| 6 | 批量导入进度反馈（toast + 成功/失败计数）| 新增 |
| 7 | 1MB 限制改 5MB,超出给明确提示但不再静默拒绝 | 调整 |
| 8 | 失败文件可重试（toast 内联 "重试" 按钮）| 新增 |

## Scope

### 改动文件清单

**item-crud（修 3 个严重 bug）**

- 改 `src/features/plan/components/ItemChecklist.tsx`:加 `onAdd` / `onUpdate` / `onRemove` props,启用「+ 添加事项」按钮
- 改 `src/features/plan/components/ItemRow.tsx`:加 `onUpdate` / `onRemove` props + 永远显示删除按钮（非 hover）
- 改 `src/pages/plans/PlanDetail.tsx`:接入 `useItemCRUD` hook
- 新建 `src/features/plan/hooks/useItemCRUD.ts`:封装 add/update/remove + 自动 recompute progress
- 改 `src/pages/plans/PlanEdit.tsx`:edit 模式 `prefilled.items` 改为从 plan store 读取
- 改 `src/features/plan/hooks/usePlanEditSubmit.ts`:edit 模式加 items diff（create / update / delete 三类操作）
- 改 `src/features/plan/components/Step3Items.tsx`:draft 状态标记 + 显示「将删除」/「已存在」标签

**batch-import（升级 Markdown 导入）**

- 改 `src/features/blog/components/ImportMarkdownButton.tsx`:加 `multiple` + 文案调整
- 改 `src/features/blog/hooks/useMarkdownImport.ts`:重写为批量处理,返回 `{ success, failed, errors }`
- 改 `src/features/blog/components/NewBlogMenu.tsx`:文案/提示同步
- 改 `src/pages/blogs/BlogList.tsx`:空态文案同步

## Out-of-Scope

- 事项拖拽排序（v1.2）
- 事项批量操作（v1.2）
- Markdown front-matter 解析（v1.2）
- Notion / 语雀 专用解析器（v1.2）
- 拖拽上传 .md（v1.2）
