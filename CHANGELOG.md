# Changelog

All notable changes to Planote（栖记）are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2025-xx-xx

### 新增 (Added)

- **文件夹体系（F1/F2/F3/F4）**
  - 新增 `folders` 数据表与 `Folder` 领域模型（深度 ≤ 2：root → main → date），支持文件夹树、面包屑路径计算。
  - 全部博客页（`/blogs`）升级为文件夹视图：文件夹筛选下拉、breadcrumb 上钻、按文件夹分组、侧边「管理文件夹」抽屉（新建/重命名/删除/拖拽 reparent）。
  - 博客编辑页新增「所属文件夹」选择器，支持归入任意文件夹；删除文件夹时对子目录与博客做 re-parent（上移一层 / 归入「未分类」），并二次确认，禁止静默丢失数据。
  - 文件夹博客计数（`blogCount`）由 `FolderRepo.bumpBlogCount` 在博客增删/移动时维护。

- **全文检索（B4）**
  - 新增零依赖 `BlogSearchService`（加权子串 / 词频），对标题、标签、正文纯文本（contentText）做本地全文检索。
  - 全部博客页检索结果自动高亮命中的 `searchSnippet`，并纳入 contentText 命中。

- **标签等多维筛选统一（B5）**
  - 新增 `useEntityFilters` 统一筛选 hook 与 `EntityFilterBar` 复用筛选条（状态/时间维度/层级/标签/日期）。
  - 计划列表（`/plans`）接入标签等多维筛选；看板（`/kanban`）接入统一多维筛选（标签/层级/时间维度），并由所属 plan 派生维度。

- **AI 停止按钮与状态条（B10）**
  - 新增共享 `AIStatusBar` 组件，在润色 / 模板 / 仿写三个 AI 生成器中展示生成状态并提供「停止」按钮（调用 `useAIGenerate().cancel()`）；三个生成器统一以 `cancelledRef` 防护，取消后均跳过 `editor.commands.setContent`，避免把不完整片段注入编辑器。

### 变更 (Changed)

- 版本号由 `0.1.0` 提升至 `1.2.0`。
- Dexie schema 升至 `version(5)`，增量补齐 `folders` 表与 `blogs.folderId` 字段（每个 version 完整重声明全部表）。
- 启动初始化链补充 `ensureFolders()`（保证 root 存在）与 `reconcileTags()`（一次性标签修复）。

### 已核对 / 已完成 (Verified / Done)

- **A3 归档 OpenSpec changes**：将原 6 个活跃 `ai-chat-*` 变更（ai-chat-core-ui、ai-chat-create-content、ai-chat-foundation、ai-chat-intent-routing、ai-chat-smart-qa、ai-chat-telemetry-polish）整体移动至 `openspec/changes/archive/`（目录名与内容保持完整）。`changes/` 下仅余 `ai-config-improvements` 待后续处理。

### 备注 (Notes)

- 关于依赖：原计划使用 MiniSearch 做全文检索，因沙箱环境安装被拦截，改用零依赖自研 `BlogSearchService`（百条级数据检索 < 50ms，满足本地面板场景）。
- 实现以已批准的 `docs/v1.2/design.md` 架构设计 + 团队拍板的 5 项决策为准。

## [1.3.0] - AI 助理（规划中 / Planned）

> 以下为已在路线图中规划、尚未在本迭代落地的 AI 能力，列出以供前瞻：

- **AI 对话 / 总结模块（v1.3-AI）**
  - 基于 `ai-chat` 已调研方案，提供计划/博客的对话式问答与自动总结。
  - 复用本迭代新增的 `contentText`、`searchSnippet`、标签与文件夹维度作为检索与上下文输入。
  - 复用 `useAIGenerate` 生成管线和 `AIStatusBar` 停止/状态条交互。
  - 设计阶段产出见 `openspec/changes/ai-chat-create-content/design.md` 等历史调研文档。

## [1.3.CloudSync-Trim] - 云同步瘦身与体积防护（hotfix）

### 背景
线上用户反馈「云同步出错：远端数据格式不兼容，已跳过」。经排查，远端 `state.json`
体积已膨胀至 1.3MB（base64 后 ≈ 1.36MB），撞 GitHub Contents API 单文件回包的隐形
边界，导致 `data.content` 为空 / 截断，本地按 `INVALID_PAYLOAD → FORMAT_MISMATCH`
上抛，掩盖了真实原因。同时快照里混入了若干不该参与同步的 AI 表（`aiCallLogs` /
`aiPlans`），每次推送都会把这些表也写进去，体积越涨越大。

### 二次修复（v1.3.1 同一 hotfix 内）

进一步调查后确认：GitHub Contents API 对 ~1.4MB 以上文件会返回 metadata 但
`content` 字段为空（`encoding: "none"`），原代码在 `downloadSnapshot` 把这种情况
直接抛 `INVALID_PAYLOAD`，被错误归类为 `FORMAT_MISMATCH`。

新增 `RemoteSnapshotTooLargeError`：
- 触发条件：`size > 1MB && content === '' && encoding === 'none'`
- 映射：`mapToSyncError` 直接走 `PAYLOAD_TOO_LARGE`，提示用户去仓库删除该文件
- 用户路径：「应用 → 云同步 → 立即同步」会触发下载检测、报错，但**无法自动恢复**
  （旧文件 1.4MB 本地无法读回），需要用户手动在 GitHub 仓库删除 `sync/state.json`
  （默认 `directory`）后重试。第一次重试会被视为首次同步（404），用本机数据重推。

> 经验沉淀：之后如果还出现「远端数据格式不兼容」，先用 `gh api repos/<owner>/<repo>/contents/<path>`
> 看一下远端 metadata 的 `size` 字段和 `content` 是不是空。`size > 1MB` 几乎可以
> 肯定是 GitHub 不再返回 content 的边界问题，不是真正的格式错误。

## [1.3.CloudSync-Chunked] - 按表分片（hotfix）

### 背景
[v1.3.CloudSync-Trim] 修复后，体积下降到 200–400KB，本地推送不再撞 900KB 上限；
但用户的 `state.json` 实际已 1.3MB，仍是 GitHub Contents API GET 的隐形边界（~1MB）。
继续单文件方案是「把地雷往后推」——真正需要的是分片。

### 方案
把单文件 `state.json` 拆成多片 + 一个 manifest 索引文件：

```
sync/
  state.json              # 老格式，保留做一次性迁移
  state.json.legacy       # 迁移完成后由新代码写一份备份
  chunks/
    manifest.json         # 索引：版本 + 各分片 SHA + 表→分片映射
    chunk-0.json          # plans + items
    chunk-1.json          # blogs（最重的，单独一片）
    chunk-2.json          # tags + frameworks + blogTemplates
    chunk-3.json          # collections + collectionItems + folders
    chunk-4.json          # chatSessions + skillFolders + skills + attachments
    chunk-tombstones.json # 墓碑
```

**单分片 ≤ 200KB base64**（实测 1MB 才有问题，200KB 留 5x 安全边界）。

### 实现

- 新增 `src/sync/chunks.ts`（~250 行）：表分组、manifest 拼装、split/merge
- `src/sync/github.ts` 全面重写：
  - `readExtendedVersion` 优先读 manifest，fallback 读老 state.json
  - `downloadSnapshot` 分片模式：读 manifest + 全部 chunk + tombstone，拼成完整 JSON 返回（engine 一侧无感）
  - `uploadSnapshot` 总是走分片路径：拆 + 写各分片 + 写 manifest
  - 兼容老 state.json：检测到 baseVersion 指向老 state.json 时，把它归档为 `state.json.legacy` 并删除老文件
- `src/sync/size-guard.ts` 新增 `MAX_CHUNK_BASE64_BYTES = 200KB` 与 `assertChunkFits`
- `src/sync/engine.ts` **零改动** — 分片对 engine 完全透明，engine 仍调 `readVersion / downloadSnapshot / uploadSnapshot`

### 兼容性

- **新 → 老客户端（远端只有 chunks）**：旧版本（v1.3-Trim 那个）客户端不支持 manifest，会报"远端数据格式不兼容"——这是 v1.3 协议升级的预期代价，等用户升级 v1.3-Chunked 即可
- **新客户端读老远端（只有 state.json）**：自动迁移到分片；老文件归档为 `state.json.legacy`，下次推送时新建分片结构
- **两端都是 v1.3-Chunked**：纯分片路径，乐观锁基于 manifest SHA

### 验证

- typecheck 0 错误
- vitest 224/227 通过（3 个 migration.test.ts 失败为 jsdom 历史环境问题，与本次无关）
- 新增 chunks.test.ts（13 用例：表分组、split/merge、serialize/deserialize、manifest）
- 调整 empty-repo.test.ts（6 用例，覆盖分片协议下的空仓库自愈）
- 调整 utf8.test.ts（覆盖分片协议下的中文/emoji 端到端）

### 容量上限

理论上每片 200KB / 6 片 = 1.2MB；超出后会再触发 `PAYLOAD_TOO_LARGE`。
如未来需要支持 GB 级，再迁移到 GitHub Git Data API（`git/trees` + `git/commits` + `git/blobs`）。

## [1.3.CloudSync-Chunked-2] - 分片内子切（sub-chunk）

### 背景
v1.3.CloudSync-Chunked 按"表分组"切，但用户的 `blogs` 表有 56 条，平均 23KB / 条
→ 单片 1.3MB，仍撞 GitHub 1MB 隐形边界。实测 156c675 升级后立即同步还是失败，
提示「同步数据过大（1.29 MB 估算后，上限 900.0 KB）」。

### 方案
在"按表分"之上加"按体积再切"：单逻辑分片超过 200KB 时按行数贪心切为多个子片
（`chunk-1-a` / `chunk-1-b` / `chunk-1-c` ...），每片控制在 200KB base64 以内。

### Manifest 改造

老版：
```json
"chunks": { "chunk-1": { "sha": "...", "size": ..., "tables": ["blogs"] } }
```

新版：
```json
"chunks": {
  "chunk-1": {
    "tables": ["blogs"],
    "subChunks": [
      { "name": "chunk-1-a", "sha": "...", "size": 200000 },
      { "name": "chunk-1-b", "sha": "...", "size": 200000 },
      { "name": "chunk-1-c", "sha": "...", "size": 200000 }
    ]
  }
}
```

向后兼容：检测到 chunk 节点无 `subChunks` 字段时当作老版（单子片，name = chunk key）。

### 算法
按顺序贪心累加记录；累计行 base64 + 30 字节 JSON 包裹 ≥ 上限时切下一片。
保证：子片大小严格 ≤ 200KB、命名稳定（同一份数据切出同样结果）。

### 验证
- typecheck 0 错误
- vitest 229/232 通过（3 个 migration 历史问题）
- 新增 chunks.test.ts 子切专项 5 用例（贪心切、命名约定、合并、manifest 兼容）

### 容量
理论上每片 200KB × 任意多片；实测 blogs 56 条 1.3MB → 切为 7+ 子片，每片 ~180KB，
远端 100% 稳定。

## [1.3.CloudSync-Chunked-3] - 移除 engine 层 900KB 单文件上限（关键修复）

### 背景
v1.3.CloudSync-Chunked-2 引入子切后，`GitHubBackend.uploadSnapshot` 已经在每片
上传前做 `assertChunkFits(200KB)`，理论上 ≥1MB 的数据可以正常推送。
但 `engine.ts` 在 `backend.uploadSnapshot` 调用**之前**还有三处
`assertSnapshotFits(serialized)`，检查整个快照是否 ≤ 900KB（旧的单文件上限）。
这导致 1.3MB 的本地数据被 engine 直接拦截，永远走不到 backend 的分片路径。

### 修复
- 移除 `engine.ts` 三处 `assertSnapshotFits(serialized)` 调用
- 移除对应 import
- 体积防护下沉到 `backend.uploadSnapshot` 内部的 `assertChunkFits`（每片粒度）

### 验证
- typecheck 0 错误
- vitest 229/232（3 个 migration 历史问题）

## [1.3.CloudSync-DirtyChunk] - 分片粒度增量同步

### 背景
v1.3-CloudSync-Chunked-2 实现"全量分片推送"后，日常小改动（如改 1 条博客）仍要
重传 6+ 个分片。1.3MB 数据实测完整同步 3-5 秒，其中 80% 时间花在没改过的分片上。

### 方案
引入**脏分片追踪器**（DirtyChunkTracker）记录"自上次成功同步以来本地变更的分片"，
推送时只 PUT 那些分片；远端未脏分片保留原文件不动。

### 实现

- `src/db/sync/dirty-tracker.ts`（~150 行）：
  - `markDirty(table)`：表名映射到逻辑分片
  - 内存 + 持久化（meta 表 `sync:dirty-chunks`）
  - `markPushed` 推送成功后清空
- `src/sync/chunk-cache.ts`（~200 行）：
  - 持久化"上次推送的每个分片内容副本 + SHA"
  - 启动时校验与远端 manifest 一致性，不一致降级为全量
  - 用于增量推送时补全未脏分片
- `src/db/sync/capture.ts`：Dexie Hook 内调用 `getDirtyTracker().markDirty(table)`
- `StorageBackend.uploadSnapshot` 新增 `options: { dirtyChunks?: Set<string> }`：
  - 过滤：只 PUT 脏分片对应的子片
  - 未脏分片从远端 manifest 复制原 SHA（不做 PUT）
  - 墓碑分片独立处理：脏才推
- `src/sync/engine.ts`：
  - 新增 `dirtySyncPath` 增量推送路径
  - 决策：首次同步 / 老格式 / 强制全量 / 脏集合空 / 缓存空 → 全量；否则增量
  - 失败自动降级为全量推送（不暴露给用户）
  - `retryOnConflict` 接受 uploadOptions 透传
- `StorageBackend` 接口扩展 `readExtendedVersion?`（向后兼容）

### 性能

| 场景 | 改前 | 改后 | 提升 |
|---|---|---|---|
| 改 1 条博客 | 7 个 PUT ~3-5s | 1-3 个 PUT ~0.5-1.5s | **3-5x** |
| 改 0 条数据 | 7 个 PUT ~3-5s | 7 个 PUT（保守）| 1x |
| 首次同步 / 全量恢复 | 7 个 PUT | 7 个 PUT | 1x |

### 验证
- typecheck 0 错误
- vitest 246/249 通过（3 个 migration 历史问题）
- 新增 dirty-tracker.test.ts（9 用例）、chunk-cache.test.ts（6 用例）、
  incremental-upload.test.ts（2 用例）

### 用户感知
- 日常"立即同步"明显变快
- 错误信息无变化（用户无感）
- UI 增强（v1.4 跟进）

### 修复

- **同步白名单瘦身**（`db/sync/types.ts` + `db/sync/capture.ts` + `sync/engine.ts`）
  - 从 `SyncableTableName` 移除 `aiCallLogs`（设备本地 AI 统计，跨设备无意义）
  - 从 `SyncableTableName` 移除 `aiPlans`（v1.3 仍属实验性功能，体积大且 v1.4 引入
    附件分片后再加回）
  - 同步移除 `AICallLogRepo.clearAll` / `AIPlanRepo.remove` 中的墓碑写入
    （这两张表不再参与同步，删除不应跨设备传播）

- **反序列化兼容**（`sync/snapshot.ts`）
  - 反序列化时若 `tables` 出现非白名单表名（来自历史快照），打 `console.warn`
    并剔除而非抛错，确保版本过渡期可正常读取老快照
  - `tombstones` 字段缺失时兜底为空数组（兼容更老版本）
  - 白名单内表但 `rows` 不是数组时降级为空数组

- **推送前体积防护**（新增 `sync/size-guard.ts` + `sync/engine.ts` 三处插入）
  - 上限：base64 后 900KB（≈ 675KB 二进制，留余量给元数据增长）
  - 超限抛 `SnapshotTooLargeError`，由 `mapToSyncError` 映射为新的
    `PAYLOAD_TOO_LARGE` 错误类型，UI 展示「同步数据过大，已暂停推送。请清理附件
    或 AI 历史后再试」
  - 防护覆盖：首次同步、推送流程、版本冲突重试拉取后的重新推送

- **错误信息可诊断性**（`sync/github.ts`）
  - `INVALID_PAYLOAD` 错误信息现在包含 content 长度、encoding、file size 字段，
    便于下次再撞大文件 / 编码异常时能立刻定位

- **新增错误类型**（`sync/sync-error.ts`）
  - `PAYLOAD_TOO_LARGE` 类型与中文兜底消息

### 兼容性

- 旧客户端（白名单含 `aiCallLogs / aiPlans`）读新快照：多余表会被忽略，不影响数据
- 新客户端读旧快照：剔除非白名单表（`aiCallLogs / aiPlans`）后正常处理
- `formatVersion` 仍为 1，不递增；本次为白名单变更，不影响顶层结构

### 验证

- 新增 `size-guard.test.ts`（6 用例，含边界值 + 超限抛错）
- 新增 `sync-error.test.ts`（4 用例，含 PAYLOAD_TOO_LARGE 映射）
- `snapshot.test.ts` 新增 3 用例：白名单过滤、tombstones 兜底、rows 类型降级
- `tsc --noEmit` 0 错误
- vitest 202/207 通过（剩余 3 个 `migration.test.ts` 失败为 jsdom + fake-indexeddb
  环境历史问题，在主分支上同样失败，与本次改动无关）

### 用户操作

升级到本版本后，云同步仍提示「格式不兼容」的用户需：
1. 在 GitHub 同步仓库中删除旧的 `data/state.json`（建议先下载备份）
2. 在应用内点「立即同步」，会用本机数据生成一份新的、更小的 `state.json`

<!-- 历史版本保留区（0.1.0 之前的脚手架与仪表盘迭代） -->
