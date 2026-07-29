/**
 * reconcileTags - 一次性标签数据治理（V1.2 B5 决策 1）
 *
 * 历史数据中 `Plan.tagIds` / `Blog.tagIds` 可能混入了：
 * - 孤儿 ID：引用了已不存在的 Tag（需清除）
 * - 裸字符串：直接存了标签名而非 Tag.id（需解析为 Tag.id，必要时创建）
 *
 * 本函数幂等、只读 + 必要写，可在启动时安全调用。
 * 返回各实体的修复计数，便于埋点/日志。
 */

import type { ID, Tag } from '@/types/domain';
import { newId } from '@/lib/id';
import type { PlanoteDB } from './schema';

/** 是否为合法 ULID（26 字符 Crockford base32）。 */
const isUlid = (s: string): boolean =>
  /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);

export interface ReconcileResult {
  plansFixed: number;
  blogsFixed: number;
  tagsCreated: number;
}

/**
 * 治理单个实体的 tagIds：
 * - 命中现存 Tag.id → 保留
 * - 合法 ULID 但无对应 Tag → 孤儿，丢弃
 * - 非 ULID 字符串 → 视为裸标签名，按名匹配/创建后替换
 *
 * @returns 清洗后的 tagIds 与是否发生变化
 */
function reconcileTagIds(
  rawTagIds: ID[],
  tagById: Map<ID, Tag>,
  tagByName: Map<string, Tag>,
  createTag: (name: string) => Tag,
): { next: ID[]; changed: boolean } {
  const next: ID[] = [];
  let changed = false;
  for (const tid of rawTagIds) {
    if (tagById.has(tid)) {
      next.push(tid);
      continue;
    }
    if (isUlid(tid)) {
      // 孤儿 ID，丢弃
      changed = true;
      continue;
    }
    // 裸字符串 → 解析为 Tag
    const key = String(tid).toLowerCase();
    const existing = tagByName.get(key);
    if (existing) {
      next.push(existing.id);
    } else {
      const created = createTag(String(tid));
      next.push(created.id);
    }
    changed = true;
  }
  return { next, changed };
}

export async function reconcileTags(db: PlanoteDB): Promise<ReconcileResult> {
  const tags = await db.tags.toArray();
  const tagById = new Map<ID, Tag>(tags.map((t) => [t.id, t]));
  const tagByName = new Map<string, Tag>(
    tags.map((t) => [t.name.toLowerCase(), t]),
  );

  let tagsCreated = 0;
  const createdTags: Tag[] = [];
  const createTag = (name: string): Tag => {
    const tag: Tag = {
      id: newId(),
      name: name.trim() || '未命名标签',
      color: '#64748B',
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };
    // 同步写入两张查找表，避免同批次重复创建
    tagById.set(tag.id, tag);
    tagByName.set(tag.name.toLowerCase(), tag);
    createdTags.push(tag);
    tagsCreated += 1;
    return tag;
  };

  let plansFixed = 0;
  let blogsFixed = 0;

  await db.transaction('rw', db.tags, db.plans, db.blogs, async () => {
    const plans = await db.plans.toArray();
    for (const p of plans) {
      const { next, changed } = reconcileTagIds(
        p.tagIds,
        tagById,
        tagByName,
        createTag,
      );
      if (changed) {
        await db.plans.update(p.id, { tagIds: next });
        plansFixed += 1;
      }
    }

    const blogs = await db.blogs.toArray();
    for (const b of blogs) {
      const { next, changed } = reconcileTagIds(
        b.tagIds,
        tagById,
        tagByName,
        createTag,
      );
      if (changed) {
        // 用 put 而非 update：规避 Dexie UpdateSpec 对递归 TiptapJSON 的 TS2615
        await db.blogs.put({ ...b, tagIds: next });
        blogsFixed += 1;
      }
    }

    // 处理完所有实体后，统一写入新建的标签
    if (createdTags.length > 0) {
      await db.tags.bulkPut(createdTags);
    }
  });

  return { plansFixed, blogsFixed, tagsCreated };
}
