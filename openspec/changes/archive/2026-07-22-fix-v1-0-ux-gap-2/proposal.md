# Change · fix-v1-0-ux-gap-2

> v1.0 收尾第二轮微调：删 Sidebar「计划」后 100 硬编码徽章 + 加 IndexedDB 数据状态可视化调试入口。

## Why

实测发现两个问题：

1. **Sidebar「计划」后 hardcode「100」徽章**：v1.0 prototype 阶段占位未清理，仪表盘/详情无任何数据时也恒显 100，误导用户
2. **数据持久化不可见**：用户怀疑「每次重启数据清空」，但实际是 Dexie + IndexedDB 标准持久化（数据存浏览器 `localhost:5173` origin）。需要直观手段让用户能 1 秒内确认「我的数据真的在那里」

## What

实施 2 项微调：

| # | 改动 | 类型 |
|---|------|------|
| 1 | 删 Sidebar「计划」NavItem 的 `badge: '100'` 字段 | 删除 |
| 2 | 在「设置」页底部加 `DataInspector` 调试组件：显示 IndexedDB 各表行数 + 「在浏览器 DevTools 打开 Application > IndexedDB > planote」深链提示 | 新增 |

## Scope

### 改动文件（3 个）
- `src/components/layout/Sidebar.tsx` — 删 PRIMARY_NAV 中「计划」的 badge 字段
- `src/pages/settings/Settings.tsx` — 末尾加 DataInspector 区块
- 新建：`src/features/settings/components/DataInspector.tsx`

### 验证
- `pnpm build` 0 error
- `pnpm lint` 0 warning
- `openspec validate fix-v1-0-ux-gap-2 --strict` valid
- 浏览器手验：Sidebar「计划」无徽章 + 设置页底部显示表行数（plans/items/blogs/tags/attachments/frameworks）

## AC

- AC-1：Sidebar「计划」后 MUST NOT 显示 100 徽章
- AC-2：设置页底部 MUST 显示 DataInspector 区块
- AC-3：DataInspector MUST 实时显示 6 张业务表的当前行数
- AC-4：DataInspector MUST 含「数据存于浏览器 IndexedDB」说明文字
- AC-5：build / lint / validate 三关全过

## Out-of-Scope

- 删除/编辑 IndexedDB 记录的 UI（v1.0 已有「设置 → 清除数据」按钮足够）
- IndexedDB 状态导出/导入（已有 useDataIO）
- 自动种子数据（v1.0 已有 4 套内置 framework 种子，足够）

## Risks

- 极低：删 1 行 + 新增 1 个调试组件
- DataInspector 仅在设置页显示，不影响生产路径
