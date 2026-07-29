/**
 * 模板生成模式 Prompt 模板 v1.0
 *
 * 根据博客模板结构 + AI Prompt 参数 + 用户素材，组装 System/User Prompt。
 */

import type { BlogTemplate } from '@/types/domain';

/** 风格中文映射。 */
const STYLE_LABELS: Record<string, string> = {
  professional: '专业严谨',
  casual: '轻松随意',
  academic: '学术规范',
  narrative: '叙事故事',
  custom: '自定义',
};

const TONE_LABELS: Record<string, string> = {
  positive: '积极正向',
  neutral: '客观中性',
  reflective: '反思内省',
  custom: '自定义',
};

const AUDIENCE_LABELS: Record<string, string> = {
  self: '自己',
  team: '团队成员',
  public: '公开读者',
  custom: '自定义',
};

export interface ReferenceBlog {
  title: string;
  contentText: string;
}

export interface TemplateGenerateInput {
  template: BlogTemplate;
  sectionInputs: Record<string, string>;
  globalNotes?: string;
  specialRequirements?: string;
  /** 引用博客：作为素材来源（如把多篇博客总结为一篇周报）。 */
  referenceBlogs?: ReferenceBlog[];
}

export function buildTemplatePrompt(input: TemplateGenerateInput) {
  const { template, sectionInputs, globalNotes, specialRequirements, referenceBlogs } = input;
  const { aiParams, sections } = template;

  const styleDesc =
    aiParams.style === 'custom'
      ? aiParams.styleDescription ?? '自定义风格'
      : STYLE_LABELS[aiParams.style] ?? aiParams.style;

  const toneDesc =
    aiParams.tone === 'custom'
      ? '自定义语气'
      : TONE_LABELS[aiParams.tone] ?? aiParams.tone;

  const audienceDesc =
    aiParams.audience === 'custom'
      ? '自定义读者'
      : AUDIENCE_LABELS[aiParams.audience] ?? aiParams.audience;

  const sectionsText = sections
    .map((s, i) => `${i + 1}. ## ${s.heading}\n   引导：${s.guide}`)
    .join('\n\n');

  const sectionInputsText = Object.entries(sectionInputs)
    .filter(([, v]) => v.trim())
    .map(([heading, content]) => `- ${heading}：${content}`)
    .join('\n');

  // 引用博客素材：每篇截断 800 字避免超 token
  const refBlogsText =
    referenceBlogs && referenceBlogs.length > 0
      ? referenceBlogs
          .map((b, i) => {
            const text = b.contentText.length > 800 ? b.contentText.slice(0, 800) + '…' : b.contentText;
            return `### 博客${i + 1}：${b.title}\n${text}`;
          })
          .join('\n\n')
      : '';

  const refConstraint = refBlogsText
    ? '\n- 用户提供了参考博客，请充分阅读和综合这些博客的内容，提炼、归纳或引用其中的关键信息来撰写新博客\n- 参考博客中的具体数据、案例和观点应尽可能保留和引用'
    : '';

  const systemPrompt = `你是一位专业的博客写作助手。请根据以下模板结构和用户提供的素材，撰写一篇完整的博客文章。

## 写作要求
- 风格：${styleDesc}
- 语气：${toneDesc}
- 目标读者：${audienceDesc}
- 目标字数：${aiParams.minWords}-${aiParams.maxWords} 字

## 约束
- 严格基于用户提供的素材写作，不要编造不存在的数据、事件或引用${refConstraint}
- 如果素材中未提供具体数据，使用"某数据"等占位符而非虚构数字
- 保持段落连贯，避免空洞的填充语句

## 输出格式
- 使用 Markdown 格式
- 博客标题使用 H1（# ）
- 章节标题使用 H2（## ）
- 段落之间空一行`;

  const userPrompt = `## 博客结构
${sectionsText}

${refBlogsText ? `## 参考博客素材（${referenceBlogs!.length} 篇）\n${refBlogsText}\n` : ''}## 用户素材
${sectionInputsText || '（用户未提供具体章节素材，请根据结构和参考博客自由发挥）'}

${globalNotes ? `## 补充信息\n${globalNotes}` : ''}

${specialRequirements ? `## 特殊要求\n${specialRequirements}` : ''}

请根据以上信息撰写博客：`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
