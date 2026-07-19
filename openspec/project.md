# Planote · 项目上下文（OpenSpec Project Context）

> 本文件由 OpenSpec 加载，作为 AI agent 编写 change 提案 / 实现代码时的「项目全局背景」。
> 修改时请保留小节标题顺序，便于 agent 按结构提取。

---

## 1. 项目身份

- **产品名**：Planote（Plan + Note）
- **中文名**：栖记
- **阶段**：v1.0 Sprint 1（脚手架 + 数据层）
- **产品定位**：桌面端 Web 优先的「计划与博客一体化」个人生产力工具。让"完成计划"自然沉淀为"可发布内容"。
- **当前里程碑**：Sprint 1 第 2 步——数据层（Dexie + 6 个 Repository）

---

## 2. 技术栈（已锁定，不要替换）

| 维度 | 选型 | 版本 | 在哪里用到 |
|------|------|------|-----------|
| 框架 | React | 18.3+ | 全部 UI |
| 语言 | TypeScript | 5.4+ | 全栈 |
| 构建 | Vite | 5.x | dev / build |
| 样式 | Tailwind CSS | v3.4 | 全部页面 |
| 状态 | Zustand | v4.5 | 业务域 store + persist |
| 数据 | Dexie + IndexedDB | Dexie 4.x | 本地持久化 |
| ID 生成 | ULID | latest | 主键 |
| 路由 | React Router | v6.4+ | data router 模式 |
| 表格 | TanStack Table | v8 | 列表-表格模式 |
| 虚拟列表 | react-virtuoso | v4 | 1000+ 行 |
| 拖拽 | @dnd-kit | v6 | 看板 + 事项排序 |
| 图标 | Lucide React | latest | 图标 |
| 富文本 | Tiptap | v2 | 博客编辑器（Sprint 3） |

**v1.0 不引入**：UI 组件库（自研）、CSS-in-JS、状态机库（XState）、后端服务、ORM 替代品。

---

## 3. 架构模式

### 3.1 分层

```
UI (React 组件)
  ↓ 调用 action
Zustand Stores（业务域切分，selector 精确订阅）
  ↓ 调用 repo
Repositories（接口 + Dexie 实现）
  ↓
IndexedDB（Dexie schema）
```

### 3.2 关键约束

1. **组件不直接调 Dexie API**：所有数据访问必须经 `xxxRepo.method()`。这是为了 v1.1 加云同步时只需新增 `RemoteXxxRepo` 包装，不污染组件。
2. **Store 不直接做持久化**：Store 调 Repo，Repo 调 Dexie。三层分离。
3. **派生数据走 selector**：进度、紧急度、过滤后列表等在 Zustand selector 里算，不重复存到 state。
4. **乐观更新**：UI 立即反映 store 变更，IndexedDB 写入是 fire-and-forget；失败时回滚 + 错误提示。

### 3.3 模块切分（与 architecture §2.2 对齐）

| 模块 | Store | Repo |
|------|-------|------|
| plan | usePlanStore | PlanRepo |
| item | usePlanStore.items | ItemRepo |
| blog | useBlogStore | BlogRepo |
| editor | useEditorStore | — |
| framework | useFrameworkStore | FrameworkRepo |
| tag | useTagStore | TagRepo |
| attachment | useAttachmentStore | AttachmentRepo |
| ui | useUIStore | —（仅 localStorage） |

---

## 4. 目录约定（已约定，不要改）

```
planote-app/
├── src/
│   ├── app/             # App.tsx / router / providers
│   ├── pages/           # 路由页面
│   ├── features/        # 按业务域分（plan/ blog/ framework/ tag/ attachment/）
│   ├── shared/          # 通用组件 + hooks + utils
│   ├── stores/          # Zustand stores
│   ├── db/              # schema.ts + repos/ + liveQuery.ts
│   ├── types/           # domain.ts / editor.ts
│   ├── styles/          # globals.css / tokens.css
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

**目录别名**：`@/*` → `src/*`（在 `vite.config.ts` + `tsconfig.app.json` 中已配）。

---

## 5. 代码规范

### 5.1 命名

- 组件：PascalCase（`PlanCard.tsx`、`ProgressRing.tsx`）
- 业务模块：业务域前缀小写（`planStore.ts`、`planRepo.ts`、`usePlan.ts`）
- Hook：use 前缀（`usePlanStore`、`useUrgency`）
- 工具函数：camelCase（`computeUrgency`、`formatDate`）
- 常量：UPPER_SNAKE（`BUILTIN_FRAMEWORKS`）
- ID 类型：使用 `type ID = string`，ULID 字符串

### 5.2 文件组织

- 一个文件一个主要导出（避免「瑞士军刀」文件）
- 业务域内部就近组织：`features/plan/components/PlanCard.tsx` + `features/plan/hooks/usePlan.ts`
- 类型集中在 `types/domain.ts`（不散落各文件），用 `import type` 引入
- 公共组件按"展示级 / 容器级"分目录（`shared/components/` 全为展示级）

### 5.3 注释与文案

- 中文注释（团队母语），代码标识符 / 文件名英文
- 复杂算法（智能排序、紧急度计算）必须有顶部说明 + 公式注释
- 业务术语统一：计划/事项/博客/框架/标签/附件（不用「任务」「文章」「模板」等近义词）

### 5.4 严格度

- TS `strict: true`（已配）
- 不允许 `any`；必要时用 `unknown` + 类型守卫
- 不允许 `// @ts-ignore`；允许 `// @ts-expect-error` + 解释
- ESLint + Prettier 强制（已配），提交前自动 lint

---

## 6. 测试策略

| 阶段 | 范围 | 工具 |
|------|------|------|
| v1.0 Sprint 1-2 | **暂不写单测**，跑通 dev 即可 | 手动 + 浏览器 DevTools |
| v1.0 Sprint 3-4 | Repository 关键方法补 vitest 单测 | vitest + fake-indexeddb |
| v1.1+ | 组件测试 + E2E | vitest + Playwright |

**Sprint 1 验收标准**（来自 roadmap）：
- `pnpm dev` < 1s 启动
- 首屏 < 1.5s
- 创建 1 条假计划刷新后仍在（IndexedDB 持久化）
- 9 页面从侧边栏可点开
- DevTools → Application → IndexedDB 可见 6 张表
- frameworks 表有 4 条种子数据

**Repository 代码必须可测**：所有方法不依赖全局单例，可注入 `db` 实例（便于 fake-indexeddb 测试）。这是隐含要求。

---

## 7. 业务领域（Domain）

### 7.1 核心概念

- **计划（Plan）**：用户的目标，可三层级（短/中/长期）× 四维度（每日/每月/每年/一次性）
- **事项（Item）**：计划的子任务，可勾选完成；勾选率 = 计划进度
- **博客（Blog）**：富文本文章，可独立创作，也可由完成计划「一键生成」
- **框架（Framework）**：博客模板（项目复盘 / 21天习惯 / 读书笔记 / 月度总结），v1.0 4 套内置
- **标签（Tag）**：计划/博客的多对多标记（P1 优先，但 v1.0 schema 预留）
- **附件（Attachment）**：博客关联的 Blob（图/.md/.txt）

### 7.2 关系

```
Plan 1—N Item
Plan 1—N Blog（一个计划可生成多篇博客）
Blog N—1 Framework（一篇博客可选一个框架）
Blog 1—N Attachment
Plan N—M Tag（通过 *tagIds 多值索引）
Blog N—M Tag
```

### 7.3 业务规则

- 计划进度 = 已勾选事项 / 总事项 × 100%（派生，写入 Plan.progress 字段缓存）
- 计划状态：未开始/进行中/已完成/已搁置
- 博客状态：草稿/已发布/归档
- 事项状态：待办/进行中/已完成
- 紧急度（排序用）：🔴 今天截止 / 🟠 1-3 天 / 🟡 4-7 天 / ⬜ 7 天+
- 100% 完成时显示金色横幅 + 「生成总结博客」CTA

---

## 8. 核心数据模型（摘要，详细见 architecture §3.1）

```ts
type ID = string;                          // ULID
type ISODate = string;                     // ISO 8601

type PlanLevel    = 'short' | 'mid' | 'long';
type PlanTimeDim  = 'daily' | 'monthly' | 'yearly' | 'once';
type PlanStatus   = 'todo' | 'doing' | 'done' | 'paused';
type UrgencyLevel = 'red' | 'orange' | 'yellow' | 'none';

interface Plan {
  id: ID; title: string; description: string;
  level: PlanLevel; timeDim: PlanTimeDim; status: PlanStatus;
  progress: number;       // 0-100，派生缓存
  urgency: UrgencyLevel;  // 派生缓存
  tagIds: ID[]; itemIds: ID[]; blogIds: ID[];
  startDate?: ISODate; endDate?: ISODate;
  parentPlanId?: ID; childPlanIds: ID[];
  createdAt: ISODate; updatedAt: ISODate; completedAt?: ISODate;
}

interface Item {
  id: ID; planId: ID; title: string; description?: string;
  status: 'todo' | 'doing' | 'done';
  checked: boolean;       // 冗余 status==='done'
  dueDate?: ISODate; order: number;
  createdAt: ISODate; updatedAt: ISODate; completedAt?: ISODate;
}

interface Blog {
  id: ID; title: string;
  content: TiptapJSON;     // 实际由 Tiptap schema 决定
  contentText: string;     // 纯文本（全文检索用）
  excerpt: string; coverImageId?: ID;
  tagIds: ID[]; sourcePlanId?: ID; frameworkId?: ID;
  attachmentIds: ID[];
  status: 'draft' | 'published' | 'archived';
  source: 'direct' | 'plan' | 'upload';
  createdAt: ISODate; updatedAt: ISODate; publishedAt?: ISODate;
}

interface Framework {
  id: ID; name: string; description: string;
  category: 'review' | 'note' | 'summary' | 'habit';
  icon: string;            // Lucide icon name
  sections: FrameworkSection[];
  useCount: number; builtin: boolean;
}

interface FrameworkSection { heading: string; guide: string; placeholder: string; }

interface Tag { id: ID; name: string; color: string; usageCount: number; createdAt: ISODate; }
interface Attachment { id: ID; blogId: ID; filename: string; mimeType: string; size: number; blob: Blob; width?: number; height?: number; uploadedAt: ISODate; }
```

---

## 9. 当前 OpenSpec 工作流状态

- **Sprint 1 Step 1**（脚手架）：已完成，不在 OpenSpec 流程内（脚手架本身是 setup）
- **Sprint 1 Step 2**（数据层）：**当前 change** `add-data-layer-dexie`
- **后续 change 候选**：`add-zustand-stores` / `add-plan-module` / `add-blog-module` / `add-kanban` 等

---

## 10. 引用文档（agent 必读）

- PRD：`D:\AI TestCoding\AI计划博客管理工具\docs\prd.md`
- 架构：`D:\AI TestCoding\AI计划博客管理工具\docs\architecture.md`
- 路线图：`D:\AI TestCoding\AI计划博客管理工具\docs\roadmap.md`
- UX 指南：`D:\AI TestCoding\AI计划博客管理工具\docs\ux-guidelines.md`
- 原型（视觉参考）：`D:\AI TestCoding\AI计划博客管理工具\prototype\`
