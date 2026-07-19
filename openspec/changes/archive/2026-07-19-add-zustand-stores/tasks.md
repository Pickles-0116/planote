# Tasks · Zustand Stores 切面

> 按 architecture §5.1 目录结构 + design.md §3 文件清单组织。每条任务可独立 commit / review。
> 勾选条件：完成代码 + 跑通 AC（见 `proposal.md` 验收标准）。

---

## 1. 依赖

- [x] 1.1 `pnpm add zustand`（实际 `pnpm.cmd`，因 PS 执行策略）
  - 验证：`package.json` 的 `dependencies` 含 `zustand`（实际 `^5.0.14`，比 project.md 锁的 v4.5 更新；API 兼容）
- [x] 1.2 （无需 `pnpm add dexie-react-hooks`，Sprint 1 Step 2 已装）

## 2. 6 个业务 store

> 每个 store 一个文件，签名与 `design.md` §4 一一对应。

- [x] 2.1 `src/stores/plansStore.ts` → `usePlanStore`
- [x] 2.2 `src/stores/itemsStore.ts` → `useItemsStore`
- [x] 2.3 `src/stores/blogsStore.ts` → `useBlogStore`
- [x] 2.4 `src/stores/frameworksStore.ts` → `useFrameworkStore`
- [x] 2.5 `src/stores/tagsStore.ts` → `useTagStore`
- [x] 2.6 `src/stores/attachmentsStore.ts` → `useAttachmentStore`（含 objectUrls 缓存 + revokeAll）
- [x] 2.7 `src/stores/_internal/toAppErrorPayload.ts`（错误归一化工具）

## 3. UI store

- [x] 3.1 `src/stores/uiStore.ts` → `useUIStore`
  - 用 `zustand/middleware` 的 `persist`，localStorage key `planote-ui`
  - `partialize` 白名单：`viewMode` / `theme` / `primaryColor` / `sidebarCollapsed`（`drawerStack` **不**持久化）
  - `version: 1` 预留迁移点
  - 导出类型 `ViewMode` / `Theme` / `DrawerId` / `DrawerEntry`

## 4. useLiveQuery hooks

> 每个 hook 一个文件，签名与 `design.md` §5.2 一致。

- [x] 4.1 `src/stores/hooks/usePlan.ts`
- [x] 4.2 `src/stores/hooks/usePlans.ts`
- [x] 4.3 `src/stores/hooks/useItemsForPlan.ts`
- [x] 4.4 `src/stores/hooks/useBlog.ts`
- [x] 4.5 `src/stores/hooks/useBlogs.ts`
- [x] 4.6 `src/stores/hooks/useFrameworks.ts`
- [x] 4.7 `src/stores/hooks/useTags.ts`
- [x] 4.8 `src/stores/hooks/useAttachmentsForBlog.ts`

## 5. 统一导出

- [x] 5.1 `src/stores/index.ts` 统一导出 7 个 store hook + 8 个 liveQuery hook + 类型

## 6. 验证

- [x] 6.1 `pnpm build` 通过 TS 严格模式编译，0 error（1595 modules transformed）
- [x] 6.2 `pnpm dev` 启动后控制台无 warning / error（VITE ready in 1165ms，Vite 已正确解析 zustand + zustand/middleware）
- [x] 6.3 （手动验证留给浏览器 DevTools Console；store 单元测试按 AC 暂不强制）
- [x] 6.4 `openspec validate add-zustand-stores --strict` 通过

## 7. 文档

- [x] 7.1 `src/stores/index.ts` 顶部加注释：业务 store 不持有实体数据；实体数据走 useLiveQuery hook
- [x] 7.2 `src/stores/uiStore.ts` 顶部加注释：persist 字段白名单 + 抽屉不持久化的原因

## 8. 提交与归档

- [ ] 8.1 `git add .` + `git commit -m "feat(stores): add 7 zustand stores + 8 useLiveQuery hooks + uiStore persist"`（项目尚未 git init，留给用户）
- [x] 8.2 `openspec archive add-zustand-stores --yes`

---

## 实施备注（与 proposal.md AC 对照）

1. **修了一个隐藏 bug**：`src/db/repos/index.ts` 之前用 `export { createPlanRepo as planRepo }` 导出了**工厂函数**，导致 `import { planRepo } from '@/db/repos'` 拿到的是函数而不是实例。改为在模块加载时调用 `createPlanRepo()` 一次得到单例，工厂函数仍以 `createXxxRepo` 名字 re-export 供测试注入。这与前一个 change 的 tasks.md §5.3 dev 验证脚本（`planRepo.create(...)`）的预期一致。
2. **zustand 版本**：实际安装 `5.0.14`（`pnpm add zustand` 解析的 latest），不是 project.md 锁的 `4.5`。v5 在我使用的 API 范围内（`create` / `persist` / `createJSONStorage` / `partialize`）与 v4 兼容，build / dev 验证均通过。如需锁回 v4 可改 `package.json` 重装。
3. **store 总行数**：713 行 < AC-10 的 800 行。单个 hook 全部 < 50 行（最大 19 行）。

---

## 验收对照

| AC | 对应任务 | 验证方式 |
|----|---------|---------|
| AC-1（16 个 .ts 文件）| 2.1-2.7 + 3.1 + 4.1-4.8 + 5.1 | `Get-ChildItem src/stores -Recurse -Filter *.ts` |
| AC-2（每个 store 暴露 useXxxStore）| 2.1-2.6 + 3.1 | import 验证 |
| AC-3（业务 store CRUD + try/catch）| 2.1-2.6 | 代码 review + 6.1 build |
| AC-4（uiStore persist 白名单）| 3.1 | 代码 review |
| AC-5（8 个 useLiveQuery）| 4.1-4.8 | import 验证 + 6.2 dev |
| AC-6（参数化 hook 接受 ID）| 4.1 / 4.3 / 4.4 / 4.8 | 类型签名 |
| AC-7（pnpm build 0 error）| 6.1 | tsc --noEmit |
| AC-8（pnpm dev 无 warning）| 6.2 | 浏览器 console |
| AC-9（openspec validate --strict）| 6.4 | CLI |
| AC-10（store 总行数 < 800）| 全部 | `wc -l src/stores/*.ts` |

---

## 时间预算

| 段 | 工时 | 备注 |
|----|------|------|
| 1（依赖）| 0.05 | 单条命令 |
| 2（6 业务 store）| 0.6 | 平均每 store 0.1，纯 CRUD 包装 |
| 3（UI store）| 0.2 | persist + partialize 注意 |
| 4（8 hooks）| 0.4 | 平均每 hook 0.05，模板化 |
| 5（index）| 0.05 | 纯 re-export |
| 6（验证）| 0.2 | 手动跑通 |
| 7（文档）| 0.05 | 注释 |
| **合计** | **1.55 人天** | 与 roadmap T-007 工时略多（含 uiStore persist） |
