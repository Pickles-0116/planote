/**
 * Repository 统一入口
 *
 * ⚠️ 重要架构约束 ⚠️
 * 以下模块**禁止**直接 `import { db } from '@/db/schema'` 或 `import { db } from '@/db'`：
 *   - src/features/**
 *   - src/pages/**
 *   - src/stores/**
 *
 * 所有数据访问必须通过 `xxxRepo.method()` 间接调用。
 *
 * ## 导出约定
 *
 * - **`xxxRepo`** —— 已构造好的单例实例（生产代码用）
 * - **`createXxxRepo(db?)`** —— 工厂函数（测试 / fake-indexeddb 注入用）
 */

import { createPlanRepo } from './PlanRepo';
import { createItemRepo } from './ItemRepo';
import { createBlogRepo } from './BlogRepo';
import { createFrameworkRepo } from './FrameworkRepo';
import { createTagRepo } from './TagRepo';
import { createAttachmentRepo } from './AttachmentRepo';
import { createBlogTemplateRepo } from './BlogTemplateRepo';
import { createAICallLogRepo } from './AICallLogRepo';
import { createCollectionRepo } from './CollectionRepo';
import { createChatSessionRepo } from './ChatSessionRepo';
import { createFolderRepo } from './FolderRepo';
import { createSkillRepo } from './SkillRepo';
import { createSkillFolderRepo } from './SkillFolderRepo';
import { createAIPlanRepo } from './AIPlanRepo';
import { createPlanModeMetaRepo } from './PlanModeMetaRepo';

// 生产用单例（模块加载时构造一次）
export const planRepo = createPlanRepo();
export const itemRepo = createItemRepo();
export const blogRepo = createBlogRepo();
export const frameworkRepo = createFrameworkRepo();
export const tagRepo = createTagRepo();
export const attachmentRepo = createAttachmentRepo();
export const blogTemplateRepo = createBlogTemplateRepo();
export const aiCallLogRepo = createAICallLogRepo();
export const collectionRepo = createCollectionRepo();
export const chatSessionRepo = createChatSessionRepo();
export const folderRepo = createFolderRepo();
export const skillRepo = createSkillRepo();
export const skillFolderRepo = createSkillFolderRepo();
export const aiPlanRepo = createAIPlanRepo();
export const planModeMetaRepo = createPlanModeMetaRepo();

// 同时导出 db 实例，便于 DevTools 控制台直接调试（生产代码请勿 import）
export { db } from '../index';

// 重新导出工厂函数（测试用）
export { createPlanRepo } from './PlanRepo';
export { createItemRepo } from './ItemRepo';
export { createBlogRepo } from './BlogRepo';
export { createFrameworkRepo } from './FrameworkRepo';
export { createTagRepo } from './TagRepo';
export { createAttachmentRepo } from './AttachmentRepo';
export { createBlogTemplateRepo } from './BlogTemplateRepo';
export { createAICallLogRepo } from './AICallLogRepo';
export { createCollectionRepo } from './CollectionRepo';
export { createChatSessionRepo } from './ChatSessionRepo';
export { createFolderRepo } from './FolderRepo';
export { createSkillRepo, ROOT_SKILL_FOLDER_ID, toExportSkill, fromExportSkill } from './SkillRepo';
export { createSkillFolderRepo } from './SkillFolderRepo';
export { createAIPlanRepo, buildPlanFromGoal } from './AIPlanRepo';
export { createPlanModeMetaRepo } from './PlanModeMetaRepo';
export type { PlanModeStateMeta } from './PlanModeMetaRepo';
