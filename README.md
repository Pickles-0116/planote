# Planote · 栖记

> 让"完成计划"自然沉淀为"可发布内容"的桌面端生产力工具。

**Planote**（Plan + Note）是一款把**目标管理**与**内容创作**合并到同一条主线上的本地优先 Web 应用：
拆解计划 → 勾选事项 → 一键生成博客框架 → 填充发布。

- 🏠 **本地优先**：数据全部存在 IndexedDB，离线可用，无后端依赖
- 🎯 **结构化目标**：三层级（短 / 中 / 长期）× 四维度（每日 / 每月 / 每年 / 一次性）
- 📊 **智能排序**：按"紧急度 + 进度"自动排列 🔴 今天 → 🟠 1-3 天 → 🟡 4-7 天
- 📝 **富文本写作**：Tiptap 编辑器 + 4 套内置框架（项目复盘 / 21天习惯 / 读书笔记 / 月度总结）
- 🗂️ **三种列表视图**：分组 / 全部 / 表格，10 个或 200 个计划都清晰浏览
- 📌 **看板驱动**：4 列状态视图，按时间维度筛选
- 🌗 **dark mode**：浅色 / 深色 / 护眼三主题，全站适配

**v1.0 已收官**：14 个 OpenSpec change 全归档，主流程跑通"创建计划 → 勾选完成 → 生成博客 → 发布"。

---

## 技术栈

| 维度 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript 5（strict） |
| 构建 | Vite 5 |
| 样式 | Tailwind CSS v3（CSS 变量驱动主题） |
| 状态 | Zustand 5（persist 中间件） |
| 数据 | Dexie 4 + IndexedDB |
| 路由 | React Router v6（data router） |
| 编辑器 | Tiptap v2（ProseMirror） |
| 表格 | TanStack Table v8 |
| 拖拽 | @dnd-kit v6 |
| 虚拟列表 | react-virtuoso v4 |
| 图标 | Lucide React |

详细架构见 [`../docs/architecture.md`](../docs/architecture.md)。

---

## 快速开始

```bash
cd planote-app

# 安装依赖
pnpm install

# 启动开发服务器（默认 http://localhost:5173）
pnpm dev

# 生产构建（先类型检查再 Vite build）
pnpm build

# 本地预览生产构建
pnpm preview

# ESLint 检查
pnpm lint

# Prettier 格式化
pnpm format
```

要求：Node ≥ 18、pnpm ≥ 8。

---

## 浏览器要求

- **现代浏览器**（Chrome / Edge / Safari / Firefox 最新两个大版本）
- **IndexedDB** 必须启用（所有业务数据 + 附件 Blob 存在这里）
- **localStorage** 用于 UI 偏好持久化
- **离线优先**：首次加载后可断网使用所有功能
- 不支持 IE / 旧 Edge Legacy

---

## 项目结构

```
planote-app/
├── public/                        # 静态资源
├── src/
│   ├── app/                       # 应用入口 / 路由 / Provider
│   ├── pages/                     # 9 个页面（按业务域分子目录）
│   │   ├── plans/                 # PlansList / PlanDetail / PlanEdit
│   │   ├── blogs/                 # BlogList / BlogEditor / BlogDetail
│   │   └── settings/              # Settings / About
│   ├── features/                  # 按业务域拆分的组件 + Hooks + utils
│   │   ├── plan/                  # 计划模块
│   │   ├── blog/                  # 博客模块
│   │   ├── framework/             # 框架模块
│   │   ├── kanban/                # 看板模块
│   │   └── settings/              # 设置模块
│   ├── components/                # 全局通用组件
│   │   ├── layout/                # Sidebar / Header / AppLayout
│   │   ├── plans/                 # 计划列表组件
│   │   ├── shell/                 # 页面 shell
│   │   └── ui/                    # 原子组件
│   ├── shared/                    # 跨域共享
│   │   ├── components/            # Drawer / Tabs / ViewSwitcher / Progress / ...
│   │   ├── hooks/                 # useHotkeys / useDebounce / useMediaQuery
│   │   ├── sort/                  # 紧急度计算 / 智能排序
│   │   └── utils/                 # 进度 / 格式化 / 工具
│   ├── stores/                    # Zustand stores + persist
│   │   └── hooks/                 # useLiveQuery 桥接
│   ├── db/                        # 数据访问层
│   │   ├── schema.ts              # Dexie 定义
│   │   └── repos/                 # 6 个 Repository
│   ├── types/                     # TypeScript 领域类型
│   ├── styles/                    # globals.css + tokens.css
│   └── main.tsx                   # 入口
├── openspec/                      # OpenSpec 规范
│   ├── specs/                     # 14 个 spec 模块（基线）
│   └── changes/
│       └── archive/               # 14 个已归档 change
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## OpenSpec 工作流

Planote v1.0 通过 **OpenSpec** 规范驱动开发 —— 任何新需求必须先写 proposal → design → specs → tasks，再进入实现，完工后归档到 `openspec/changes/archive/`。

**v1.0 闭环**：14 个 change 全部归档，specs/ 下沉淀 14 个 spec 模块。

**新增需求流程**：

```bash
# 1. 初始化 change
openspec/changes/<date>-<name>/
├── proposal.md       # Why + What Changes
├── design.md         # 技术决策 + 风险
├── tasks.md          # 1.1 / 1.2 / 2.1 ... 编号
└── specs/<spec>/     # 增量 spec（ADDED / MODIFIED / REMOVED）

# 2. 走流程：proposal → design → specs → tasks
# 3. 实现完毕后，move 到 archive/
```

任何超过 1 天工时的功能都应走 OpenSpec。详细规范见 `openspec/AGENTS.md`。

---

## 数据模型

```
Plan 1───* Item           (事项)
Plan 1───* Blog           (反向 blogIds 索引)
Blog *───1 Framework      (可选，框架源)
Blog 1───* Attachment     (Blob 存在 IndexedDB)
Plan ─┐
Blog ─┴── * Tag           (多值索引)
```

完整类型定义见 `src/types/domain.ts` 与 `src/db/schema.ts`。

---

## 命令速查

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite dev server（HMR） |
| `pnpm build` | `tsc --noEmit` 类型检查 + Vite 生产构建 |
| `pnpm preview` | 本地预览 dist |
| `pnpm lint` | ESLint（`--max-warnings 0`） |
| `pnpm format` | Prettier 全量格式化 |

---

## 致谢

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) —— 规范驱动的开发流程
- [Tiptap](https://tiptap.dev) —— 强大且可扩展的富文本编辑器
- [Dexie.js](https://dexie.org) —— IndexedDB 的优雅封装
- [Tailwind CSS](https://tailwindcss.com) —— utility-first CSS
- [React](https://react.dev) + [Vite](https://vitejs.dev) + [Zustand](https://github.com/pmndrs/zustand)
- [TanStack Table](https://tanstack.com/table) + [@dnd-kit](https://dndkit.com) + [react-virtuoso](https://virtuoso.dev/) + [Lucide](https://lucide.dev)

---

## 路线图

- ✅ **v1.0**（2026-07-19）—— 核心可用版，14 changes 全归档
- 🔜 **v1.1** —— 全文检索（MiniSearch）+ 标签系统 + Markdown / HTML 导出 + PDF/DOCX 解析 + 仪表盘增强
- 📅 **v1.2** —— 用户自定义框架 + 数据看板（Recharts）+ 主题切换深色 / 护眼

详细规划见 [`../docs/roadmap.md`](../docs/roadmap.md)。

---

## 文档导航

- [PRD](../docs/prd.md) —— 产品定位 + 范围 + 用户故事
- [技术架构](../docs/architecture.md) —— 选型 + 数据模型 + 关键模块
- [路线图](../docs/roadmap.md) —— v1.0 / v1.1+ 规划
- [CHANGELOG](./CHANGELOG.md) —— 版本变更记录
- [OpenSpec](./openspec/) —— 14 个 spec 模块 + 归档 changes

---

## 许可证

All rights reserved.
