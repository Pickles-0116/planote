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
  /** 用了哪个框架（直接创作时为 undefined）。 */
  frameworkId?: ID;
  attachmentIds: ID[];
  status: BlogStatus;
  source: BlogSource;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** 发布时由 BlogRepo 自动填入。 */
  publishedAt?: ISODate;
}
