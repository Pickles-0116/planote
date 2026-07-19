# Tasks · 数据层（Dexie + 6 Repository + ULID + 种子）

> 按 architecture §5 目录结构组织。每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. 依赖与工具

- [x] 1.1 `pnpm add dexie dexie-react-hooks ulid`（实际 `pnpm.cmd`，因 PS 执行策略）
  - 验证：`package.json` 的 `dependencies` 含 3 个包
  - 验证：`pnpm list dexie` 返回 `4.x`（实际 4.4.4）
- [x] 1.2 创建 `src/lib/id.ts`，导出 `newId()` 与 `isValidId()`（代码见 `design.md` §4.2）
- [x] 1.3 创建 `src/types/domain.ts`，定义全部 interface + enum + `ID` / `ISODate` 类型别名
  - 字段与 `architecture.md` §3.1 逐字对齐
  - 不留 `TODO` / 占位

## 2. 数据库 Schema

- [x] 2.1 `src/db/schema.ts`：定义 `class PlanoteDB extends Dexie`，6 张表 + meta 表
  - 索引字符串与 `design.md` §3.1 逐字一致
  - `constructor(name = 'planote')` 支持测试时换名
- [x] 2.2 `src/db/index.ts`：导出 `export const db = new PlanoteDB()`（生产用单例）
- [x] 2.3 `src/db/repos/types.ts`：定义 6 个 Repository interface + `QueryOptions` + `AppError` 联合类型 + `AppError` class
  - 接口签名与 `architecture.md` §4.1 逐字一致
  - 错误类型与 `design.md` §8 一致
- [x] 2.4 `src/shared/utils/urgency.ts`：导出 `computeUrgency(plan, now?)`（代码见 `design.md` §6.1）
- [x] 2.5 `src/shared/utils/progress.ts`：导出 `computeProgress(items)`（代码见 `design.md` §6.2）

## 3. Repository 实现（按 architecture §4.1）

> 每个 Repository 类构造函数接受 `PlanoteDB`，导出工厂函数 `createXxxRepo(db?)` 用零参默认 db。

- [x] 3.1 `src/db/repos/PlanRepo.ts`
  - `list(opts?)` 默认按 `createdAt desc`
  - `get(id)` 不存在抛 `NOT_FOUND`
  - `create(input)` 自动填 `id` / `createdAt` / `updatedAt` / `urgency`，`progress = 0`
  - `update(id, patch)` 自动刷 `updatedAt`，修改 `endDate` / `status` 时刷 `urgency`
  - `delete(id)` 事务内 cascade 删除 items，blog 的 `sourcePlanId` 置空
  - `bulkUpdate(ids, patch)` 事务内批量更新
  - `recomputeProgress(planId)` 重算 `progress` + `urgency` 缓存
- [x] 3.2 `src/db/repos/ItemRepo.ts`
  - `listByPlan(planId)` 按 `[planId+order]` 复合索引返回
  - `toggle(id)` 切换 `checked` + `status` + `completedAt`，**同步**调 `recomputeProgress`
  - `create(planId, input)` `order` 自动 = max + 1
  - `reorder(planId, orderedIds)` 事务内重写 `order` 字段
  - `delete(id)` 调 `recomputeProgress`（progress 会因删除未勾选事项而变化）
- [x] 3.3 `src/db/repos/BlogRepo.ts`
  - `list(opts?)` 默认按 `updatedAt desc`
  - `get(id)` / `create(input)` / `update(id, patch)` / `delete(id)` / `duplicate(id)` / `archive(id)`
  - `update` 改 `status` 为 `'published'` 时自动填 `publishedAt`
  - `duplicate` 不复制 `sourcePlanId` / `frameworkId` / `attachmentIds`，title 加 `(副本)`，status 置 `draft`
  - `search(q)` 子串匹配 `title` 或 `contentText`（不区分大小写）
- [x] 3.4 `src/db/repos/FrameworkRepo.ts`
  - **只实现** `list()` / `get(id)` / `apply(frameworkId, planId?)` / `incrementUseCount(frameworkId)`
  - **不实现** create / update / delete（v1.0 限制内置）
  - `apply` 返回 Tiptap JSON 文档（纯 JSON 对象，不依赖 Tiptap 包是否安装）
  - `apply` 同事务内 `incrementUseCount`
- [x] 3.5 `src/db/repos/TagRepo.ts`
  - `list()` 按 `usageCount desc` 排序
  - `create(input)` 唯一 name 冲突抛 `CONFLICT`
  - `delete(id)` 事务内 cascade 从所有 Plan/Blog 的 `tagIds` 移除
  - `getByName(name)` 辅助方法
- [x] 3.6 `src/db/repos/AttachmentRepo.ts`
  - `listByBlog(blogId)` 按 `uploadedAt asc`
  - `upload(blogId, file)` 从 `File` 构造 `Attachment`，存 Blob
  - `delete(id)` 仅删附件记录，**不动** blog 的 `attachmentIds`（由 BlogRepo 维护）
  - `getBlob(id)` 返回 `Blob`
  - `getObjectURL(id)` 调用 `URL.createObjectURL(blob)` 返回，**调用方需配对 revoke`
- [x] 3.7 `src/db/repos/index.ts`：统一导出 6 个 `createXxxRepo` 工厂函数 + db 实例
  ```ts
  export { createPlanRepo as planRepo } from './PlanRepo';
  export { createItemRepo as itemRepo } from './ItemRepo';
  export { createBlogRepo as blogRepo } from './BlogRepo';
  export { createFrameworkRepo as frameworkRepo } from './FrameworkRepo';
  export { createTagRepo as tagRepo } from './TagRepo';
  export { createAttachmentRepo as attachmentRepo } from './AttachmentRepo';
  ```

## 4. 种子数据

- [x] 4.1 `src/db/seed.ts` 定义 `BUILTIN_FRAMEWORKS` 常量数组
  - 4 套框架的 sections 字段完整（每套 ≥ 5 个章节，含 heading / guide / placeholder）
  - 4 套固定 ID：`'fw_review'` / `'fw_habit'` / `'fw_note'` / `'fw_summary'`
  - `category` 分别为 `review` / `habit` / `note` / `summary`
  - `icon` 为 Lucide icon name（`'GitPullRequest'` / `'CalendarDays'` / `'BookOpen'` / `'BarChart3'`）
  - `builtin: true`，`useCount: 0`
- [x] 4.2 `seed.ts` 导出 `seedIfNeeded(db)` 函数（幂等）
  - 检测 `meta` 表 `seeded: true` 跳过
  - 事务内 `bulkPut(BUILTIN_FRAMEWORKS)` + 写 `meta.seeded = true`
- [x] 4.3 接入点：暂在 `src/main.tsx` 顶层调 `seedIfNeeded(db)`（**fire-and-forget**，不 await）

## 5. 验证

- [x] 5.1 `pnpm dev` 启动后控制台无 error / warning（已验证：Vite ready in 1.3s，无 schema 警告）
  - 特别检查 Dexie schema 警告（索引名错会报 `SchemaError`）
- [ ] 5.2 浏览器 DevTools → Application → IndexedDB → `planote` 数据库可见 7 张表
  - `plans` / `items` / `blogs` / `tags` / `attachments` / `frameworks` / `meta`
  - 截图保存到本任务评论
- [ ] 5.3 打开 DevTools Console，粘贴执行：
  ```js
  const { planRepo, frameworkRepo, db } = await import('/src/db/repos/index.ts');
  const p = await planRepo.create({ title: '测试计划', description: '...', level: 'short', timeDim: 'daily', tagIds: [], itemIds: [], blogIds: [], childPlanIds: [] });
  console.log('plan id', p.id, 'length', p.id.length);
  console.log('all plans', await planRepo.list());
  const fws = await frameworkRepo.list();
  console.log('frameworks', fws.map(f => f.name));
  console.log('seeded', await db.meta.get('seeded'));
  ```
  - 预期：plan.id 是 26 字符 ULID 正则匹配；`frameworks` 返回 4 条；`meta.seeded.value === true`
  - 截图保存
- [ ] 5.4 刷新浏览器，再次执行 `planRepo.list()`，确认测试计划仍在（持久化 OK）
- [ ] 5.5 验证 Dexie 警告：DevTools Console 不应出现 `Dexie.schemaError` / `Table X not found`
- [x] 5.6 （可选）检查 `pnpm build` 通过 TS 严格模式编译，0 error（已验证：1595 modules transformed, 0 error）

## 6. 文档

- [x] 6.1 在 `src/db/repos/index.ts` 顶部加注释：禁止在 `src/features/**` / `src/pages/**` / `src/stores/**` 直接 `import { db } from '@/db/schema'`
- [ ] 6.2 （非强制）在 `.eslintrc.cjs` 加 `no-restricted-imports` 规则（design.md §5.4 样板）
  - 不在 AC 必做项；加则更稳

## 7. 提交与归档

- [ ] 7.1 `git add .` + `git commit -m "feat(data): add Dexie schema + 6 repositories + ULID + 4 builtin frameworks"`（项目尚未 git init，待用户初始化后执行）
- [x] 7.2 运行 `openspec.cmd validate add-data-layer-dexie --strict` 验证 change 完整性（已通过：Change 'add-data-layer-dexie' is valid）
- [ ] 7.3 （仅在 Sprint 1 全部 tasks 完成后）`openspec.cmd archive add-data-layer-dexie`

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（6+1 张表）| 5.2 | DevTools 截图 |
| AC-2（CRUD 可调 + 持久化）| 5.3 + 5.4 | Console 执行 + 刷新 |
| AC-3（接口签名一致）| 3.1-3.6 | 与 `architecture.md` §4.1 逐字对比 |
| AC-4（4 条种子）| 5.3 | frameworks 列表长度 = 4 |
| AC-5（ULID 26 字符）| 5.3 | 正则匹配 |
| AC-6（依赖注入可测）| 3.1-3.6 | 构造函数接受 db 参数（代码 review） |
| AC-7（无 console 警告）| 5.1 + 5.5 | DevTools Console |
| AC-8（索引逐字一致）| 2.1 | 与 `design.md` §3.1 字符串对比 |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（依赖 + 类型）| 0.3 | 纯配置 + 类型 |
| 2（schema + utils）| 0.4 | Dexie schema 需逐字校对 |
| 3（6 Repository）| 1.5 | 平均每 Repo 0.25，含事务细节 |
| 4（种子）| 0.4 | 4 套框架 sections 字段从原型反查 |
| 5（验证）| 0.3 | 手动跑通 + 截图 |
| 6（文档）| 0.1 | 注释 |
| **合计** | **3.0 人天** | 与 roadmap T-004~T-006 工时匹配 |
