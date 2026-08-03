/**
 * Planote · 全局领域类型定义
 *
 * 字段与 architecture.md §3.1 逐字对齐。
 * 不放任何实现逻辑——纯类型 + 枚举。
 *
 * 模块对应：
 * - Plan      → PlanRepo
 * - Item      → ItemRepo
 * - Blog      → BlogRepo
 * - Framework → FrameworkRepo
 * - Tag       → TagRepo
 * - Attachment → AttachmentRepo
 */

// ========== 基础类型别名 ==========

/** ULID 字符串主键（26 字符 Crockford base32）。生成与校验见 `@/lib/id`。 */
export type ID = string;

/** ISO 8601 时间字符串（如 `2026-07-19T10:00:00Z` 或 `2026-07-19`）。 */
export type ISODate = string;

// ========== 枚举 ==========

/** 计划层级：短/中/长期。 */
export type PlanLevel = 'short' | 'mid' | 'long';

/** 计划时间维度：今日/本月/本年/一次性。 */
export type PlanTimeDim = 'daily' | 'monthly' | 'yearly' | 'once';

/** 计划状态：未开始 / 进行中 / 已完成 / 已搁置。 */
export type PlanStatus = 'todo' | 'doing' | 'done' | 'paused';

/** 事项状态：待办 / 进行中 / 已完成。 */
export type ItemStatus = 'todo' | 'doing' | 'done';

/** 博客状态：草稿 → 已发布 → 归档。 */
export type BlogStatus = 'draft' | 'published' | 'archived';

/** 博客来源：直接创作 / 从计划生成 / 上传。 */
export type BlogSource = 'direct' | 'plan' | 'upload';

/** 紧急度（用于智能排序）：🔴 红 / 🟠 橙 / 🟡 黄 / ⬜ 无。 */
export type UrgencyLevel = 'red' | 'orange' | 'yellow' | 'none';

/** 博客框架分类（与抽屉 Tab 对应）。 */
export type FrameworkCategory = 'review' | 'note' | 'summary' | 'habit';

// ========== 富文本（Tiptap JSON 简版） ==========

/**
 * Tiptap JSON 文档。
 * 完整类型由 Tiptap schema 决定（v1.0 Sprint 3 引入），此处仅给最小结构。
 */
export type TiptapJSON = {
  type: 'doc';
  content: TiptapNode[];
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: unknown[];
};

// ========== 标签 ==========

/** 标签实体（Plan / Blog ↔ Tag 多对多，通过 `*tagIds` 多值索引关联）。 */
export interface Tag {
  id: ID;
  /** 标签名（唯一索引 `&name`）。 */
  name: string;
  /** 颜色 hex（如 `#3B82F6`）。 */
  color: string;
  /** 引用计数：被多少个 Plan / Blog 引用。 */
  usageCount: number;
  createdAt: ISODate;
  /**
   * 最后更新时间（M1 云同步新增，用于 LWW 合并，见 design.md §4.3）。
   * 历史数据在 DB 升级时按 `createdAt` 兜底补齐。
   */
  updatedAt: ISODate;
}

// ========== 附件 ==========

/** 附件实体（Blog ↔ Attachment 一对多）。 */
export interface Attachment {
  id: ID;
  /** 所属博客。 */
  blogId: ID;
  filename: string;
  /** MIME 类型（如 `image/png` / `application/pdf`）。 */
  mimeType: string;
  /** 字节数。 */
  size: number;
  /** 实际二进制。v1.1 可改为 fsHandle 引用。 */
  blob: Blob;
  /** 图片宽度（仅图片）。 */
  width?: number;
  /** 图片高度（仅图片）。 */
  height?: number;
  uploadedAt: ISODate;
}

// ========== 框架模板 ==========

/** 框架内一个章节（heading + 引导问题 + 占位）。 */
export interface FrameworkSection {
  /** 章节标题（如 "目标回顾"）。 */
  heading: string;
  /** 引导问题（如 "原定目标是什么？实际达成多少？"）。 */
  guide: string;
  /** 占位提示（编辑器空白时显示）。 */
  placeholder: string;
}

/** 框架模板（v1.0 4 套内置，v1.2 用户可自定义）。 */
export interface Framework {
  id: ID;
  /** 框架名（如 "项目复盘"）。 */
  name: string;
  /** 一句话描述。 */
  description: string;
  category: FrameworkCategory;
  /** Lucide icon 名称（如 `'GitPullRequest'`）。 */
  icon: string;
  sections: FrameworkSection[];
  /** 引用次数（统计 + 热门排序）。 */
  useCount: number;
  /** 内置 vs 用户自定义。v1.0 全为 true。 */
  builtin: boolean;
  /**
   * 创建时间（M1 云同步新增，用于 LWW 合并兜底，见 design.md §4.3）。
   * 历史数据在 DB 升级时按当前时间补齐。
   */
  createdAt: ISODate;
  /**
   * 最后更新时间（M1 云同步新增，用于 LWW 合并，见 design.md §4.3）。
   * 历史数据在 DB 升级时按当前时间补齐。
   */
  updatedAt: ISODate;
}

// ========== 技能（v1.3 S 模块：技能管理） ==========

/** 技能类型（与侧边类型 chips / 筛选对齐）。 */
export type SkillType = 'summary' | 'writing' | 'imitate' | 'translate' | 'custom';

/** 技能参数定义（SkillEditor params builder 的最小单元）。 */
export interface SkillParam {
  /** 模板占位符 key，如 `topic`。模板中用 `{{topic}}` 引用。 */
  key: string;
  /** 展示名（选择器 / 实时预览中显示）。 */
  label: string;
  /** 输入控件类型。 */
  type: 'text' | 'textarea' | 'number' | 'select';
  /** 默认值（导出/预览时填充示例）。 */
  default?: string;
}

/**
 * 技能实体（用户可管理的 AI 总结 / 写作模板）。
 *
 * 与 BlogTemplate 解耦：技能是「对话内可 @ 调用的轻量 prompt 模板」，
 * 不进入博客编辑器体系。
 */
export interface Skill {
  id: ID;
  name: string;
  description?: string;
  type: SkillType;
  /**
   * 所属技能文件夹 ID。缺省为 `ROOT_SKILL_FOLDER_ID`（「全部技能」）。
   * 与博客 `folders` 表严格隔离（独立树、独立 repo）。
   */
  folderId: string;
  /** 内置 vs 用户自定义。内置技能导出时需「复制为自定义」再导出。 */
  builtin: boolean;
  /**
   * Prompt 模板，含占位符：`{{blogs}}` `{{topic}}` `{{text}}` `{{instruction}}` `{{target}}`。
   * 占位符 `{{` 与 `}}` 必须成对，否则保存时被拦截（SkillEditor 校验）。
   */
  promptTemplate: string;
  /** 参数定义（对应 @skill 选择器与实时预览）。 */
  params: SkillParam[];
  /** 引用次数（统计 + 热门排序）。 */
  useCount: number;
  /**
   * 导入健康度（v1.3 修复流程）：
   * - 缺省 / `'ready'`：格式合规、可被 `@skill` 引用。
   * - `'raw'`：导入时格式不兼容，仅作「原样收藏」，尚未修复，`promptTemplate` 为空。
   *   修复对话框确认后会就地改为 `'ready'` 并填充 `promptTemplate` / `params`。
   */
  status?: 'raw' | 'ready';
  /** 原样收藏时保留的原始 markdown 文本，供后续「修复」使用（ready 技能为 undefined）。 */
  rawText?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 技能文件夹（v1.3 新增，与博客 folders 表严格隔离，独立树）。 */
export interface SkillFolder {
  id: ID;
  name: string;
  /** 父文件夹 ID；根「全部技能」为 `''`。 */
  parentId: ID;
  /** 树深度（0/1/2）。 */
  depth: number;
  /** 同父级下排序序号。 */
  order: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ========== 事项 ==========

/** 事项实体（Plan 1—N Item）。 */
export interface Item {
  id: ID;
  /** 所属计划。 */
  planId: ID;
  title: string;
  description?: string;
  status: ItemStatus;
  /** 冗余字段：`status === 'done'` 的简化表示（写入时由 Repository 同步）。 */
  checked: boolean;
  /** 截止日期。 */
  dueDate?: ISODate;
  /** 计划内排序（由 `[planId+order]` 复合索引支持）。 */
  order: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** 完成时间（首次勾选时填写，再次勾选不清空）。 */
  completedAt?: ISODate;
}

// ========== 计划 ==========

/** 计划实体（核心根实体）。 */
export interface Plan {
  id: ID;
  title: string;
  description: string;
  level: PlanLevel;
  timeDim: PlanTimeDim;
  status: PlanStatus;
  /** 进度 0-100，由 ItemRepo 重算并写入缓存。 */
  progress: number;
  /** 紧急度，由 `computeUrgency` 派生并写入缓存。 */
  urgency: UrgencyLevel;
  tagIds: ID[];
  /** 冗余索引（按 order 排序），由 ItemRepo 维护一致性。 */
  itemIds: ID[];
  /** 反向引用：哪些 Blog 由本计划生成。 */
  blogIds: ID[];
  startDate?: ISODate;
  /** 截止（紧急度计算依据）。 */
  endDate?: ISODate;
  /** 父计划（v1.1 长期→中期→短期的拆解关系）。 */
  parentPlanId?: ID;
  /** 子计划 ID 列表（v1.1 使用，v1.0 保留字段）。 */
  childPlanIds: ID[];
  createdAt: ISODate;
  updatedAt: ISODate;
  completedAt?: ISODate;
}

// ========== 博客 ==========

/** AI 写作风格参数（博客模板的核心差异点）。 */
export interface AIStyleParams {
  style: 'professional' | 'casual' | 'academic' | 'narrative' | 'custom';
  styleDescription?: string;
  tone: 'positive' | 'neutral' | 'reflective' | 'custom';
  audience: 'self' | 'team' | 'public' | 'custom';
  minWords: number;
  maxWords: number;
}

/** 博客模板分类（扩展现有 FrameworkCategory + custom）。 */
export type TemplateCategory = FrameworkCategory | 'decision' | 'analysis' | 'custom';

/** 博客模板 = 结构 + AI 语义（风格/语气/读者/字数），面向 AI 生成。 */
export interface BlogTemplate {
  id: ID;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  sections: FrameworkSection[];
  aiParams: AIStyleParams;
  /** v1.4-Organize：标签 ID 列表。 */
  tagIds: ID[];
  useCount: number;
  lastUsedAt?: ISODate;
  builtin: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** AI 服务商类型。 */
export type AIProvider = 'openai' | 'claude' | 'qwen' | 'custom' | 'minimax';

/** AI 模型配置（BYOK 模式，Key 仅存本地）。 */
export interface AIModelProfile {
  id: ID;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  role: 'default' | 'backup';
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** AI 生成模式。 */
export type AIGenerateMode = 'template' | 'imitate' | 'polish' | 'rewrite' | 'chat';

/** AI 调用日志（IndexedDB 存储，用于统计面板）。 */
export interface AICallLog {
  id: ID;
  modelProfileId: ID;
  mode: AIGenerateMode;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  createdAt: ISODate;
}

/** 博客实体（富文本文章）。 */
export interface Blog {
  id: ID;
  title: string;
  /**
   * TiptapJSON string（add-blog-tiptap-editor 增量）：
   * 持久化形式为 `JSON.stringify(doc)`，读取时 `JSON.parse` 还原为 `{ type: 'doc', content: [...] }`。
   * v1.0 之前可能是 Markdown / 纯文本字符串（由 `migrateBlogContent` 自动迁移）。
   * 详细节点类型见 `src/types/editor.ts`。
   */
  content: TiptapJSON;
  /** 纯文本镜像（全文检索用）。 */
  contentText: string;
  /** 摘要。 */
  excerpt: string;
  /** 封面图附件 ID。 */
  coverImageId?: ID;
  tagIds: ID[];
  /** 从哪个计划生成（直接创作时为 undefined）。 */
  sourcePlanId?: ID;
  /**
   * 所属文件夹 ID（V1.2 F1）。
   * 永不为 null；缺省为 `ROOT_FOLDER_ID`（「未分类」）。
   */
  folderId: string;
  /**
   * @deprecated v1.4-Unify：统一使用 `templateId`。
   * 保留读取兼容（fallback），新写入不再使用。
   */
  frameworkId?: ID;
  /** 用了哪个博客模板（AI 生成时关联）。v1.4-Unify 统一使用此字段。 */
  templateId?: ID;
  attachmentIds: ID[];
  status: BlogStatus;
  source: BlogSource;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** 发布时由 BlogRepo 自动填入。 */
  publishedAt?: ISODate;
}

// ========== 收藏夹（v1.4-Organize） ==========

/** 收藏夹可关联的实体类型。 */
export type CollectionEntityType = 'plan' | 'blog' | 'template';

/** 收藏夹实体（用户创建的逻辑分组）。 */
export interface Collection {
  id: ID;
  name: string;
  /** Lucide 图标名。 */
  icon: string;
  /** hex 颜色（如 `#3B82F6`）。 */
  color: string;
  /** 排序序号。 */
  sortOrder: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 收藏夹-实体关联记录（多对多）。 */
export interface CollectionItem {
  id: ID;
  collectionId: ID;
  entityType: CollectionEntityType;
  entityId: ID;
  addedAt: ISODate;
}

// ========== 文件夹（v1.2 F1） ==========

/** 文件夹类型：根 / 主文件夹 / 日期子文件夹。 */
export type FolderType = 'root' | 'main' | 'date';

/**
 * 文件夹实体（V1.2 新增，用于组织博客）。
 *
 * 树结构（深度上限 2）：
 *   root（未分类） → 主文件夹 → 日期子文件夹
 *
 * - `parentId`：父文件夹 ID。root 的 parentId 为空字符串 `''`。
 * - `depth`：0=root / 1=主 / 2=日期。
 * - `blogCount`：缓存值，由 `FolderRepo.bumpBlogCount` 在博客增删/移动时维护。
 */
export interface Folder {
  id: ID;
  /** 显示名（root 固定为「未分类」）。 */
  name: string;
  type: FolderType;
  /** 父文件夹 ID；root 为 `''`。 */
  parentId: ID;
  /** 树深度（0/1/2）。 */
  depth: number;
  /** 同父级下排序序号。 */
  order: number;
  /** 缓存的博客数量（含子孙目录的博客）。 */
  blogCount: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ========== AI 对话助手（v1.5-AI Chat） ==========

/**
 * AI 对话意图分类（与 System Prompt 中 5 意图对应）。
 *
 * - `create_plan`: 用户想要创建/规划目标
 * - `create_blog`: 用户想要撰写博客文章
 * - `create_template`: 用户想要设计博客模板
 * - `query`: 用户想查询应用数据或统计
 * - `chat`: 普通对话（不属于以上 4 种）
 *
 * 来源：PRD §F2.1 意图分类器。
 */
export type ChatIntent = 'create_plan' | 'create_blog' | 'create_template' | 'query' | 'chat';

/**
 * 对话交互模式。
 *
 * - `guided`: 引导模式 — AI 主动追问缺失字段
 * - `free`: 自由模式 — AI 用合理默认值自动补全
 *
 * 状态持久化在 `ChatContext.mode`。
 */
export type ChatMode = 'guided' | 'free';

/**
 * 对话消息。`actionCard` 字段供 ai-chat-intent-routing 挂载操作卡片，
 * `status` 字段用于发送中/失败 UI 状态。
 *
 * 来源：PRD §F1.4 数据模型。
 */
export interface ChatMessage {
  id: ID;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /**
   * AI 思考过程（D1 新增）。由适配器解析 `reasoning_content`/`reasoning`/`thinking` 收集，
   * UI 默认折叠展示「思考过程 ▼」。历史消息无此字段时保持原样（不渲染折叠区）。
   */
  thinking?: string;
  /** Unix 毫秒时间戳。 */
  timestamp: number;
  /** AI 消息携带的操作卡片（plan_preview / blog_preview / template_preview / data_query / suggestion）。 */
  actionCard?: ActionCard;
  /** 消息状态：发送中/已发送/失败。仅 user 消息使用。 */
  status?: 'sending' | 'sent' | 'error';
}

/**
 * 对话操作上下文：跟踪当前意图、收集到的字段、用户编辑中的草稿。
 *
 * 在引导模式下 `collectedFields` 记录已询问并确认的字段名；
 * `draftData` 暂存用户编辑中（未提交）的实体数据，避免编辑丢失。
 */
export interface ChatContext {
  currentIntent?: ChatIntent;
  /** 编辑中的草稿数据。类型取决于 currentIntent。 */
  draftData?: Partial<Plan> | Partial<Blog> | Partial<BlogTemplate>;
  /** 引导模式下已收集的字段名。 */
  collectedFields?: string[];
  /** 当前交互模式。 */
  mode?: ChatMode;
}

/**
 * 对话会话。`messages` 数组按时间序存储，`context` 跟踪当前操作上下文。
 *
 * 来源：PRD §F1.4 数据模型。
 */
export interface ChatSession {
  id: ID;
  /** 会话标题：自动从首条 user 消息提取（≤ 30 字）或手动命名。 */
  title: string;
  messages: ChatMessage[];
  context: ChatContext;
  /** 会话绑定的 AI 模型 ID（可选；缺省 = 全局默认模型）。 */
  modelProfileId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ========== AI 执行计划（v1.3 P 模块：PlanMode） ==========

/** PlanMode 中一个执行步骤的状态。 */
export type ExecutionStepStatus = 'todo' | 'doing' | 'done';

/**
 * PlanMode 执行步骤类型（v1.3-fix F3 新增，缺省按 'custom' 处理）。
 *
 * - `query`：读本地数据（AI 可自行输出 get_* tool_call 走既有拦截链路）
 * - `summarize`：总结类
 * - `create_blog` / `create_template` / `create_plan`：产出预览，等用户确认
 * - `skill`：走 S 模块技能（`toolData.skillId` 引用）
 * - `custom`：缺省通用类型
 */
export type ExecutionStepType =
  | 'query'
  | 'summarize'
  | 'create_blog'
  | 'create_template'
  | 'create_plan'
  | 'skill'
  | 'custom';

/** PlanMode 执行计划中的一个步骤。 */
export interface ExecutionStep {
  id: ID;
  title: string;
  description?: string;
  status: ExecutionStepStatus;
  /** 步骤执行类型（缺省按 'custom' 处理）。 */
  type?: ExecutionStepType;
  /** 步骤附带数据（如 skill 步骤的 `{ skillId, params }`）。 */
  toolData?: Record<string, unknown>;
}

/**
 * PlanMode 产出 / 执行的计划实体。
 *
 * - 规划会话（A）调 `/plan <目标>` 生成；
 * - 执行会话（B）调 `/execute 1-3|all` 逐步推进；
 * - 状态存 `aiPlans` 表，跨会话共享（关掉再开仍接着进度）。
 */
export interface AIPlan {
  id: ID;
  title: string;
  description?: string;
  steps: ExecutionStep[];
  /** 来源会话 ID（规划 A）。 */
  sourceSessionId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ========== 操作卡片（ActionCard） ==========

/** 计划预览卡片数据（来自 ```tool_call``` tool=create_plan）。 */
export interface PlanPreviewData {
  title: string;
  description?: string;
  level: PlanLevel;
  timeDim: PlanTimeDim;
  startDate?: ISODate;
  endDate?: ISODate;
  items: Array<{ title: string; description?: string }>;
}

/** 博客预览卡片数据（来自 tool=create_blog）。 */
export interface BlogPreviewData {
  title: string;
  content: string;
  style: 'professional' | 'casual' | 'academic' | 'narrative';
  templateId?: ID;
  tags?: string[];
}

/** 模板预览卡片数据（来自 tool=create_template）。 */
export interface TemplatePreviewData {
  name: string;
  description: string;
  category: TemplateCategory;
  sections: Array<{ heading: string; guide: string; placeholder: string }>;
  aiParams: AIStyleParams;
}

/** 数据查询请求（来自 tool=get_*）。 */
export interface DataQueryRequest {
  tool: 'get_plans' | 'get_blogs' | 'get_templates' | 'get_stats';
  filter?: Record<string, unknown>;
}

/** 操作建议数据（来自 tool=suggest）。 */
export interface SuggestionData {
  type: 'overdue_plans' | 'stale_drafts' | 'paused_too_long';
  title: string;
  entityIds: ID[];
}

/**
 * 操作卡片判别联合。AI 在回复中输出 ```tool_call``` 块后，前端解析为对应类型。
 *
 * 用 `switch (card.type)` 可在编译期收窄 data 字段类型。
 *
 * 来源：ai-chat-foundation design.md 决策 6。
 */
export type ActionCard =
  | { type: 'plan_preview'; data: PlanPreviewData }
  | { type: 'blog_preview'; data: BlogPreviewData }
  | { type: 'template_preview'; data: TemplatePreviewData }
  | { type: 'data_query'; tool: DataQueryRequest['tool']; filter?: Record<string, unknown> }
  | { type: 'suggestion'; data: SuggestionData }
  | { type: 'execution_plan'; data: AIPlan }
  | {
      type: 'execution_step_result';
      data: { planId: ID; stepOrder: number; title: string; result: string };
    }
  | { type: 'unknown'; rawTool: string; rawData: unknown };
