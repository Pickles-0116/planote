import { describe, it, expect, vi } from 'vitest';

const chunks: string[] = [];

vi.mock('@/features/ai/adapters', () => ({
  getAdapter: () => ({
    // eslint-disable-next-line require-yield
    generateStream: async function* () {
      for (const c of chunks) yield c;
    },
  }),
}));

vi.mock('@/features/ai/stores/aiModelStore', () => ({
  useAIModelStore: {
    getState: () => ({
      getDefaultProfile: () => ({ id: 'p1', provider: 'openai', model: 'm', maxTokens: 100, baseUrl: '' }),
      getDecodedApiKey: () => 'k',
    }),
  },
}));

import { repairSkillMarkdown } from '../repairSkillMarkdown';
import { checkSkillMarkdown } from '../importSkills';

const GOOD = `---
name: agent-orchestrator
type: custom
folder: AI Agents
description: 编排多个 agent
---

正文 {{topic}}`;

function setStream(s: string[]) {
  chunks.length = 0;
  chunks.push(...s);
}

describe('repairSkillMarkdown thinking 剥离', () => {
  it('剥离 <think> 段', async () => {
    setStream(['<think>我先想一下', '格式应该是 frontmatter</think>\n', GOOD]);
    const out = await repairSkillMarkdown({ rawText: 'x', errorMessage: 'e' });
    expect(out).not.toMatch(/<\/?think(ing)?>/i);
    expect(out).toBe(GOOD);
    expect(checkSkillMarkdown(out).ok).toBe(true);
  });

  it('剥离 <thinking> 且去围栏', async () => {
    setStream([`<thinking>plan</thinking>\n\`\`\`markdown\n${GOOD}\n\`\`\``]);
    const out = await repairSkillMarkdown({ rawText: 'x', errorMessage: 'e' });
    expect(out).toBe(GOOD);
  });

  it('只有 thinking 时抛错', async () => {
    setStream(['<think>只想没写</think>']);
    await expect(repairSkillMarkdown({ rawText: 'x', errorMessage: 'e' })).rejects.toThrow('AI 整理结果为空');
  });

  it('未闭合 thinking 也不污染', async () => {
    setStream(['<think>没闭合的思考']);
    await expect(repairSkillMarkdown({ rawText: 'x', errorMessage: 'e' })).rejects.toThrow('AI 整理结果为空');
  });
});
