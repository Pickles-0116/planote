/**
 * Repository 抽象层
 *
 * 6 个 Repository interface + `QueryOptions` + `AppError` 联合类型 + `AppError` class。
 * 接口签名与 `architecture.md` §4.1 逐字一致。
 *
 * 调用约定：
 * - Repository 方法抛错时**必须**使用 `new AppError({ code, message, ... })`
 * - 错误 `code` 用于 UI 层 switch on（toast / 错误页）
 */

import type {
  ID,
  ISODate,
  Plan,
  Item,
  Blog,
  Framework,
  Tag,
  Attachment,
  TiptapJSON,
  PlanLevel,
  PlanTimeDim,
  PlanStatus,
  ItemStatus,
  BlogStatus,
  BlogSource,
  FrameworkCategory,
  UrgencyLevel,
  BlogTemplate,
  AICallLog,
  AIGenerateMode,
  TemplateCategory,
  AIStyleParams,
  Collection,
  CollectionItem,
  CollectionEntityType,
  Folder,
  FolderType,
} from '@/types/domain';

// ========== 错误类型 ==========

/** 应用层统一错误联合类型。 */
export type AppErrorPayload =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION'; message: string; fields?: Record<string, string> }
  | { code: 'STORAGE_FULL'; message: string; quota?: number }
  | { code: 'CONFLICT'; message: string }
  | { code: 'PERMISSION'; message: string }
  | { code: 'UNKNOWN'; message: string; cause?: unknown };

/** 应用层错误（可 throw / catch，UI 层 switch on `code`）。 */
export class AppError extends Error {
  /** 错误结构化描述。 */
  public readonly error: AppErrorPayload;

  constructor(error: AppErrorPayload) {
    super(error.message);
    this.name = 'AppError';
    this.error = error;
    // 保留原型链
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ========== 通用查询参数 ==========

/** 查询条件值：字段匹配值或 MongoDB 风格操作符。 */
export type FilterValue =
  | string
  | number
  | boolean
  | ISODate
  | null
  | { $in?: unknown[] }
  | { $ne?: unknown }
  | { $gt?: number; $lt?: number; $gte?: number; $lte?: number };

/** 查询条件：`Record<字段, 值或操作符>`。 */
export type QueryFilter = Record<string, FilterValue>;

/** 排序方向。 */
export type SortOrder = 'asc' | 'desc';

/** 排序项。 */
export interface QuerySort<T> {
  field: keyof T;
  order: SortOrder;
}

/** 通用查询参数。 */
export interface QueryOptions<T = unknown> {
  filter?: QueryFilter;
  sort?: QuerySort<T>[];
  pagination?: { offset: number; limit: number };
}

// ========== Plan Repository ==========

/** Plan 创建入参：去掉 id / 自动派生 / 时间戳。 */
export type PlanCreateInput = Omit<
  Plan,
  'id' | 'progress' | 'urgency' | 'createdAt' | 'updatedAt' | 'completedAt'
>;

/** Plan 更新入参：任意字段可空。 */
export type PlanUpdatePatch = Partial<Plan>;

/** 计划数据访问接口。 */
export interface PlanRepository {
  list(opts?: QueryOptions<Plan>): Promise<Plan[]>;
  get(id: ID): Promise<Plan | undefined>;
  create(input: PlanCreateInput): Promise<Plan>;
  update(id: ID, patch: PlanUpdatePatch): Promise<Plan>;
  delete(id: ID): Promise<void>;
  bulkUpdate(ids: ID[], patch: PlanUpdatePatch): Promise<Plan[]>;
  /**
   * 重算 plan.progress（基于 item.checked 比例）+ 顺带刷新 urgency 缓存。
   * 返回新的 progress 值（0-100）。
   */
  recomputeProgress(planId: ID): Promise<number>;
}

// ========== Item Repository ==========

/** Item 创建入参：去掉 id / planId / 时间戳。 */
export type ItemCreateInput = Omit<
  Item,
  'id' | 'planId' | 'createdAt' | 'updatedAt' | 'completedAt'
>;

/** 事项数据访问接口。 */
export interface ItemRepository {
  listByPlan(planId: ID): Promise<Item[]>;
  /**
   * 列出全部事项（add-kanban-board 增量）。
   * 用于跨计划场景（看板 / 全局搜索）。默认按 createdAt desc。
   */
  list(): Promise<Item[]>;
  /** 切换 checked + status + completedAt，并同步触发 plan.progress 重算。 */
  toggle(id: ID): Promise<Item>;
  /**
   * 设置事项状态（add-plan-detail-view 增量）：
   * - 'todo'  → checked=false, status='todo', completedAt=undefined
   * - 'doing' → checked=false, status='doing', completedAt=undefined
   * - 'done'  → checked=true,  status='done',  completedAt=now
   * 同时触发 planRepo.recomputeProgress（doing/todo → done 影响 progress）。
   */
  setStatus(id: ID, status: ItemStatus): Promise<Item>;
  create(planId: ID, input: ItemCreateInput): Promise<Item>;
  /** 拖拽后批量回写 order 字段（数组下标 = 新 order）。 */
  reorder(planId: ID, orderedIds: ID[]): Promise<void>;
  delete(id: ID): Promise<void>;
}

// ========== Blog Repository ==========

/** Blog 创建入参：去掉 id / 时间戳 / contentText（由调用方从 editor 提取）。 */
export type BlogCreateInput = Omit<
  Blog,
  'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'contentText'
> & {
  /** 纯文本镜像（必填，由调用方从 Tiptap editor.getText() 提取）。 */
  contentText: string;
};

/** 博客数据访问接口。 */
export interface BlogRepository {
  list(opts?: QueryOptions<Blog>): Promise<Blog[]>;
  get(id: ID): Promise<Blog | undefined>;
  /**
   * 按 ID 列表批量拉取（add-plan-detail-view 增量）。
   * 内部 dexie.bulkGet 自动跳过不存在的 ID；返回数组保持输入顺序。
   */
  listByIds(ids: ID[]): Promise<Blog[]>;
  create(input: BlogCreateInput): Promise<Blog>;
  update(id: ID, patch: Partial<Blog>): Promise<Blog>;
  delete(id: ID): Promise<void>;
  /** 复制博客：title 加 `(副本)`，status 置 draft，sourcePlanId / frameworkId / attachmentIds 清空。 */
  duplicate(id: ID): Promise<Blog>;
  archive(id: ID): Promise<Blog>;
  /** 子串匹配 title 或 contentText（不区分大小写）。 */
  search(q: string): Promise<Blog[]>;
}

// ========== Framework Repository ==========

/** 框架数据访问接口（v1.0 只读 + apply + incrementUseCount）。 */
export interface FrameworkRepository {
  list(): Promise<Framework[]>;
  get(id: ID): Promise<Framework | undefined>;
  /**
   * 应用框架生成 Tiptap JSON 文档。
   * 传入 `planId` 时把 plan 字段注入占位符；同事务内 useCount +1。
   */
  apply(frameworkId: ID, planId?: ID): Promise<TiptapJSON>;
  incrementUseCount(frameworkId: ID): Promise<void>;
}

// ========== Tag Repository ==========

/** Tag 创建入参：去掉 id / usageCount / createdAt。 */
export type TagCreateInput = Omit<Tag, 'id' | 'usageCount' | 'createdAt'>;

/** Tag 更新入参。 */
export type TagUpdatePatch = Partial<Pick<Tag, 'name' | 'color'>>;

/** 标签数据访问接口。 */
export interface TagRepository {
  /** 按 usageCount 降序。 */
  list(): Promise<Tag[]>;
  create(input: TagCreateInput): Promise<Tag>;
  /** 更新标签（名称/颜色）。 */
  update(id: ID, patch: TagUpdatePatch): Promise<Tag>;
  /** 删除时级联从所有 Plan / Blog 的 tagIds 中移除。 */
  delete(id: ID): Promise<void>;
  getByName(name: string): Promise<Tag | undefined>;
}

// ========== Attachment Repository ==========

/** 附件数据访问接口。 */
export interface AttachmentRepository {
  /** 按 uploadedAt 升序。 */
  listByBlog(blogId: ID): Promise<Attachment[]>;
  /** 从 File 构造 Attachment 记录并存入 blob。 */
  upload(blogId: ID, file: File): Promise<Attachment>;
  /** 仅删附件记录，不动 blog.attachmentIds（由 BlogRepo 维护）。 */
  delete(id: ID): Promise<void>;
  getBlob(id: ID): Promise<Blob>;
  /**
   * 返回 object URL（`URL.createObjectURL(blob)`）。
   * **调用方需配对 `URL.revokeObjectURL`** 否则泄漏。
   */
  getObjectURL(id: ID): Promise<string>;
}

// ========== BlogTemplate Repository ==========

/** BlogTemplate 创建入参。 */
export type BlogTemplateCreateInput = Omit<
  BlogTemplate,
  'id' | 'useCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'
>;

/** 博客模板数据访问接口。 */
export interface BlogTemplateRepository {
  list(opts?: QueryOptions<BlogTemplate>): Promise<BlogTemplate[]>;
  get(id: ID): Promise<BlogTemplate | undefined>;
  create(input: BlogTemplateCreateInput): Promise<BlogTemplate>;
  update(id: ID, patch: Partial<BlogTemplate>): Promise<BlogTemplate>;
  delete(id: ID): Promise<void>;
  duplicate(id: ID): Promise<BlogTemplate>;
  incrementUseCount(id: ID): Promise<void>;
  search(q: string): Promise<BlogTemplate[]>;
  listByCategory(category: TemplateCategory): Promise<BlogTemplate[]>;
}

// ========== Collection Repository（v1.4-Organize） ==========

/** Collection 创建入参。 */
export type CollectionCreateInput = Omit<Collection, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>;

/** Collection 更新入参。 */
export type CollectionUpdatePatch = Partial<Pick<Collection, 'name' | 'icon' | 'color'>>;

/** 收藏夹数据访问接口。 */
export interface CollectionRepository {
  list(): Promise<Collection[]>;
  get(id: ID): Promise<Collection | undefined>;
  create(input: CollectionCreateInput): Promise<Collection>;
  update(id: ID, patch: CollectionUpdatePatch): Promise<Collection>;
  /** 级联删除 CollectionItem。 */
  delete(id: ID): Promise<void>;
  /** 批量更新 sortOrder（传入有序 ID 数组）。 */
  reorder(ids: ID[]): Promise<void>;

  addItem(collectionId: ID, entityType: CollectionEntityType, entityId: ID): Promise<CollectionItem>;
  removeItem(collectionId: ID, entityId: ID): Promise<void>;
  getItems(collectionId: ID, entityType?: CollectionEntityType): Promise<CollectionItem[]>;
  /** 获取某个实体所属的所有收藏夹。 */
  getItemCollections(entityType: CollectionEntityType, entityId: ID): Promise<Collection[]>;
}

// ========== Folder Repository（v1.2 F1） ==========

/** Folder 创建入参：去掉 id / 时间戳 / blogCount。 */
export type FolderCreateInput = Omit<Folder, 'id' | 'createdAt' | 'updatedAt' | 'blogCount'> & {
  /** blogCount 默认 0，允许调用方显式覆盖。 */
  blogCount?: number;
};

/** 删除文件夹时的级联策略。 */
export interface FolderDeleteOptions {
  /**
   * 子文件夹与博客改派到的目标父级 ID。
   * 缺省 = 被删文件夹自身的父级（即「上移一层」）；父级为 root 即「未分类」。
   */
  reparentTo?: ID;
}

/** 文件夹数据访问接口（V1.2 新增）。 */
export interface FolderRepository {
  /** 列出全部文件夹（按 depth → order 排序）。 */
  list(): Promise<Folder[]>;
  /** 按 ID 获取单个文件夹。 */
  get(id: ID): Promise<Folder | undefined>;
  /** 创建文件夹（自动计算 depth；校验树深 ≤ 2）。 */
  create(input: FolderCreateInput): Promise<Folder>;
  /** 更新文件夹（名称/排序等）。 */
  update(id: ID, patch: Partial<Folder>): Promise<Folder>;
  /**
   * 删除文件夹。
   * - 子文件夹上移一层（parentId 改派 `reparentTo` 或缺省为自身父级）。
   * - 归属该文件夹的博客 folderId 改派同一目标（父为 root 即未分类）。
   * - 维护 blogCount。禁止删除根文件夹。
   */
  delete(id: ID, options?: FolderDeleteOptions): Promise<void>;
  /**
   * 拖拽改派父级（移动文件夹）。
   * 校验：不能移入自身或自身子孙；移动后 depth 仍 ≤ 2。
   */
  move(id: ID, newParentId: ID): Promise<Folder>;
  /** 读取从 root 到该文件夹的路径（含自身），用于面包屑。 */
  getPath(id: ID): Promise<Folder[]>;
  /** 读取某父级下的直接子文件夹（不含孙）。 */
  getChildren(parentId: ID): Promise<Folder[]>;
  /** 维护 blogCount 缓存（博客增删/移动时调用，delta 可正可负）。 */
  bumpBlogCount(folderId: ID, delta: number): Promise<void>;
}

// ========== AICallLog Repository ==========

/** AICallLog 创建入参。 */
export type AICallLogCreateInput = Omit<AICallLog, 'id' | 'createdAt'>;

/** AI 调用统计数据。 */
export interface AICallStats {
  totalCalls: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number | null;
}

/** AI 调用日志数据访问接口。 */
export interface AICallLogRepository {
  create(input: AICallLogCreateInput): Promise<AICallLog>;
  list(opts?: QueryOptions<AICallLog>): Promise<AICallLog[]>;
  /** 按时间范围和可选模型 ID 聚合统计。 */
  getStats(since?: ISODate, modelProfileId?: ID): Promise<AICallStats>;
  /** 清除全部统计记录。 */
  clearAll(): Promise<void>;
}

// ========== ChatSession Repository（v1.5-AI Chat） ==========

import type {
  ChatSession,
  ChatMessage,
  ChatContext,
  ChatIntent,
  ChatMode,
  ActionCard,
  PlanPreviewData,
  BlogPreviewData,
  TemplatePreviewData,
  DataQueryRequest,
  SuggestionData,
} from '@/types/domain';

/** ChatSession 创建入参：去掉 id / 时间戳。 */
export type ChatSessionCreateInput = Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>;

/** ChatSession 更新入参：任意字段可空。 */
export type ChatSessionUpdatePatch = Partial<ChatSession>;

/**
 * AI 对话会话数据访问接口。
 *
 * 来源：openspec/changes/ai-chat-foundation。
 */
export interface ChatSessionRepository {
  list(opts?: QueryOptions<ChatSession>): Promise<ChatSession[]>;
  get(id: ID): Promise<ChatSession | undefined>;
  create(input: ChatSessionCreateInput): Promise<ChatSession>;
  update(id: ID, patch: ChatSessionUpdatePatch): Promise<ChatSession>;
  delete(id: ID): Promise<void>;
  /**
   * 原子追加一条消息到会话的 messages 数组，并刷新 updatedAt。
   * 事务内执行，避免并发读-改-写竞态。
   */
  appendMessage(sessionId: ID, message: ChatMessage): Promise<ChatSession>;
  /**
   * 原子合并 ChatContext 对象，并刷新 updatedAt。
   * 事务内执行。
   */
  updateContext(sessionId: ID, patch: Partial<ChatContext>): Promise<ChatSession>;
}

// ========== 元类型 re-export（便于调用方只 import 一处） ==========

export type {
  ID,
  ISODate,
  Plan,
  Item,
  Blog,
  Framework,
  Tag,
  Attachment,
  TiptapJSON,
  PlanLevel,
  PlanTimeDim,
  PlanStatus,
  ItemStatus,
  BlogStatus,
  BlogSource,
  FrameworkCategory,
  UrgencyLevel,
  BlogTemplate,
  AICallLog,
  AIGenerateMode,
  TemplateCategory,
  AIStyleParams,
  Collection,
  CollectionItem,
  CollectionEntityType,
  Folder,
  FolderType,
  ChatSession,
  ChatMessage,
  ChatContext,
  ChatIntent,
  ChatMode,
  ActionCard,
  PlanPreviewData,
  BlogPreviewData,
  TemplatePreviewData,
  DataQueryRequest,
  SuggestionData,
};
