/**
 * Prompt 模板统一入口
 */

export { buildTemplatePrompt } from './templatePrompt';
export type { TemplateGenerateInput, ReferenceBlog } from './templatePrompt';

export { buildStyleAnalysisPrompt, buildImitatePrompt } from './imitatePrompt';
export type { StyleAnalysisInput, ImitateGenerateInput } from './imitatePrompt';

export { buildPolishPrompt } from './polishPrompt';
export type { PolishGenerateInput, PolishStyle, PolishLength } from './polishPrompt';

export { buildRewritePrompt } from './rewritePrompt';
export type { RewriteInput } from './rewritePrompt';
