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
 * 目的：v1.1 接入云同步时只需新增 RemoteXxxRepo 包装，零侵入。
 *
 * ## 导出约定
 *
 * - **`xxxRepo`** —— 已构造好的单例实例（生产代码用）
 *   ```ts
 *   import { planRepo } from '@/db/repos';
 *   await planRepo.create({ ... });
 *   ```
 *
 * - **`createXxxRepo(db?)`** —— 工厂函数（测试 / fake-indexeddb 注入用）
 *   ```ts
 *   import { createPlanRepo } from '@/db/repos/PlanRepo';
 *   const repo = createPlanRepo(testDb);
 *   ```
 *
 * dev 验证脚本可直接 `import { db, planRepo, frameworkRepo } from '@/db/repos'`。
 */

import { createPlanRepo } from './PlanRepo';
import { createItemRepo } from './ItemRepo';
import { createBlogRepo } from './BlogRepo';
import { createFrameworkRepo } from './FrameworkRepo';
import { createTagRepo } from './TagRepo';
import { createAttachmentRepo } from './AttachmentRepo';

// 生产用单例（模块加载时构造一次）
export const planRepo = createPlanRepo();
export const itemRepo = createItemRepo();
export const blogRepo = createBlogRepo();
export const frameworkRepo = createFrameworkRepo();
export const tagRepo = createTagRepo();
export const attachmentRepo = createAttachmentRepo();

// 同时导出 db 实例，便于 DevTools 控制台直接调试（生产代码请勿 import）
export { db } from '../index';

// 重新导出工厂函数（测试用）
export { createPlanRepo } from './PlanRepo';
export { createItemRepo } from './ItemRepo';
export { createBlogRepo } from './BlogRepo';
export { createFrameworkRepo } from './FrameworkRepo';
export { createTagRepo } from './TagRepo';
export { createAttachmentRepo } from './AttachmentRepo';
