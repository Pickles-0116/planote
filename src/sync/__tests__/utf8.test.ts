/**
 * UTF-8 安全 base64 编解码测试
 *
 * 回归真机报错：`Failed to execute 'btoa' on 'Window': The string to be
 * encoded contains characters outside of the Latin1 range.`
 *
 * 覆盖：
 * - utf8ToBase64 / base64ToUtf8 对中文往返一致
 * - 混合字符（中文 + emoji + HTML 特殊符号 `<>&"`）
 * - 通过 fake fetch 走 GitHubBackend.uploadSnapshot → downloadSnapshot
 *   全链路：上传含中文的 state.json，下载回来内容一致
 */

import { describe, it, expect } from 'vitest';
import { utf8ToBase64, base64ToUtf8 } from '../utils';
import { GitHubBackend } from '../github';
import { DEFAULT_SYNC_CONFIG } from '@/db/sync/types';
import type { SyncConfig } from '@/db/sync/types';

const config: SyncConfig = {
  ...DEFAULT_SYNC_CONFIG,
  repo: 'Pickles-0116/planote-warehouse',
  branch: 'main',
  token: 'test-token',
  directory: 'sync',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 安装 fake fetch 模拟 GitHub Contents API，返回恢复函数。 */
function installFakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => handler(String(input), init ?? {});
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe('utf8ToBase64 / base64ToUtf8', () => {
  it('中文快照往返后与原字符串一致', () => {
    const original = JSON.stringify({
      formatVersion: 1,
      generatedAt: '2026-07-31T10:00:00Z',
      tables: {
        plans: [{ id: 'plan01', title: '我的阅读计划', status: 'doing' }],
        blogs: [{ id: 'blog01', title: 'AI 工具测评', status: 'draft' }],
      },
      tombstones: [],
    });

    const encoded = utf8ToBase64(original);
    const decoded = base64ToUtf8(encoded);

    expect(decoded).toBe(original);
  });

  it('混合字符（中文 + emoji + HTML 特殊符号 `<>&"`）往返一致', () => {
    const original =
      '你好，世界 👋 标题「测试 <plan>&\'x"y」 引用 &amp; 引号 " 尖括号 <>';

    const encoded = utf8ToBase64(original);
    const decoded = base64ToUtf8(encoded);

    expect(decoded).toBe(original);
  });

  it('btoa 直接编码中文会抛错，而 utf8ToBase64 不抛（回归根因）', () => {
    const chinese = '我的阅读计划';

    expect(() => btoa(chinese)).toThrow();
    expect(() => utf8ToBase64(chinese)).not.toThrow();
  });

  it('空字符串往返一致', () => {
    expect(base64ToUtf8(utf8ToBase64(''))).toBe('');
  });
});

describe('GitHubBackend 中文快照全链路（分片协议 v1.3-CloudSync-Chunked）', () => {
  it('上传含中文的快照 → 下载回来内容一致（含 emoji 与特殊符号）', async () => {
    const stateJson = JSON.stringify({
      formatVersion: 1,
      generatedAt: '2026-07-31T12:00:00Z',
      tables: {
        plans: [
          { id: 'plan01', title: '暑假阅读计划 📚', status: 'doing', updatedAt: '2026-07-31T11:00:00Z' },
          { id: 'plan02', title: '博客选题 <技术>&"测评"', status: 'draft', updatedAt: '2026-07-30T09:00:00Z' },
        ],
        items: [
          { id: 'item01', planId: 'plan01', title: '读完《三体》', checked: false, order: 1 },
        ],
        tags: [{ id: 'tag01', name: '中文标签', color: '#3B82F6', usageCount: 2 }],
        blogs: [{ id: 'blog01', title: 'AI 时代的写作 ✍️', status: 'draft', tagIds: ['tag01'] }],
      },
      tombstones: [],
    });

    // 模拟 GitHub：每个 PUT 都存下来，GET 返回同样的 base64
    const storedFiles = new Map<string, { content: string; sha: string }>();
    let shaCounter = 1;

    const restore = installFakeFetch((url, init) => {
      const method = init.method;
      // 去掉 query string 再匹配
      const cleanUrl = url.split('?')[0]!;
      // PUT chunks/chunk-*.json 或 manifest.json
      const chunkMatch = cleanUrl.match(/\/contents\/sync\/chunks\/(chunk-[^.]+|manifest)\.json$/);
      if (method === 'PUT' && chunkMatch) {
        const body = JSON.parse(String(init.body)) as { content: string };
        const path = chunkMatch[1]!;
        const sha = `sha-${shaCounter++}`;
        storedFiles.set(path, { content: body.content, sha });
        return jsonResponse(201, { content: { sha } });
      }
      // GET chunks/*.json
      if (method === 'GET' && chunkMatch) {
        const path = chunkMatch[1]!;
        const stored = storedFiles.get(path);
        if (!stored) return jsonResponse(404, { message: 'Not Found' });
        return jsonResponse(200, {
          type: 'file',
          name: `${path}.json`,
          path: `sync/chunks/${path}.json`,
          sha: stored.sha,
          content: stored.content,
          encoding: 'base64',
          size: stored.content.length,
        });
      }
      // 老 state.json 不存在（404）—— 让 readExtendedVersion 走纯新协议路径
      if (method === 'GET' && cleanUrl.endsWith('/contents/sync/state.json')) {
        return jsonResponse(404, { message: 'Not Found' });
      }
      throw new Error(`未预期的请求: ${method} ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);

      const upload = await backend.uploadSnapshot(stateJson, '');
      expect(upload.newVersion).toMatch(/^sha-/);

      const download = await backend.downloadSnapshot();
      expect(download.version).toBe(upload.newVersion);
      // 下载回来仍是完整快照（合并后），内容应与上传一致
      const parsed = JSON.parse(download.data) as typeof JSON.parse extends never ? never : { tables: Record<string, unknown[]>; tombstones: unknown[] };
      expect(parsed.tables.plans).toHaveLength(2);
      expect((parsed.tables.plans[0] as { title: string }).title).toBe('暑假阅读计划 📚');
      expect(parsed.tables.blogs).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('下载的 base64 载荷包含多字节字符也能还原为 UTF-8（不产生乱码）', async () => {
    const title = '多字节载荷测试 🔥';
    // 构造一个有效分片 manifest
    const chunkJson = JSON.stringify({ tables: { plans: [{ id: 'p1', title }] } });
    const chunkBase64 = utf8ToBase64(chunkJson);
    const manifestJson = JSON.stringify({
      formatVersion: 2,
      generatedAt: '2026-08-01T00:00:00Z',
      chunks: {
        'chunk-0': { sha: 'chunk-sha', size: chunkBase64.length, tables: ['plans'] },
      },
      tombstoneChunk: 'chunk-tombstones',
      tombstoneSha: 'tomb-sha',
      tombstoneSize: 50,
    });
    const manifestBase64 = utf8ToBase64(manifestJson);
    const tombJson = JSON.stringify({ tombstones: [] });
    const tombBase64 = utf8ToBase64(tombJson);

    const restore = installFakeFetch((url) => {
      const clean = url.split('?')[0]!;
      if (clean.endsWith('/contents/sync/chunks/manifest.json')) {
        return jsonResponse(200, {
          type: 'file',
          name: 'manifest.json',
          path: 'sync/chunks/manifest.json',
          sha: 'manifest-sha',
          content: manifestBase64,
          encoding: 'base64',
          size: manifestBase64.length,
        });
      }
      if (clean.endsWith('/contents/sync/chunks/chunk-0.json')) {
        return jsonResponse(200, {
          type: 'file',
          name: 'chunk-0.json',
          path: 'sync/chunks/chunk-0.json',
          sha: 'chunk-sha',
          content: chunkBase64,
          encoding: 'base64',
          size: chunkBase64.length,
        });
      }
      if (clean.endsWith('/contents/sync/chunks/chunk-tombstones.json')) {
        return jsonResponse(200, {
          type: 'file',
          name: 'chunk-tombstones.json',
          path: 'sync/chunks/chunk-tombstones.json',
          sha: 'tomb-sha',
          content: tombBase64,
          encoding: 'base64',
          size: tombBase64.length,
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      const result = await backend.downloadSnapshot();
      // 合并后内容应包含原始 title
      expect(result.data).toContain(title);
      expect(result.data).not.toContain('å');
    } finally {
      restore();
    }
  });
});
