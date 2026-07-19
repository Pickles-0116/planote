## Why

Planote v1.0 是「桌面端、本地优先」的个人生产力工具，所有数据必须落用户机器。架构已锁定 **Dexie + IndexedDB** 作为持久化方案（见 `architecture.md` §1.5 与 §3.2）。当前 Sprint 1 脚手架已就绪（Vite + React 18 + TS + Tailwind + 路由 + 9 页面占位），但**数据层完全是空的**——没有 Schema、没有 Repository、没有种子数据，下游所有模块（计划 CRUD、事项勾选、博客写作、框架抽屉）都无处落脚。

不实现数据层，UI 是空中楼阁；任何 store 调 `db.plans.toArray()` 都是直接耦合 Dexie，**v1.1 加云同步时无法无痛替换**。

本 change 落「数据访问层」这一层切面：**6 张 Dexie 表 + 6 个 Repository 接口 + ULID ID 生成 + 4 套内置框架种子**。完成后，Store / 组件只依赖 Repository 接口，持久化实现细节被封装在 db 模块内。

## What

落地以下 5 个交付物：

1. **Dexie Schema**：`src/db/schema.ts` 定义 6 张表（plans / items / blogs / tags / attachments / frameworks）+ 索引（按 architecture §3.2 的索引清单逐条实现）。
2. **Repository 接口与实现**：`src/db/repos/` 下 6 个文件，每个文件 1 个 Repository 类，方法签名与 `architecture.md` §4.1 一一对应。
3. **ID 生成器**：`src/lib/id.ts` 导出 `newId(): string`，基于 `ulid` 包，按时间排序，26 字符。
4. **种子数据**：`src/db/seed.ts` 首次启动时写入 4 套内置框架（项目复盘 / 21 天习惯 / 读书笔记 / 月度总结），用 `meta` 表的 `seeded: true` 标记防重复。
5. **类型定义**：`src/types/domain.ts` 实现 architecture §3.1 的全部 interface + enum + ULID/ISO 时间类型别名。

**不在本 change 范围**：

- Zustand store 切面（planStore / blogStore / uiStore 等）—— 留给 `add-zustand-stores` change
- liveQuery → React Hook 桥（`useLiveQuery`）—— 同上
- Tiptap 编辑器 / 富文本 JSON 格式细节 —— 留给 Sprint 3 的 `add-blog-module`
- 任何 UI 组件 —— 纯数据层 change

## Scope

**In Scope**：

- Dexie 4.x schema 与索引（含复合索引 `[planId+order]`）
- 6 个 Repository 类的 CRUD + 业务方法（toggle / reorder / recomputeProgress / apply / search / upload 等）
- ULID 主键统一生成
- 4 套内置框架种子（categories: review / habit / note / summary）
- 错误处理统一为 `AppError` 类型（architecture §4.3）
- `meta` 表存种子标记 + 后续同步游标预留
- 代码可被 fake-indexeddb 测试（不依赖全局单例注入）

**Out of Scope（v1.1+）**：

- 云同步（`SyncRepository` / Supabase）
- 全文检索（`SearchService`，MiniSearch）
- 标签系统 UI（仅 schema 与 tagRepo 方法，UI 留给 v1.1）
- 附件 PDF/DOCX 解析（v1.0 只占 Blob 存）
- 数据迁移工具（v1.0 单一 schema 版本，不写迁移函数）
- 备份 / 导出 / 导入

## Acceptance Criteria

- [ ] **AC-1**：浏览器 DevTools → Application → IndexedDB → `planote` 数据库可见 6 张表（plans / items / blogs / tags / attachments / frameworks）+ 1 张 meta 表
- [ ] **AC-2**：在 React DevTools console 中可调用 `planRepo.create({...})` 并成功写入；刷新浏览器后数据仍在
- [ ] **AC-3**：6 个 Repository 暴露的方法与 `architecture.md` §4.1 接口签名一致（参数 / 返回值 / 异常）
- [ ] **AC-4**：首次启动后 `frameworks` 表有 4 条记录；二次启动不会重复（meta 表 seeded=true）
- [ ] **AC-5**：所有 ID 为 ULID 格式（26 字符，base32），按 `createdAt` 排序时与 ID 字典序一致
- [ ] **AC-6**：Repository 方法可在不依赖 React / 不依赖 Zustand 的纯 Node 环境下用 fake-indexeddb 测试（构造函数接受 Dexie 实例注入）
- [ ] **AC-7**：`pnpm dev` 启动后控制台无 Dexie 警告（如 schema 索引写错会打印到 console）
- [ ] **AC-8**：6 张表的索引与 architecture §3.2 逐字一致（plans 至少含 `level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId`；items 含 `[planId+order]` 等）

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| Dexie 索引列写错导致 schema 异常 | 中 | 把 `db.version(1).stores({...})` 在 `src/db/index.ts` 单独 import，AC-7 验证 console 无警告 |
| Repository 注入设计被忽略，全局单例 `import { db } from './schema'` 写死 | 中 | 在 design.md 明确"构造函数注入 + 默认导出工厂函数"双模式；tasks.md 列入检查项 |
| ULID 字段在 IndexedDB 排序行为与字符串字典序不一致 | 低 | ULID 本身按时间排序，verified：前 10 字符为时间戳，后 16 为随机；字符串字典序 = 时间序 |
| 4 套框架的章节数据手写错误（字段拼写/层级） | 低 | 章节数据从 `prototype/pages/blog-edit.html` 的 4 个 framework 区块反查；design.md 标注每套框架的 sections |
| 种子写入与并发初始化竞态 | 低 | `seedIfNeeded` 用 `db.meta.get('seeded')` 幂等判断；多标签页并发由 Dexie 事务串行化 |

## Dependencies

- **上游（已完成）**：Sprint 1 Step 1 脚手架（package.json / vite.config.ts / tsconfig.json / Tailwind / 路由占位）
- **下游（待启动）**：
  - `add-zustand-stores`：消费 Repository 封装 store
  - `add-plan-module`（Sprint 2）：消费 PlanRepo / ItemRepo
  - `add-blog-module`（Sprint 3）：消费 BlogRepo / FrameworkRepo / AttachmentRepo

## Out of Scope Clarification

> 与 PRD v1.1 一致：v1.0 框架为内置模板，**不开放用户自定义**。所以本 change 不实现 `FrameworkRepo.create/update/delete`（v1.2 加）。

> `parentPlanId` / `childPlanIds` 字段在 architecture §3.1 已定义，但 v1.0 暂不实现嵌套拆解 UI（roadmap 5.6 风险表注明"v1.0 限制三层"）。本 change 在 schema 里**保留字段**，但 Repository 不实现 parent/child 查询方法，避免误导。
