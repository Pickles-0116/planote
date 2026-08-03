/**
 * v1.4 统一迁移 · 将 Framework / Preset / Blog.frameworkId / Blog.tagIds 全部统一到 BlogTemplate
 *
 * 迁移步骤（幂等）：
 * 1. migratePresetsToTemplates：10 个 Preset → BlogTemplate（已有逻辑，保留）
 * 2. migrateDexieFrameworksToTemplates：4 个 Dexie Framework → BlogTemplate（新增）
 * 3. migrateBlogFrameworkIds：Blog.frameworkId → Blog.templateId（新增）
 * 4. migrateBlogTagIds：Blog.tagIds 字符串 → Tag ID（新增）
 *
 * main.tsx 调用 migrateAllToTemplates() 一站式执行全部迁移。
 */

import { FRAMEWORK_PRESETS } from '@/features/framework/data/presets';
import type { BlogTemplate, TemplateCategory, AIStyleParams, FrameworkSection, Tag } from '@/types/domain';
import type { PresetCategory } from '@/features/framework/data/presets';
import { db } from '@/db';

/** PresetCategory → TemplateCategory 映射。 */
const categoryMap: Record<PresetCategory, TemplateCategory> = {
  review: 'review',
  note: 'note',
  summary: 'summary',
  habit: 'habit',
  decision: 'decision',
  analysis: 'analysis',
};

/** FrameworkCategory → TemplateCategory 映射（直接兼容）。 */
const fwCategoryToTemplate: Record<string, TemplateCategory> = {
  review: 'review',
  note: 'note',
  summary: 'summary',
  habit: 'habit',
};

/** 默认 AI 参数。 */
const defaultAIParams: AIStyleParams = {
  style: 'professional',
  tone: 'neutral',
  audience: 'self',
  minWords: 800,
  maxWords: 1500,
};

/** 将 PresetSection[] 转换为 FrameworkSection[]。 */
function toSections(sections: { heading: string; guide: string; placeholder: string }[]): FrameworkSection[] {
  return sections.map((s) => ({
    heading: s.heading,
    guide: s.guide,
    placeholder: s.placeholder,
  }));
}

/** ULID 格式校验（26 字符 Crockford base32）。 */
function isULID(s: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
}

/** 自动分配颜色（按序号轮询 8 种预设色）。 */
const PRESET_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
function autoColor(index: number): string {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

// ========== 迁移步骤 1：Preset → BlogTemplate ==========

/** 迁移 10 个 Preset 为 BlogTemplate（幂等）。 */
export async function migratePresetsToTemplates(): Promise<void> {
  const migrated = await db.meta.get('templatesMigrated');
  if (migrated?.value === true) return;

  const now = new Date().toISOString();

  for (const preset of FRAMEWORK_PRESETS) {
    const existing = await db.blogTemplates
      .filter((t) => t.name === preset.name && t.builtin === true)
      .first();

    if (existing) continue;

    const tpl: BlogTemplate = {
      id: `tpl_${preset.id}`,
      name: preset.name,
      description: preset.description,
      category: categoryMap[preset.category] ?? 'custom',
      icon: preset.icon,
      sections: toSections(preset.sections),
      aiParams: { ...defaultAIParams },
      tagIds: [],
      useCount: 0,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.blogTemplates.add(tpl);
  }

  await db.meta.put({ key: 'templatesMigrated', value: true });
}

// ========== 迁移步骤 2：Dexie Framework → BlogTemplate ==========

/** 迁移 Dexie frameworks 表中不在 Preset 中的条目为 BlogTemplate（幂等）。 */
async function migrateDexieFrameworksToTemplates(): Promise<number> {
  const migrated = await db.meta.get('dexieFrameworksMigrated');
  if (migrated?.value === true) return 0;

  const now = new Date().toISOString();
  let count = 0;

  const frameworks = await db.frameworks.toArray();
  for (const fw of frameworks) {
    // 检查是否已存在同名 builtin 模板
    const existing = await db.blogTemplates
      .filter((t) => t.name === fw.name && t.builtin === true)
      .first();

    if (existing) continue;

    const tpl: BlogTemplate = {
      id: fw.id, // 保留原 framework ID
      name: fw.name,
      description: fw.description,
      category: fwCategoryToTemplate[fw.category] ?? 'custom',
      icon: fw.icon,
      sections: toSections(fw.sections),
      aiParams: { ...defaultAIParams },
      tagIds: [],
      useCount: fw.useCount ?? 0,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.blogTemplates.add(tpl);
    count++;
  }

  await db.meta.put({ key: 'dexieFrameworksMigrated', value: true });
  return count;
}

// ========== 迁移步骤 3：Blog.frameworkId → Blog.templateId ==========

/**
 * 迁移现有博客的 frameworkId → templateId。
 *
 * 映射规则：
 * - 若 frameworkId 匹配 Dexie Framework 的 id → 设为对应 BlogTemplate 的 id（相同）
 * - 若 frameworkId 匹配 Preset 的 id (fw_xxx) → 设为 tpl_fw_xxx
 * - 若已有 templateId 且非空 → 跳过
 */
async function migrateBlogFrameworkIds(): Promise<number> {
  const migrated = await db.meta.get('blogFrameworkIdsMigrated');
  if (migrated?.value === true) return 0;

  // 预加载模板用于 ID 映射
  const allTemplates = await db.blogTemplates.toArray();
  const templateById = new Map(allTemplates.map((t) => [t.id, t]));
  const templateByName = new Map(allTemplates.map((t) => [t.name, t]));

  const blogs = await db.blogs.toArray() as unknown as Array<{ id: string; templateId?: string; frameworkId?: string; tagIds: string[] }>;
  let count = 0;

  for (const blog of blogs) {
    // 已有 templateId 且非空 → 跳过
    if (blog.templateId) continue;
    // 无 frameworkId → 跳过
    if (!blog.frameworkId) continue;

    let templateId: string | undefined;

    // 1. 直接匹配模板 ID
    if (templateById.has(blog.frameworkId)) {
      templateId = blog.frameworkId;
    }
    // 2. Preset ID 映射（fw_xxx → tpl_fw_xxx）
    else if (blog.frameworkId.startsWith('fw_')) {
      const tplId = `tpl_${blog.frameworkId}`;
      if (templateById.has(tplId)) {
        templateId = tplId;
      }
    }
    // 3. 按名称查找（兜底）
    else {
      const tpl = templateByName.get(blog.frameworkId);
      if (tpl) templateId = tpl.id;
    }

    if (templateId) {
      // Dexie mapped type workaround: cast table to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.blogs as any).update(blog.id, { templateId });
      count++;
    }
  }

  await db.meta.put({ key: 'blogFrameworkIdsMigrated', value: true });
  return count;
}

// ========== 迁移步骤 4：Blog.tagIds 字符串 → Tag ID ==========

/**
 * 迁移博客 tagIds 从字符串名称到 Tag 实体 ID。
 *
 * 判断逻辑：如果 tagIds 中所有值都不是 ULID 格式，则视为未迁移。
 */
async function migrateBlogTagIds(): Promise<number> {
  const migrated = await db.meta.get('blogTagIdsMigrated');
  if (migrated?.value === true) return 0;

  const existingTags = await db.tags.toArray();
  const tagByName = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]));
  let tagCount = existingTags.length;

  const blogs = await db.blogs.toArray() as unknown as Array<{ id: string; tagIds: string[] }>;
  let count = 0;

  for (const blog of blogs) {
    if (!blog.tagIds || blog.tagIds.length === 0) continue;

    // 检查是否已经是 ULID 格式
    const allULID = blog.tagIds.every((id: string) => isULID(id));
    if (allULID) continue;

    const newTagIds: string[] = [];
    for (const tagName of blog.tagIds) {
      const lowerName = tagName.trim().toLowerCase();
      let tagId = tagByName.get(lowerName);
      if (!tagId) {
        // 创建新 Tag
        const now = new Date().toISOString();
        tagId = `tag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newTag: Tag = {
          id: tagId,
          name: tagName.trim(),
          color: autoColor(tagCount),
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        await db.tags.add(newTag);
        tagByName.set(lowerName, tagId);
        tagCount++;
      }
      newTagIds.push(tagId);
    }

    // Dexie mapped type workaround
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.blogs as any).update(blog.id, { tagIds: newTagIds });
    count++;
  }

  await db.meta.put({ key: 'blogTagIdsMigrated', value: true });
  return count;
}

// ========== 一站式迁移入口 ==========

/** 执行所有 v1.4 迁移（幂等）。 */
export async function migrateAllToTemplates(): Promise<void> {
  const start = Date.now();

  // 按顺序执行（步骤间有依赖：先建模板，再映射博客）
  await migratePresetsToTemplates();
  const fwCount = await migrateDexieFrameworksToTemplates();
  const blogCount = await migrateBlogFrameworkIds();
  const tagCount = await migrateBlogTagIds();

  const durationMs = Date.now() - start;
  console.log(
    `[migrate] v1.4 migration complete in ${durationMs}ms: ` +
    `${fwCount} frameworks, ${blogCount} blog.frameworkIds, ${tagCount} blog.tagIds`
  );

  // 写入迁移版本标记
  await db.meta.put({
    key: 'v14MigrationVersion',
    value: { fwCount, blogCount, tagCount, durationMs, date: new Date().toISOString() },
  });
}
