/**
 * 风格仿写模式 Prompt 模板 v1.0
 *
 * 两步调用：
 * 1. 风格分析：从参考博客提取写作风格特征
 * 2. 基于风格生成：模仿风格 + 新素材 → 新博客
 */

export interface StyleAnalysisInput {
  /** 参考博客的纯文本内容（1-3 篇）。 */
  refBlogTexts: string[];
}

export function buildStyleAnalysisPrompt(input: StyleAnalysisInput) {
  const combined = input.refBlogTexts
    .map((text, i) => {
      // 截断到 8000 字
      const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n...(已截断)' : text;
      return `### 文章 ${i + 1}\n${truncated}`;
    })
    .join('\n\n');

  const system = `你是一位文本风格分析专家。请分析以下博客文章的写作风格特征。

## 分析维度
1. 句式节奏（长句/短句比例、段落长度）
2. 表达习惯（正式/口语化、常用句式）
3. 段落结构（段落平均长度、过渡方式）
4. 修辞手法（比喻/数据/故事等）
5. 常用词汇和语气词

## 输出
请以 JSON 格式输出风格特征摘要，包含以下字段：
{
  "sentenceRhythm": "句式节奏描述",
  "expressionStyle": "表达习惯描述",
  "paragraphStructure": "段落结构描述",
  "rhetoricDevices": "修辞手法描述",
  "vocabularyTone": "词汇和语气描述",
  "overallStyle": "整体风格概述"
}`;

  const user = `## 待分析文章\n\n${combined}\n\n请分析以上文章的写作风格：`;

  return { system, user };
}

export interface ImitateGenerateInput {
  /** 第一步输出的风格 JSON。 */
  styleProfile: string;
  /** 新博客主题。 */
  topic: string;
  /** 核心素材。 */
  keyPoints?: string;
  /** 可选叠加模板的章节结构。 */
  templateSections?: { heading: string; guide: string }[];
}

export function buildImitatePrompt(input: ImitateGenerateInput) {
  const sectionsText = input.templateSections
    ? `\n\n## 博客结构约束\n${input.templateSections.map((s, i) => `${i + 1}. ## ${s.heading} — ${s.guide}`).join('\n')}`
    : '';

  const system = `你是一位专业的博客写作助手。请模仿以下写作风格，撰写一篇新的博客文章。

## 参考风格特征
${input.styleProfile}

## 约束
- 严格基于用户提供的素材写作，不要编造不存在的数据
- 模仿参考风格但不要照搬原文内容
- 保持风格一致性的同时确保内容原创${sectionsText}

## 输出格式
- 使用 Markdown 格式
- 标题使用 H1，章节标题使用 H2
- 段落之间空一行`;

  const user = `## 新博客主题
${input.topic}

${input.keyPoints ? `## 核心素材\n${input.keyPoints}` : ''}

请根据以上主题和素材，模仿参考风格撰写博客：`;

  return { system, user };
}
