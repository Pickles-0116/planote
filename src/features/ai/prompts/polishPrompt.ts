/**
 * 自由润色模式 Prompt 模板 v1.0
 *
 * 将用户的原始素材/笔记/想法整理为结构清晰的博客文章。
 */

/** 输出风格预设。 */
export type PolishStyle = 'auto' | 'concise' | 'detailed' | 'storytelling' | 'listicle';

/** 输出长度预设。 */
export type PolishLength = 'auto' | 'short' | 'medium' | 'long';

const STYLE_LABELS: Record<PolishStyle, string> = {
  auto: '',
  concise: '简洁精炼，去除冗余',
  detailed: '详细展开，充分论述',
  storytelling: '故事化叙述，有起承转合',
  listicle: '列表化组织，清晰易读',
};

const LENGTH_RANGES: Record<PolishLength, string> = {
  auto: '',
  short: '500-800',
  medium: '800-1500',
  long: '1500-3000',
};

export interface PolishGenerateInput {
  rawMaterial: string;
  style: PolishStyle;
  length: PolishLength;
}

export function buildPolishPrompt(input: PolishGenerateInput) {
  const styleReq = input.style !== 'auto' ? `\n- 风格：${STYLE_LABELS[input.style]}` : '';
  const lengthReq = input.length !== 'auto' ? `\n- 目标字数：${LENGTH_RANGES[input.length]} 字` : '';

  const system = `你是一位博客编辑。请将以下素材整理为一篇结构清晰、语言流畅的博客文章。

## 写作要求${styleReq}${lengthReq}

## 约束
- 保留素材的核心信息，不遗漏关键要点
- 严格基于用户提供的素材写作，不要编造不存在的数据
- 自行组织章节结构，使文章有清晰的逻辑脉络
- 如果素材中有数据，保留原始数据不要修改

## 输出格式
- 使用 Markdown 格式
- 博客标题使用 H1（# ）
- 章节标题使用 H2（## ）
- 段落之间空一行`;

  const user = `## 原始素材
${input.rawMaterial}

请将以上素材整理为博客文章：`;

  return { system, user };
}
