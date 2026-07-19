/**
 * 博客框架库预置数据（add-framework-drawer 增量）
 *
 * 设计动机：
 * - v1.0 Dexie 内置 4 套框架（给"从计划生成博客"用）——数量不够博客侧自选
 * - 博客编辑器需要一个独立的"写作起手"库，10 个常见场景，**只读**消费
 * - 预置与 Dexie 框架**隔离**（不写入 IndexedDB），通过 `toDexieFramework()`
 *   转换为临时 `Framework` 实例传给 `useApplyFramework.apply()`
 *
 * 与 Dexie 内置的关系：
 * - 部分 preset（如"项目复盘"）与 Dexie 4 套有语义重叠 → v1.0 允许 overlap
 * - v1.2 用户自定义框架时统一为单一来源
 */

import type { Framework, FrameworkCategory, ID } from '@/types/domain';

/** 框架章节（写作引导）。 */
export interface PresetSection {
  /** 章节标题（H2）。 */
  heading: string;
  /** 引导问题（辅助思考）。 */
  guide: string;
  /** 占位提示（编辑器空白段落显示）。 */
  placeholder: string;
}

/** 预置框架分类（比 FrameworkCategory 更宽，包含决策/分析）。 */
export type PresetCategory =
  | 'review'
  | 'note'
  | 'summary'
  | 'habit'
  | 'decision'
  | 'analysis';

/** 预置框架实体。 */
export interface PresetFramework {
  id: ID;
  /** 框架名（如 "项目复盘"）。 */
  name: string;
  /** 一句话描述。 */
  description: string;
  /** Lucide icon 名称（运行时用 ICON_MAP 解析）。 */
  icon: string;
  category: PresetCategory;
  /** 标签 chips（多对多）。 */
  tags: string[];
  sections: PresetSection[];
}

/** 把 PresetCategory 映射到现有 FrameworkCategory（4 值）。 */
const toFrameworkCategory = (c: PresetCategory): FrameworkCategory => {
  switch (c) {
    case 'review':
    case 'decision':
    case 'analysis':
      return 'review';
    case 'note':
      return 'note';
    case 'summary':
      return 'summary';
    case 'habit':
      return 'habit';
  }
};

/** 把 PresetFramework 转 Dexie Framework（传给 useApplyFramework）。 */
export const toDexieFramework = (preset: PresetFramework): Framework => ({
  id: preset.id,
  name: preset.name,
  description: preset.description,
  category: toFrameworkCategory(preset.category),
  icon: preset.icon,
  sections: preset.sections.map((s) => ({
    heading: s.heading,
    guide: s.guide,
    placeholder: s.placeholder,
  })),
  useCount: 0,
  builtin: true,
});

/** 预置框架列表（10 个，覆盖周/月/项目/读书/OKR/习惯/决策/学习/分析/回顾）。 */
export const FRAMEWORK_PRESETS: PresetFramework[] = [
  {
    id: 'fw_weekly_review',
    name: '周复盘',
    description: '每周一次，回顾本周目标、关键产出与下周计划。',
    icon: 'CalendarDays',
    category: 'summary',
    tags: ['工作', '学习', '生活'],
    sections: [
      { heading: '本周关键产出', guide: '这周完成了哪些重要的事？', placeholder: '列出 3-5 项关键产出' },
      { heading: '数据指标', guide: '用数字衡量进度', placeholder: '如：发布文章 3 篇、跑步 20km' },
      { heading: '踩过的坑', guide: '遇到了什么困难？如何解决？', placeholder: '记录具体的坑与应对' },
      { heading: '下周重点', guide: '下周最重要的 3 件事是什么？', placeholder: '明确下周优先级' },
    ],
  },
  {
    id: 'fw_project_review',
    name: '项目复盘',
    description: '项目结束后总结目标、过程、结果与改进。',
    icon: 'GitPullRequest',
    category: 'review',
    tags: ['工作', '项目'],
    sections: [
      { heading: '项目目标', guide: '原定目标是什么？实际达成多少？', placeholder: '复述立项时的目标' },
      { heading: '关键过程', guide: '过程中做了什么关键决策？', placeholder: '里程碑与关键节点' },
      { heading: '结果与影响', guide: '最终交付与业务影响', placeholder: '数据 + 用户反馈' },
      { heading: '经验与教训', guide: '如果重来一次会怎么做？', placeholder: '可迁移的认知' },
    ],
  },
  {
    id: 'fw_reading_note',
    name: '读书笔记',
    description: '记录一本书的核心观点、个人启发与行动项。',
    icon: 'BookOpen',
    category: 'note',
    tags: ['学习', '笔记'],
    sections: [
      { heading: '核心观点', guide: '作者最重要的主张是什么？', placeholder: '3-5 条核心观点' },
      { heading: '个人启发', guide: '哪部分让你最有共鸣？', placeholder: '联系自身经历的反思' },
      { heading: '行动项', guide: '读完后你打算做什么？', placeholder: '可执行的 1-3 件事' },
    ],
  },
  {
    id: 'fw_okr',
    name: 'OKR',
    description: '目标与关键结果对齐，明确衡量指标。',
    icon: 'Target',
    category: 'review',
    tags: ['工作', '目标'],
    sections: [
      { heading: 'Objective（目标）', guide: '一个鼓舞人心的定性目标', placeholder: '如：打造行业最佳编辑体验' },
      { heading: 'Key Results（关键结果）', guide: '3-5 个可量化的结果', placeholder: 'KR1：NPS 从 30 提升到 50' },
      { heading: '进度跟踪', guide: '当前完成度与障碍', placeholder: '进度百分比 + 卡点' },
      { heading: '下阶段计划', guide: '下个周期的 KR 调整', placeholder: '新增 / 调整 / 保留' },
    ],
  },
  {
    id: 'fw_monthly_goal',
    name: '月度目标',
    description: '月初规划 + 月末复盘的双时点模板。',
    icon: 'CalendarRange',
    category: 'summary',
    tags: ['工作', '生活', '目标'],
    sections: [
      { heading: '本月核心目标', guide: '1-3 个最重要的目标', placeholder: '聚焦而非全包' },
      { heading: '关键里程碑', guide: '每周的检查点', placeholder: 'W1：... W2：... W3：... W4：...' },
      { heading: '资源与风险', guide: '需要什么支持？有什么风险？', placeholder: '人/钱/时间 + 风险预案' },
      { heading: '复盘与下月衔接', guide: '完成度 + 经验沉淀', placeholder: '本月做对的事 + 下月接力' },
    ],
  },
  {
    id: 'fw_habit_21day',
    name: '21 天习惯',
    description: '21 天养成一个新习惯的每日打卡记录。',
    icon: 'Repeat',
    category: 'habit',
    tags: ['生活', '习惯'],
    sections: [
      { heading: '习惯定义', guide: '要养成的具体习惯是什么？', placeholder: '如：每天 30 分钟阅读' },
      { heading: '触发器与奖励', guide: '什么触发这个习惯？完成后奖励自己什么？', placeholder: '触发场景 + 奖励设计' },
      { heading: '21 天记录', guide: 'Day 1 到 Day 21 的打卡', placeholder: '可附表或列表' },
      { heading: '复盘', guide: '坚持下来了多少天？卡点在哪？', placeholder: '完成率 + 反思' },
    ],
  },
  {
    id: 'fw_decision_log',
    name: '决策日志',
    description: '记录重要决策的背景、选项、推理与结果。',
    icon: 'GitBranch',
    category: 'decision',
    tags: ['工作', '思考'],
    sections: [
      { heading: '决策背景', guide: '为什么需要做这个决策？', placeholder: '当前状况 + 触发原因' },
      { heading: '候选方案', guide: '考虑了哪些选项？', placeholder: '至少 2-3 个候选' },
      { heading: '推理过程', guide: '最终选择哪个？为什么？', placeholder: '权衡逻辑 + 关键假设' },
      { heading: '预期与实际', guide: '决策后结果如何？', placeholder: '事后回顾（可后续补）' },
    ],
  },
  {
    id: 'fw_learning_note',
    name: '学习笔记',
    description: '学习一门新技能/知识的结构化记录。',
    icon: 'GraduationCap',
    category: 'note',
    tags: ['学习'],
    sections: [
      { heading: '学习目标', guide: '想学到什么程度？', placeholder: '明确产出标准' },
      { heading: '学习路径', guide: '用了什么资源？顺序如何？', placeholder: '书/课/项目 + 时间分配' },
      { heading: '关键概念', guide: '最核心的几个概念是什么？', placeholder: '用自己的话解释' },
      { heading: '实践与输出', guide: '做了什么项目或笔记？', placeholder: '链接到代码 / 文档' },
    ],
  },
  {
    id: 'fw_problem_analysis',
    name: '问题分析',
    description: '面对复杂问题时的根因分析与解决框架。',
    icon: 'Search',
    category: 'analysis',
    tags: ['工作', '思考'],
    sections: [
      { heading: '问题陈述', guide: '问题是什么？影响范围多大？', placeholder: '明确现象 + 量化影响' },
      { heading: '根因分析', guide: '为什么会发生？5 Whys / 鱼骨图', placeholder: '逐层追问至根因' },
      { heading: '解决方案', guide: '可选方案 + 各自权衡', placeholder: '方案对比矩阵' },
      { heading: '执行与验证', guide: '方案如何落地？效果如何衡量？', placeholder: '里程碑 + 验证指标' },
    ],
  },
  {
    id: 'fw_retrospective',
    name: '回顾模板',
    description: '通用回顾模板：Keep / Drop / Try / Problem。',
    icon: 'RotateCcw',
    category: 'review',
    tags: ['工作', '团队', '生活'],
    sections: [
      { heading: 'Keep（保持）', guide: '哪些做法值得继续？', placeholder: '列出做得好的部分' },
      { heading: 'Drop（停止）', guide: '哪些做法应该停止？', placeholder: '明确低效/无效的事' },
      { heading: 'Try（尝试）', guide: '下次想尝试什么新做法？', placeholder: '具体可执行的尝试' },
      { heading: 'Problem（问题）', guide: '最大的卡点是什么？', placeholder: '聚焦 1-2 个核心问题' },
    ],
  },
];

/** 所有预置 tag 集合（去重 + 字母排序）。 */
export const ALL_PRESET_TAGS: string[] = Array.from(
  new Set(FRAMEWORK_PRESETS.flatMap((fw) => fw.tags)),
).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
