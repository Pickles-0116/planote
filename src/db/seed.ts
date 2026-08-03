/**
 * 内置博客框架种子数据
 *
 * v1.0 预置 4 套框架（项目复盘 / 21 天习惯复盘 / 读书笔记 / 月度总结），
 * 通过 `seedIfNeeded()` 首次启动时**幂等**写入 `frameworks` 表。
 *
 * 章节来源：design.md §7.2（从 prototype 反查）。
 */

import type { Framework } from '@/types/domain';
import type { PlanoteDB } from './schema';
import { ROOT_FOLDER_ID, ROOT_FOLDER_NAME } from '@/features/folders/constants';

// ========== 4 套内置框架 ==========

/**
 * 内置框架的稳定时间戳（M1 云同步新增 createdAt/updatedAt，用于 LWW 合并兜底）。
 * 使用固定常量而非 `new Date()`，保证幂等种子写入产生稳定的时间值。
 */
const BUILTIN_FRAMEWORK_TIME = '2024-01-01T00:00:00.000Z';

/** 框架 1：项目复盘（category=review, icon=GitPullRequest）。 */
const FW_REVIEW: Framework = {
  id: 'fw_review',
  name: '项目复盘',
  description: '回顾一个完整项目：目标、过程、数据、下一步。',
  category: 'review',
  icon: 'GitPullRequest',
  builtin: true,
  useCount: 0,
  createdAt: BUILTIN_FRAMEWORK_TIME,
  updatedAt: BUILTIN_FRAMEWORK_TIME,
  sections: [
    {
      heading: '目标回顾',
      guide: '原定目标是什么？实际达成多少？',
      placeholder: '用 2-3 句话写清楚立项时的预期…',
    },
    {
      heading: '过程亮点',
      guide: '哪些节点比预期顺利？为什么？',
      placeholder: '挑 2-3 个值得记录的时刻…',
    },
    {
      heading: '过程挑战',
      guide: '哪些卡点？当时怎么解决的？',
      placeholder: '诚实写下来，藏着掖着不会有进步…',
    },
    {
      heading: '关键数据',
      guide: '完成率 {progress}%，完成情况。',
      placeholder: '把数字摆出来胜过千言万语…',
    },
    {
      heading: '下一步计划',
      guide: '基于这次经验，下一阶段做什么？',
      placeholder: '从「想」落到「做」…',
    },
  ],
};

/** 框架 2：21 天习惯复盘（category=habit, icon=CalendarDays）。 */
const FW_HABIT: Framework = {
  id: 'fw_habit',
  name: '21 天习惯复盘',
  description: '记录一个习惯从养成到稳定的过程。',
  category: 'habit',
  icon: 'CalendarDays',
  builtin: true,
  useCount: 0,
  createdAt: BUILTIN_FRAMEWORK_TIME,
  updatedAt: BUILTIN_FRAMEWORK_TIME,
  sections: [
    {
      heading: '习惯定义',
      guide: '想养成的具体习惯是什么？触发场景？',
      placeholder: '越具体越好——"读 10 页书"比"多读书"强 10 倍…',
    },
    {
      heading: '21 天打卡记录',
      guide: '完成情况 / 间断原因。',
      placeholder: '贴一张打卡表 + 一段连续 / 间断的叙述…',
    },
    {
      heading: '体感变化',
      guide: '第 7 / 14 / 21 天分别有什么不同？',
      placeholder: '身体、精神、时间感…',
    },
    {
      heading: '关键转折点',
      guide: '哪一刻开始感觉「它成了习惯」？',
      placeholder: '也许是某天忘了刻意去做…',
    },
    {
      heading: '下一周期',
      guide: '继续？还是叠加新习惯？',
      placeholder: '有节奏的迭代胜过一步到位…',
    },
  ],
};

/** 框架 3：读书笔记（category=note, icon=BookOpen）。 */
const FW_NOTE: Framework = {
  id: 'fw_note',
  name: '读书笔记',
  description: '结构化记录一本书的核心与启发。',
  category: 'note',
  icon: 'BookOpen',
  builtin: true,
  useCount: 0,
  createdAt: BUILTIN_FRAMEWORK_TIME,
  updatedAt: BUILTIN_FRAMEWORK_TIME,
  sections: [
    {
      heading: '一句话总结',
      guide: '用一句话向朋友介绍这本书。',
      placeholder: '如果只能说 1 句，会说什么？',
    },
    {
      heading: '核心论点',
      guide: '作者最想传达的 3 个观点是什么？',
      placeholder: '不是摘抄，是你的转述…',
    },
    {
      heading: '我的共鸣',
      guide: '哪些段落让你停下来思考？',
      placeholder: '贴原文 + 写你为什么被打动…',
    },
    {
      heading: '行动启发',
      guide: '读完后你会做一件什么事？',
      placeholder: '落到行动上，知识才算消化了…',
    },
    {
      heading: '推荐指数',
      guide: '⭐⭐⭐⭐⭐ + 推荐人群。',
      placeholder: '诚实评分 + 写给谁看…',
    },
  ],
};

/** 框架 4：月度总结（category=summary, icon=BarChart3）。 */
const FW_SUMMARY: Framework = {
  id: 'fw_summary',
  name: '月度总结',
  description: '每月一次的总览：数据、亮点、教训、下月目标。',
  category: 'summary',
  icon: 'BarChart3',
  builtin: true,
  useCount: 0,
  createdAt: BUILTIN_FRAMEWORK_TIME,
  updatedAt: BUILTIN_FRAMEWORK_TIME,
  sections: [
    {
      heading: '本月关键数据',
      guide: '完成计划数 / 发布博客数 / 关键里程碑。',
      placeholder: '数字 + 一句话点评…',
    },
    {
      heading: '最重要的事',
      guide: '本月最有价值的 3 件事。',
      placeholder: '不一定是最大的事，但一定是最有杠杆的…',
    },
    {
      heading: '最大教训',
      guide: '踩过的一个坑 / 学到的一个道理。',
      placeholder: '教训比经验更值钱…',
    },
    {
      heading: '下月目标',
      guide: '下个月最重要的 3 件事。',
      placeholder: '目标要小到不会吓到自己…',
    },
    {
      heading: '自我对话',
      guide: '给 1 个月后的自己一句话。',
      placeholder: '对未来的你说一句真心话…',
    },
  ],
};

/** 全部内置框架（顺序固定，幂等写入）。 */
export const BUILTIN_FRAMEWORKS: Framework[] = [
  FW_REVIEW,
  FW_HABIT,
  FW_NOTE,
  FW_SUMMARY,
];

/**
 * 幂等种子写入。
 *
 * 流程：
 * 1. 查 `meta.seeded`，若为 true 直接 return
 * 2. 事务内 bulkPut 4 套框架 + 写 meta 标记
 *
 * 多次并发调用安全：Dexie 事务串行化 + `bulkPut` 覆盖语义。
 */
export async function seedIfNeeded(db: PlanoteDB): Promise<void> {
  const flag = await db.meta.get('seeded');
  if (flag?.value === true) return;

  await db.transaction('rw', db.frameworks, db.meta, async () => {
    await db.frameworks.bulkPut(BUILTIN_FRAMEWORKS);
    await db.meta.put({ key: 'seeded', value: true });
  });
}

/**
 * 幂等确保文件夹基础设施就绪（V1.2 F1）。
 *
 * 1. 若不存在根文件夹（「未分类」），创建之。
 * 2. 回填历史博客缺失的 `folderId` → 统一指向 ROOT_FOLDER_ID
 *    （保证 `Blog.folderId` 永不为 null）。
 * 3. 重算根文件夹 blogCount 缓存。
 *
 * 与 `seedIfNeeded` 同样 fire-and-forget、可重复调用。
 */
export async function ensureFolders(db: PlanoteDB): Promise<void> {
  await db.transaction('rw', db.folders, db.blogs, async () => {
    const root = await db.folders.get(ROOT_FOLDER_ID);
    if (!root) {
      const now = new Date().toISOString();
      await db.folders.put({
        id: ROOT_FOLDER_ID,
        name: ROOT_FOLDER_NAME,
        type: 'root',
        parentId: '',
        depth: 0,
        order: 0,
        blogCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 回填缺失 folderId 的历史博客
    // 用 put 而非 update：规避 Dexie UpdateSpec 对递归 TiptapJSON 的 TS2615
    const allBlogs = await db.blogs.toArray();
    for (const b of allBlogs) {
      if (!b.folderId) {
        await db.blogs.put({ ...b, folderId: ROOT_FOLDER_ID });
      }
    }

    // 重算根目录缓存（含回填后的全部未分类博客）
    const rootCount = allBlogs.filter(
      (b) => (b.folderId ?? ROOT_FOLDER_ID) === ROOT_FOLDER_ID,
    ).length;
    await db.folders.update(ROOT_FOLDER_ID, { blogCount: rootCount });
  });
}
