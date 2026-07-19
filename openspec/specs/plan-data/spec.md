# plan-data Specification

## Purpose
TBD - created by archiving change add-data-layer-dexie. Update Purpose after archive.
## Requirements
### Requirement: Plan 数据模型

系统 MUST 持久化 `Plan` 实体，并支持 CRUD + 派生字段缓存。

`Plan` 实体的字段集、枚举值、必填/可选规则见 `architecture.md` §3.1。**关键约束**：

- `id` 为 ULID（26 字符 base32），由 `newId()` 生成，**调用方不可指定**
- `createdAt` / `updatedAt` 由 Repository 在创建/更新时自动填充
- `progress` 与 `urgency` 是**派生字段**，写入时由 `recomputeProgress` 缓存，但 UI 也可通过 selector 现算
- `itemIds` / `blogIds` / `childPlanIds` 是冗余索引，**必须**与对应子表保持一致（Repository 维护）

#### Scenario: 创建 Plan

- **GIVEN** 用户填写了 Plan 标题、描述、层级（`level`）、时间维度（`timeDim`）、截止日期（`endDate`）
- **WHEN** 调用 `planRepo.create({ title, description, level, timeDim, endDate, ... })`
- **THEN** 系统在 `plans` 表中插入一条记录，`id` 自动生成（ULID），`createdAt` / `updatedAt` 自动填充，`status` 默认为 `'todo'`，`progress` 默认为 `0`，`urgency` 默认为 `'none'`，`tagIds` / `itemIds` / `blogIds` / `childPlanIds` 默认为空数组
- **AND** 返回的 `Plan` 对象包含全部字段（含自动生成的 `id` / `createdAt` / `updatedAt`）

#### Scenario: 查询 Plan 列表

- **GIVEN** `plans` 表中有 N 条记录
- **WHEN** 调用 `planRepo.list()`（无参数）
- **THEN** 返回所有 `Plan`，按 `createdAt` **降序**排序（最新创建的在前）

#### Scenario: 条件查询与排序

- **GIVEN** `plans` 表中有不同 `urgency` / `progress` 的记录
- **WHEN** 调用 `planRepo.list({ filter: { timeDim: { $in: ['daily', 'monthly'] } }, sort: [{ field: 'urgency', order: 'asc' }, { field: 'progress', order: 'desc' }] })`
- **THEN** 返回筛选后按 `urgency asc`（red → none）→ `progress desc` 排序的 `Plan[]`

#### Scenario: 更新 Plan

- **GIVEN** `plans` 表中存在 Plan `p_abc`
- **WHEN** 调用 `planRepo.update('p_abc', { status: 'doing' })`
- **THEN** `p_abc` 的 `status` 字段更新为 `'doing'`，`updatedAt` 自动刷新为当前时间，其他字段不变
- **AND** 若 `p_abc` 不存在，抛出 `AppError({ code: 'NOT_FOUND' })`

#### Scenario: 删除 Plan

- **GIVEN** `plans` 表中存在 Plan `p_abc`，且其下有 5 条 Item 与 2 条 Blog
- **WHEN** 调用 `planRepo.delete('p_abc')`
- **THEN** Plan `p_abc` 被删除，**其下 5 条 Item 同步删除**（事务内 cascade）
- **AND** 关联的 2 条 Blog 的 `sourcePlanId` 字段被置为 `undefined`（**不**级联删除 Blog，保留内容）

---

### Requirement: Item 数据模型

系统 MUST 持久化 `Item`（事项）实体，与 `Plan` 形成 1—N 关系。

`Item.checked` 字段与 `Item.status === 'done'` **必须**保持一致（写入时由 Repository 同步设置）。`dueDate` 是紧急度计算的输入之一。

#### Scenario: 列出某计划下所有事项

- **GIVEN** Plan `p_abc` 下有 8 条 Item
- **WHEN** 调用 `itemRepo.listByPlan('p_abc')`
- **THEN** 返回 8 条 Item，**按 `order` 升序排序**（通过复合索引 `[planId+order]`）

#### Scenario: 切换事项勾选状态

- **GIVEN** Item `i_001` 当前 `checked = false`, `status = 'todo'`
- **WHEN** 调用 `itemRepo.toggle('i_001')`
- **THEN** 该 Item 的 `checked` 变为 `true`，`status` 变为 `'done'`，`completedAt` 填入当前时间
- **AND** **同步**调用 `planRepo.recomputeProgress('p_abc')`，其所属 Plan 的 `progress` 重算并缓存
- **AND** 再次调用 `itemRepo.toggle('i_001')` 恢复 `checked = false`（toggle 语义）

#### Scenario: 拖拽排序

- **GIVEN** Plan `p_abc` 下有 Item 序列 `[i_1, i_2, i_3, i_4]`
- **WHEN** 用户拖拽后调用 `itemRepo.reorder('p_abc', ['i_3', i_1, 'i_2', 'i_4'])`
- **THEN** 4 条 Item 的 `order` 字段分别更新为 `0, 1, 2, 3`（按传入数组的索引）

#### Scenario: 创建事项

- **GIVEN** Plan `p_abc` 已存在
- **WHEN** 调用 `itemRepo.create('p_abc', { title: '完成 PRD', dueDate: '2026-07-25' })`
- **THEN** 新 Item 插入 `items` 表，`planId` 自动填入 `'p_abc'`，`order` 自动设为该 Plan 下当前最大值 + 1
- **AND** 返回的 Item 包含 `id` / `createdAt` / `updatedAt`

---

### Requirement: Blog 数据模型

系统 MUST 持久化 `Blog` 实体，承载富文本内容（`content` 字段为 Tiptap JSON）+ 纯文本镜像（`contentText`，供未来全文检索用）。

`Blog.status` 状态机：`draft` → `published`（设置 `publishedAt`）→ `archived`。`source` 标记博客来源：`direct` / `plan` / `upload`。

#### Scenario: 创建博客（直接创作）

- **GIVEN** 用户在编辑器中输入标题与富文本内容
- **WHEN** 调用 `blogRepo.create({ title, content: TiptapJSON, contentText: '...', status: 'draft', source: 'direct', ... })`
- **THEN** Blog 写入 `blogs` 表，`id` 为 ULID，`contentText` 字段由调用方提供（编辑器侧用 `editor.getText()` 提取）
- **AND** `publishedAt` 在 `status === 'published'` 之前为 `undefined`

#### Scenario: 发布博客

- **GIVEN** Blog `b_001` 当前 `status = 'draft'`
- **WHEN** 调用 `blogRepo.update('b_001', { status: 'published' })`
- **THEN** `status` 变为 `'published'`，`publishedAt` **自动**填入当前时间（Repository 内部在 `status` 字段变更时设置）
- **AND** `updatedAt` 同步刷新

#### Scenario: 归档博客

- **GIVEN** Blog `b_001` 当前 `status = 'published'`
- **WHEN** 调用 `blogRepo.archive('b_001')`
- **THEN** `status` 变为 `'archived'`，其他字段不变
- **AND** 等价于 `blogRepo.update('b_001', { status: 'archived' })`，但语义更明确

#### Scenario: 复制博客

- **GIVEN** Blog `b_001` 已存在
- **WHEN** 调用 `blogRepo.duplicate('b_001')`
- **THEN** 创建新 Blog `b_new`，其字段从 `b_001` 复制，但：`id` 重新生成，`title` 加 `(副本)` 后缀，`status = 'draft'`，`sourcePlanId` / `frameworkId` / `attachmentIds` 全部置空（**不**复制附件 Blob），`createdAt` / `updatedAt` 重置
- **AND** 旧 Blog `b_001` 不变

#### Scenario: 全文搜索（v1.0 接口预留）

- **GIVEN** `blogs` 表中存在 N 条记录，其中 `contentText` 包含关键词
- **WHEN** 调用 `blogRepo.search('项目复盘')`
- **THEN** 返回 `title` 或 `contentText` 包含 `项目复盘`（子串匹配，**不**做中文分词）的 Blog 列表
- **NOTE**：v1.0 仅基础 `String.prototype.includes` 匹配；v1.1 替换为 MiniSearch 倒排索引

---

### Requirement: Framework 内置数据

系统 MUST 预置 4 套博客框架模板（项目复盘 / 21 天习惯复盘 / 读书笔记 / 月度总结），通过 `src/db/seed.ts` 在首次启动时**幂等**写入 `frameworks` 表。

`Framework` 的 `sections: FrameworkSection[]` 描述章节结构（heading / guide / placeholder），**结构化数据**而非 Markdown 文本，便于 Tiptap Extension 直接消费。

`Framework` 的 `category` 枚举值：`'review' | 'note' | 'summary' | 'habit'`，与 PRD §7.6 抽屉分类对应。

#### Scenario: 首次启动种子写入

- **GIVEN** `frameworks` 表为空，且 `meta` 表无 `seeded: true` 标记
- **WHEN** 应用启动，调用 `seedIfNeeded()`
- **THEN** `frameworks` 表插入 4 条记录，**`builtin = true`**，`id` 固定为 `'fw_review'` / `'fw_habit'` / `'fw_note'` / `'fw_summary'`
- **AND** `meta` 表写入 `{ key: 'seeded', value: true }`

#### Scenario: 二次启动幂等

- **GIVEN** `meta` 表已存在 `seeded: true` 记录
- **WHEN** 再次启动调用 `seedIfNeeded()`
- **THEN** **不**写入任何 Framework（跳过）；不抛错

#### Scenario: 列出所有框架

- **GIVEN** `frameworks` 表有 4 条记录
- **WHEN** 调用 `frameworkRepo.list()`
- **THEN** 返回 4 条 `Framework`，按 `category` 分组顺序：`review` → `habit` → `note` → `summary`

#### Scenario: 应用框架生成博客草稿

- **GIVEN** 框架 `'fw_review'` 存在
- **WHEN** 调用 `frameworkRepo.apply('fw_review', 'p_abc')`（可选传入 sourcePlanId）
- **THEN** 返回一段 **Tiptap JSON 文档**，按 `sections` 顺序生成 H1/H2 标题 + 引导问题 paragraph
- **AND** 若传入 `sourcePlanId`，将 Plan 的 `title` / `description` / `progress` / `completedItems.length` 等字段注入到文档首部（**纯文本替换占位符**）
- **AND** `frameworks` 表中该框架的 `useCount` 字段**自动** +1（同一事务内）

#### Scenario: 用户不可创建/修改/删除框架

- **GIVEN** `frameworkRepo` 接口定义
- **THEN** 接口**不**暴露 `create` / `update` / `delete` 方法（v1.0 限制内置）
- **AND** 若代码中误调 `frameworkRepo.create(...)`，TypeScript 编译期就报错

---

### Requirement: Tag 多对多关联

系统 MUST 支持 Tag 实体，并通过 `*tagIds` 多值索引实现 `Plan` / `Blog` ↔ `Tag` 的 N—M 关联。

`Tag` 的 `name` 字段**必须**唯一（`&name` 索引），重复创建抛 `AppError({ code: 'CONFLICT' })`。

#### Scenario: 创建标签

- **GIVEN** Tag 表中无 `name = '技术'` 的标签
- **WHEN** 调用 `tagRepo.create({ name: '技术', color: '#3B82F6' })`
- **THEN** 新 Tag 写入，`id` 自动生成，`usageCount` 默认为 `0`，`createdAt` 自动填充

#### Scenario: 创建同名标签（重复）

- **GIVEN** Tag 表中存在 `name = '技术'` 的标签
- **WHEN** 再次调用 `tagRepo.create({ name: '技术', color: '#FF0000' })`
- **THEN** 抛出 `AppError({ code: 'CONFLICT', message: 'Tag name already exists' })`

#### Scenario: 删除标签

- **GIVEN** Tag `t_tech` 存在，且被 Plan `p_001` / Blog `b_001` 引用（`tagIds` 包含 `'t_tech'`）
- **WHEN** 调用 `tagRepo.delete('t_tech')`
- **THEN** Tag `t_tech` 被删除
- **AND** `p_001.tagIds` 与 `b_001.tagIds` 中**自动**移除 `'t_tech'`（Repository 在事务内维护一致性）
- **AND** 调用 `recomputeUsageCount('t_tech')` 不需要（删除时直接归零即可，引用方已移除）

#### Scenario: 引用计数

- **GIVEN** Tag `t_tech` 当前 `usageCount = 5`（5 个 Plan/Blog 引用）
- **WHEN** 创建新 Plan 并将其加入 `tagIds = ['t_tech']`
- **THEN** 写入 Plan 的事务内，**同步**将 `t_tech.usageCount` 更新为 `6`
- **AND** 删除引用方 Plan 时，`usageCount` 同步 -1

---

### Requirement: Repository 抽象

所有数据访问 MUST 通过 `xxxRepo.method()` 接口。组件、Store、其他模块**禁止**直接 `import { db } from 'src/db'` 或调用 Dexie Table API。

Repository 类**必须**接受 Dexie 实例作为构造函数参数（**依赖注入**），以便测试时用 `fake-indexeddb` 注入临时实例；默认导出**工厂函数**（如 `createPlanRepo(db = defaultDb)`）以便生产代码用零参数调用。

#### Scenario: 组件不直接调 Dexie

- **GIVEN** 任意 React 组件（如 `PlanCard.tsx`）需要查询计划列表
- **THEN** 组件**只能**通过 `usePlanStore` 订阅（store 已封装 repo 调用）
- **AND** ESLint 规则 `no-restricted-imports` 禁止在 `src/features/**` / `src/pages/**` 直接 `import 'src/db'`（该规则在本 change 不实现，但 design.md 给出推荐配置；实现阶段由 tasks.md 提示）

#### Scenario: 测试时可注入 fake db

- **GIVEN** 测试代码创建 `new Dexie('test')`（配合 fake-indexeddb/dexie）
- **WHEN** 调用 `createPlanRepo(testDb)` 构造 Repository
- **THEN** 后续 `planRepo.create(...)` 等方法操作的是 `testDb` 中的表，**不**污染生产 `planote` 库

#### Scenario: 错误处理统一为 AppError

- **GIVEN** Repository 任意方法遇到错误（NOT_FOUND / VALIDATION / STORAGE_FULL / CONFLICT / UNKNOWN）
- **WHEN** 方法抛出
- **THEN** 抛出的对象**必须**是 `AppError` 联合类型，结构 `{ code, message, ...optional }`
- **AND** 不得抛出原生 `Error` 或字符串

---

### Requirement: 紧急度派生计算

`Plan.urgency` 字段 MUST 根据 `endDate` 与当前时间计算（公式见 `shared/utils/urgency.ts`），并在以下时机刷新：

- `planRepo.create` 写入时
- `planRepo.update` 修改 `endDate` / `status` 时
- `itemRepo.toggle` 触发 `recomputeProgress` 时（虽然 urgency 与 progress 独立，但同一事务内一起刷）

#### Scenario: 今天截止 → 红色

- **GIVEN** Plan `endDate = '2026-07-19'`（今天）
- **AND** `status` 不是 `'done'` / `'paused'`
- **WHEN** 计算 `urgency`
- **THEN** 返回 `'red'`

#### Scenario: 1-3 天 → 橙色

- **GIVEN** Plan `endDate` 为 1-3 天后
- **WHEN** 计算 `urgency`
- **THEN** 返回 `'orange'`

#### Scenario: 4-7 天 → 黄色

- **GIVEN** Plan `endDate` 为 4-7 天后
- **WHEN** 计算 `urgency`
- **THEN** 返回 `'yellow'`

#### Scenario: 7 天后 / 持续 / 已完成 → 无

- **GIVEN** Plan `endDate` 超过 7 天后 **OR** Plan 无 `endDate` **OR** `status === 'done' / 'paused'`
- **WHEN** 计算 `urgency`
- **THEN** 返回 `'none'`

---

### Requirement: 进度派生计算

`Plan.progress` 字段 MUST 为 0-100 整数，公式：`floor(checkedCount / totalCount * 100)`。

`totalCount === 0` 时 `progress = 0`（不抛错，避免新建空计划崩溃）。

#### Scenario: 全部勾选 → 100

- **GIVEN** Plan `p_001` 下 8 条 Item 全部 `checked = true`
- **WHEN** 调用 `planRepo.recomputeProgress('p_001')`
- **THEN** `p_001.progress = 100`

#### Scenario: 部分勾选

- **GIVEN** Plan `p_001` 下 8 条 Item 中 5 条 `checked = true`
- **WHEN** 调用 `planRepo.recomputeProgress('p_001')`
- **THEN** `p_001.progress = 62`（`floor(5/8*100) = 62`）

#### Scenario: 空计划

- **GIVEN** Plan `p_001` 下 0 条 Item
- **WHEN** 调用 `planRepo.recomputeProgress('p_001')`
- **THEN** `p_001.progress = 0`（不抛错）

---

