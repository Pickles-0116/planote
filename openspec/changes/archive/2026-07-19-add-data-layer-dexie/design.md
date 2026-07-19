## Design · 数据层（Dexie + 6 Repository + ULID + 种子）

> 本文档回答**「为什么这样实现」**——选型、索引、ID 策略、依赖注入设计、种子数据结构。**不重复** `architecture.md` 已写的 schema 字段定义，仅补充 v1.0 实现层面的具体决策。

---

## 1. 选型复述（来自 architecture §1，本 change 不再争议）

| 决策 | 选择 | 排除项 | 原因 |
|------|------|--------|------|
| 持久化 | IndexedDB + Dexie 4.x | localStorage / SQLite-WASM | 大容量 / Blob / liveQuery / 零配置 |
| ID 生成 | ULID | UUID v4 / nanoid | 26 字符比 UUID 短；时间排序便于索引；URL 友好 |
| 数据访问模式 | Repository 抽象 | 直接调 Dexie Table | v1.1 加云同步可替换实现；便于 fake-indexeddb 测试 |
| 错误模型 | `AppError` 联合类型 | 直接 throw string | UI 层可类型安全地 switch on `code` |
| 派生字段 | 写入时缓存 + 读时现算 | 完全现算（性能差）/ 完全缓存（一致性差） | 列表排序走缓存，详情页用现算做兜底校验 |

---

## 2. 目录结构（落实到具体文件）

```
planote-app/
├── src/
│   ├── db/
│   │   ├── index.ts                    # 实例化 default Dexie，导出 db
│   │   ├── schema.ts                   # class PlanoteDB extends Dexie（仅 schema 字符串）
│   │   ├── seed.ts                     # 4 套框架种子 + seedIfNeeded()
│   │   ├── liveQuery.ts                # useLiveQuery hook（Sprint 2+ 用，本 change 仅占位）
│   │   └── repos/
│   │       ├── types.ts                # 6 个 Repository interface + QueryOptions + AppError
│   │       ├── PlanRepo.ts             # class PlanRepo implements PlanRepository
│   │       ├── ItemRepo.ts
│   │       ├── BlogRepo.ts
│   │       ├── FrameworkRepo.ts
│   │       ├── TagRepo.ts
│   │       └── AttachmentRepo.ts
│   ├── lib/
│   │   └── id.ts                       # newId() / isValidId()
│   ├── types/
│   │   └── domain.ts                   # Plan / Item / Blog / Tag / Attachment / Framework / FrameworkSection + 全部枚举
│   └── shared/
│       └── utils/
│           ├── urgency.ts              # computeUrgency(plan, now?) → UrgencyLevel
│           └── progress.ts             # computeProgress(items) → number
```

**文件命名**：业务域前缀小写（`planRepo.ts` / `planStore.ts` / `usePlan.ts`），与 `project.md` §5.1 一致。

---

## 3. Schema 实现细节

### 3.1 `src/db/schema.ts`（完整代码示意）

```ts
import Dexie, { Table } from 'dexie';
import type { ID } from '@/types/domain';
import type { Plan, Item, Blog, Tag, Attachment, Framework } from '@/types/domain';

export class PlanoteDB extends Dexie {
  plans!:       Table<Plan, ID>;
  items!:       Table<Item, ID>;
  blogs!:       Table<Blog, ID>;
  tags!:        Table<Tag, ID>;
  attachments!: Table<Attachment, ID>;
  frameworks!:  Table<Framework, ID>;
  meta!:        Table<{ key: string; value: unknown }, string>;

  constructor(name = 'planote') {
    super(name);
    this.version(1).stores({
      plans:       '&id, level, timeDim, status, endDate, urgency, updatedAt, *tagIds, *childPlanIds, parentPlanId',
      items:       '&id, planId, status, dueDate, order, [planId+order]',
      blogs:       '&id, status, sourcePlanId, frameworkId, updatedAt, *tagIds, *attachmentIds',
      tags:        '&id, &name, usageCount',
      attachments: '&id, blogId, uploadedAt',
      frameworks:  '&id, category, builtin',
      meta:        '&key',
    });
  }
}

export const db = new PlanoteDB();
```

### 3.2 索引逐条解释

| 表 | 索引 | 用途 |
|----|------|------|
| plans | `&id` | 主键，ULID |
| | `level` | 按短/中/长期分组（list-grouped 视图） |
| | `timeDim` | 看板顶部 Tab（今日/本周/本月/本年/全部） |
| | `status` | 看板 4 列分组 + 列表筛选 |
| | `endDate` | 紧急度计算 / "即将到期" 排序 |
| | `urgency` | 智能排序第一关键字 |
| | `updatedAt` | 仪表盘"最近博客" / 列表默认排序 |
| | `*tagIds` | multiEntry：标签反查 `Plan[]` O(1) |
| | `*childPlanIds` | multiEntry：父计划→子计划查找（v1.0 不实现，保留） |
| | `parentPlanId` | 复合查询用 |
| items | `&id` | 主键 |
| | `planId` | `listByPlan` 主索引 |
| | `status` | 事项筛选（"待办" Tab） |
| | `dueDate` | "今日待办" / "即将到期" 排序 |
| | `order` | 拖拽排序后稳定 |
| | `[planId+order]` | 复合索引：单查询即可按 plan 排序返回，无需 JS 端 sort |
| blogs | `&id` | 主键 |
| | `status` | 列表页 4 Tab（全部/草稿/已发布/归档） |
| | `sourcePlanId` | 计划详情页"关联博客" 反查 |
| | `frameworkId` | 框架使用统计 |
| | `updatedAt` | 仪表盘"最近博客" |
| | `*tagIds` | 标签反查 |
| | `*attachmentIds` | 附件反查（清理孤儿） |
| tags | `&id` | 主键 |
| | `&name` | **唯一索引**——重复 name 抛 CONFLICT |
| | `usageCount` | 标签云排序（v1.1） |
| attachments | `&id` | 主键 |
| | `blogId` | `listByBlog` 主索引 |
| | `uploadedAt` | 按时间排序 |
| frameworks | `&id` | 主键（4 套种子使用固定字符串 ID） |
| | `category` | 抽屉分类 Tab |
| | `builtin` | 内置 vs 用户自定义（v1.0 全为 true） |
| meta | `&key` | 主键为字符串 key，value 为 unknown |

### 3.3 复合索引 `[planId+order]` 的 Dexie 语法

```ts
items: '&id, planId, status, dueDate, order, [planId+order]'
```

- 方括号 `[a+b]` 表示复合索引
- 查询时 `db.items.where('[planId+order]').between([planId, 0], [planId, Infinity]).toArray()` 可一次完成"某 plan + 按 order 排序"
- 比 `where('planId').equals(x).sortBy('order')` 少一次 sort 步骤，O(log n)

### 3.4 `*tagIds` 多值索引（multiEntry）

```ts
plans: '..., *tagIds, ...'
```

- `*` 前缀表示对数组每个元素分别建索引
- `db.plans.where('tagIds').equals('t_tech').toArray()` 返回所有 `tagIds` 包含 `'t_tech'` 的 Plan
- Dexie 自动维护一致性，**无需** Repository 手动同步

---

## 4. ID 生成（ULID）

### 4.1 为什么选 ULID

| 方案 | 长度 | 可排序 | 索引友好 | 选 / 不选 |
|------|------|--------|----------|----------|
| UUID v4 | 36 字符（含连字符）| ❌ 随机 | 一般 | ❌ 体积大 + 无序导致 B+tree 页分裂 |
| nanoid | 21 字符 | ❌ 随机 | 良 | ❌ 不可排序，无法按主键范围扫描 |
| ULID | 26 字符 | ✅ 时间序 | 优 | ✅ 选 |
| KSUID | 27 字符 | ✅ 时间序 | 优 | ❌ 体积稍大；ULID 生态更广 |

### 4.2 `src/lib/id.ts` 接口

```ts
import { ulid } from 'ulid';
import type { ID } from '@/types/domain';

export const newId = (): ID => ulid();

export const isValidId = (s: string): boolean =>
  typeof s === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
```

**正则说明**：
- ULID 用 Crockford base32 编码（去掉 I/L/O/U 避免歧义）
- 26 字符 = 10 字符时间戳（毫秒）+ 16 字符随机
- 编译期约束：`ID = string` + 运行时 `isValidId` 双重保证

### 4.3 ULID 排序与 createdAt 排序的一致性

- ULID 前 10 字符为 big-endian 毫秒时间戳 → 字符串字典序 = 时间序
- 但精度只有毫秒，**同一毫秒内**的多个 ID 顺序由随机部分决定
- 因此 Dexie `orderBy('id')` 与 `orderBy('createdAt')` 在大多数场景下结果一致，但**不保证**完全一致
- `spec.md` 中 `list()` 默认按 `createdAt` 排序而非 `id`，避免歧义

---

## 5. Repository 依赖注入设计

### 5.1 双导出模式

```ts
// src/db/repos/PlanRepo.ts
import type { PlanRepository } from './types';
import type { PlanoteDB } from '../schema';

export class PlanRepo implements PlanRepository {
  constructor(private db: PlanoteDB) {}
  async list(opts?: QueryOptions) { /* ... */ }
  // ... 其他方法
}

// 默认工厂：生产代码用零参数调用
import { db as defaultDb } from '../schema';
export const createPlanRepo = (database: PlanoteDB = defaultDb) => new PlanRepo(database);
```

### 5.2 测试场景

```ts
// src/db/repos/__tests__/PlanRepo.test.ts（v1.0 暂不写，但代码要支持）
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { PlanRepo } from '../PlanRepo';

const testDb = new Dexie('test') as unknown as PlanoteDB;
testDb.version(1).stores({ plans: '...', /* ... */ });
const repo = new PlanRepo(testDb);

test('create + get', async () => {
  const p = await repo.create({ title: 'test', /* ... */ });
  expect(p.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  expect(await repo.get(p.id)).toEqual(p);
});
```

### 5.3 全局访问点（生产代码）

```ts
// src/db/repos/index.ts（统一导出）
export { createPlanRepo as planRepo } from './PlanRepo';
export { createItemRepo as itemRepo } from './ItemRepo';
// ...
```

**用法**：
```ts
// 组件 / store 中：
import { planRepo } from '@/db/repos';
await planRepo.list();
```

**禁止**：
```ts
// ❌ 不要这样写：
import { db } from '@/db/schema';
await db.plans.toArray();
```

### 5.4 ESLint 推荐配置（design 阶段给出，实现阶段由 tasks 提示）

```js
// .eslintrc.cjs (rules)
rules: {
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['**/db', '**/db/schema', 'dexie'],
      message: '请通过 @/db/repos 的 Repository 访问数据，不要直接 import Dexie',
    }],
  }],
}
```

**作用范围**：`src/features/**` 与 `src/pages/**` 与 `src/stores/**`。`src/db/**` 自身允许（schema / seed 等内部文件需要直接 db）。

本 change **不实现** ESLint 规则（属 Sprint 2 公共组件范畴），仅在 design.md 给出配置样板。

---

## 6. 派生字段：urgency + progress

### 6.1 `src/shared/utils/urgency.ts`

```ts
import type { Plan, UrgencyLevel } from '@/types/domain';

const DAY = 24 * 60 * 60 * 1000;

export function daysBetween(from: number, to: string | Date): number {
  return Math.ceil((new Date(to).getTime() - from) / DAY);
}

export function computeUrgency(plan: Pick<Plan, 'endDate' | 'status'>, now = Date.now()): UrgencyLevel {
  if (!plan.endDate) return 'none';
  if (plan.status === 'done' || plan.status === 'paused') return 'none';
  const days = daysBetween(now, plan.endDate);
  if (days <= 0) return 'red';
  if (days <= 3) return 'orange';
  if (days <= 7) return 'yellow';
  return 'none';
}
```

**关键点**：
- `days <= 0` = "今天或已逾期" → 红色
- 不依赖 `urgency` 字段本身，**纯函数可单测**
- `now` 参数便于测试时注入固定时间

### 6.2 `src/shared/utils/progress.ts`

```ts
import type { Item } from '@/types/domain';

export function computeProgress(items: Pick<Item, 'checked'>[]): number {
  if (items.length === 0) return 0;
  const checked = items.filter(i => i.checked).length;
  return Math.floor((checked / items.length) * 100);
}
```

### 6.3 何时刷新缓存

| 触发点 | 刷哪些字段 | 在哪个方法 |
|--------|----------|-----------|
| `planRepo.create` | `urgency` | create |
| `planRepo.update` 修改 `endDate` / `status` | `urgency` | update |
| `itemRepo.toggle` | `urgency` + `progress` | recomputeProgress |
| `itemRepo.create` / `delete` / `reorder` | 不刷新（progress 不会因 create 单独变化，但 delete 会） | recomputeProgress on delete |
| `planRepo.recomputeProgress` | `progress` + `urgency`（同事务内一起刷） | —— |

**策略**：**懒刷新** + **关键操作同步刷**。例如仪表盘打开时若发现 `urgency` 过期（时间跨过 0 点），可通过后端定时任务（v1.1+）刷新；v1.0 接受"用户操作时刷新"。

---

## 7. 种子数据：4 套框架

### 7.1 数据来源

从 `D:\AI TestCoding\AI计划博客管理工具\prototype\pages\blog-edit.html` 中的 framework 区块反查（用户在原型已手写 4 套）。本 change 在 `src/db/seed.ts` 落 TypeScript 常量形式。

### 7.2 4 套框架（v1.0 内容）

> 完整 sections 字段在 `src/db/seed.ts` 落实（22 字段，含 heading / guide / placeholder），此处仅列章节骨架。

#### 框架 1：项目复盘（`fw_review`, category='review', icon='GitPullRequest'）

```
H1: {plan.title} · 项目复盘
H2: 目标回顾
  → 引导：原定目标是什么？实际达成多少？
H2: 过程亮点
  → 引导：哪些节点比预期顺利？为什么？
H2: 过程挑战
  → 引导：哪些卡点？当时怎么解决的？
H2: 关键数据
  → 引导：完成率 {progress}%，完成 {n}/{m} 个事项
H2: 下一步计划
  → 引导：基于这次经验，下一阶段做什么？
```

#### 框架 2：21 天习惯复盘（`fw_habit`, category='habit', icon='CalendarDays'）

```
H1: 21 天习惯养成复盘 · {plan.title}
H2: 习惯定义
  → 引导：想养成的具体习惯是什么？触发场景？
H2: 21 天打卡记录
  → 引导：完成情况 / 间断原因
H2: 体感变化
  → 引导：第 7 / 14 / 21 天分别有什么不同？
H2: 关键转折点
  → 引导：哪一刻开始感觉「它成了习惯」？
H2: 下一周期
  → 引导：继续？还是叠加新习惯？
```

#### 框架 3：读书笔记（`fw_note`, category='note', icon='BookOpen'）

```
H1: 《{book.title}》读书笔记
H2: 一句话总结
  → 引导：用一句话向朋友介绍这本书
H2: 核心论点
  → 引导：作者最想传达的 3 个观点是什么？
H2: 我的共鸣
  → 引导：哪些段落让你停下来思考？
H2: 行动启发
  → 引导：读完后你会做一件什么事？
H2: 推荐指数
  → 引导：⭐⭐⭐⭐⭐ + 推荐人群
```

#### 框架 4：月度总结（`fw_summary`, category='summary', icon='BarChart3'）

```
H1: {YYYY} 年 {MM} 月 · 个人复盘
H2: 本月关键数据
  → 引导：完成计划数 / 发布博客数 / 关键里程碑
H2: 最重要的事
  → 引导：本月最有价值的 3 件事
H2: 最大教训
  → 引导：踩过的一个坑 / 学到一个道理
H2: 下月目标
  → 引导：下个月最重要的 3 件事
H2: 自我对话
  → 引导：给 1 个月后的自己一句话
```

### 7.3 `src/db/seed.ts` 幂等设计

```ts
import type { PlanoteDB } from './schema';
import type { Framework } from '@/types/domain';

const BUILTIN_FRAMEWORKS: Framework[] = [
  { id: 'fw_review', name: '项目复盘', category: 'review', /* ... */, builtin: true, useCount: 0 },
  { id: 'fw_habit',  name: '21 天习惯复盘', category: 'habit', /* ... */, builtin: true, useCount: 0 },
  { id: 'fw_note',   name: '读书笔记', category: 'note', /* ... */, builtin: true, useCount: 0 },
  { id: 'fw_summary',name: '月度总结', category: 'summary', /* ... */, builtin: true, useCount: 0 },
];

export async function seedIfNeeded(db: PlanoteDB): Promise<void> {
  const flag = await db.meta.get('seeded');
  if (flag?.value === true) return;

  await db.transaction('rw', db.frameworks, db.meta, async () => {
    await db.frameworks.bulkPut(BUILTIN_FRAMEWORKS);
    await db.meta.put({ key: 'seeded', value: true });
  });
}
```

**幂等保证**：
- `bulkPut` 而非 `bulkAdd`：若已存在（同 id）则覆盖（无副作用，因为 builtin 数据固定）
- `meta.seeded` 标记二次启动直接 return，避免不必要的事务
- 多标签页并发由 Dexie 事务串行化

### 7.4 何时调用

- **不在 main.tsx 直接调**：避免阻塞首屏
- **方案 A**（推荐）：在 layout 组件的 `useEffect` 调 `seedIfNeeded(db)`，首次启动后台执行；UI 不等待
- **方案 B**（备选）：在 `createPlanRepo()` 工厂函数内调一次

本 change 推荐方案 A；具体接入点留给 `add-zustand-stores` change。

---

## 8. 错误处理（AppError）

```ts
// src/db/repos/types.ts
export type AppError =
  | { code: 'NOT_FOUND';     message: string }
  | { code: 'VALIDATION';    message: string; fields?: Record<string, string> }
  | { code: 'STORAGE_FULL';  message: string; quota?: number }
  | { code: 'CONFLICT';      message: string }
  | { code: 'PERMISSION';    message: string }
  | { code: 'UNKNOWN';       message: string; cause?: unknown };

export class AppError extends Error {
  constructor(public error: AppError) { super(error.message); }
}
```

**使用约定**：
- Repository 方法检测到 `Dexie.AbortError` / `ConstraintError` 时转 `AppError`
- 组件层 catch 后根据 `code` 弹对应 toast（v1.0 仅前 4 种）

---

## 9. 性能与可扩展性预留

### 9.1 v1.0 数据量预期

- 计划 ≤ 1000
- 事项 ≤ 50 × 1000 = 50,000
- 博客 ≤ 500
- 框架 4 条（固定）
- 标签 ≤ 100
- 附件 Blob 单文件 ≤ 5MB，总量 ≤ 200MB

**Dexie 在该量级性能**：toArray 全表 < 50ms（IndexedDB 浏览器实现差异在 ±20%）。

### 9.2 v1.1+ 演进路径（不在本 change 实现）

| 场景 | v1.1 方案 | 对本 change 的影响 |
|------|----------|-------------------|
| 云同步 | 新增 `RemotePlanRepo implements PlanRepository` 包 fetch API | 零修改：Repository 接口已抽象 |
| 全文检索 | 新增 `SearchService`，索引 `Blog.contentText` | 零修改：`contentText` 字段已存 |
| 标签 UI | 新增 `tagStore` + 标签云组件 | 零修改：`Tag` 表与 `*tagIds` 索引已建 |
| PDF/DOCX 解析 | 新增 `parseAttachment(blob)` | 零修改：`Attachment.blob` 字段已存 |
| 用户自定义框架 | 取消 `FrameworkRepo` 的只读限制，加 create/update | 零修改：接口扩展 |

### 9.3 Dexie liveQuery 接入（占位，本 change 不实现）

```ts
// src/db/liveQuery.ts（本 change 仅空文件占位）
// import { liveQuery } from 'dexie';
// import { useEffect, useState } from 'react';
//
// export function useLiveQuery<T>(querier: () => Promise<T>, deps: unknown[]): T | undefined {
//   const [data, setData] = useState<T>();
//   useEffect(() => {
//     const sub = liveQuery(querier).subscribe({ next: setData });
//     return () => sub.unsubscribe();
//   }, deps);
//   return data;
// }
```

Sprint 2 的 `add-zustand-stores` 启用该 hook 接入 Zustand。

---

## 10. 不在本 change 范围

- 任何 UI / 组件
- Zustand store
- 路由配置
- Tiptap 集成
- 实时数据订阅（liveQuery）
- 全文检索
- 附件文件解析（PDF/DOCX）
- 撤销 / 重做栈
- 数据迁移脚本（v1.0 单 schema 版本）
- ESLint 规则（给出样板，tasks 提示非强制）
- 单元测试代码（v1.0 Sprint 1 暂不写）
