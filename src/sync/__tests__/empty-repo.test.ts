/**
 * GitHubBackend 空仓库自愈测试（v1.3-CloudSync-Chunked 适配）
 *
 * v1.3-CloudSync-Chunked 起，上传走分片路径：PUT manifest.json + 多个 chunk。
 * 空仓库自愈仍然由 retryWithEmptyRepoInit 包装：
 * 第一次任意一个 PUT 失败（REPO_EMPTY）→ PUT .gitkeep 初始化 → 重试
 * → 第二次所有 PUT 全部成功。
 *
 * 验证：
 * - 空仓库时自动 PUT .gitkeep 初始化并重试上传成功
 * - 初始化后上传仍失败则重试耗尽并抛 REPO_EMPTY
 * - 409 Git Repository is empty 同样识别为空仓库并自愈
 * - uploadAttachment 首次上传同样触发空仓库自愈
 * - 初始化请求同样带 Authorization，body 不含 token
 *
 * 不触碰实际 GitHub API（全 mock）。
 */

import { describe, it, expect } from 'vitest';
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

interface RecordedCall {
  method: string;
  url: string;
  body?: Record<string, string>;
  headers: Record<string, string>;
}

type FakeHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

function installFakeFetch(handler: FakeHandler): {
  calls: RecordedCall[];
  restore: () => void;
} {
  const calls: RecordedCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    const recorded: RecordedCall = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url,
      headers: (init?.headers as Record<string, string>) ?? {},
    };
    if (init?.body != null) {
      try {
        recorded.body = JSON.parse(String(init.body)) as Record<string, string>;
      } catch {
        // 忽略
      }
    }
    calls.push(recorded);
    return handler(url, init ?? {});
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function okShaResponse(sha: string): Response {
  return jsonResponse(201, { content: { sha } });
}

/** 判断 url 是不是 chunks/manifest.json（容忍 ?ref=...）。 */
function isManifestPut(url: string): boolean {
  return url.split('?')[0]!.endsWith('/contents/sync/chunks/manifest.json');
}

/** 判断 url 是不是某个 chunk（容忍 ?ref=...）。 */
function isChunkPut(url: string): boolean {
  return url.split('?')[0]!.includes('/contents/sync/chunks/chunk-');
}

describe('GitHubBackend 空仓库自愈（分片协议）', () => {
  it('空仓库时自动 PUT .gitkeep 初始化并重试上传成功', async () => {
    // 第一次任何 PUT 都返回 REPO_EMPTY；初始化后所有 PUT 都成功
    let initDone = false;
    const fake = installFakeFetch((url, init) => {
      if (init.method === 'PUT' && url.endsWith('/contents/sync/.gitkeep')) {
        initDone = true;
        return okShaResponse('gitkeep-sha');
      }
      // GET manifest / 老 state.json 在 init 前 404（文件不存在）
      if (init.method === 'GET' && (isManifestPut(url) || url.split('?')[0]!.endsWith('/contents/sync/state.json'))) {
        return jsonResponse(404, { message: 'Not Found' });
      }
      if (init.method === 'PUT' && (isManifestPut(url) || isChunkPut(url))) {
        if (!initDone) {
          return jsonResponse(422, {
            message: 'Git Repository is empty. Initial commit required.',
          });
        }
        return okShaResponse('sha-after-init');
      }
      throw new Error(`未预期的请求: ${init.method} ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      const result = await backend.uploadSnapshot('{"a":1}', '');

      expect(result.newVersion).toMatch(/^sha-/);
      // 初始化请求只发一次
      const initCall = fake.calls.find((c) =>
        c.url.endsWith('/contents/sync/.gitkeep'),
      );
      expect(initCall?.method).toBe('PUT');
      expect(initCall?.body?.message).toBe('sync: initialize sync directory');
      expect(initCall?.body?.branch).toBe('main');
      expect(initCall?.headers.Authorization).toBe('Bearer test-token');
      expect(JSON.stringify(initCall?.body)).not.toContain('test-token');
    } finally {
      fake.restore();
    }
  });

  it('初始化后上传仍失败则重试耗尽并抛 REPO_EMPTY', async () => {
    const fake = installFakeFetch((url, init) => {
      if (url.endsWith('/contents/sync/.gitkeep')) {
        return okShaResponse('gitkeep-sha');
      }
      // GET manifest / state.json 返回 404
      if (init.method === 'GET' && (isManifestPut(url) || url.split('?')[0]!.endsWith('/contents/sync/state.json'))) {
        return jsonResponse(404, { message: 'Not Found' });
      }
      // 任何其他 PUT 都返回 REPO_EMPTY（模拟初始化后仍失败）
      return jsonResponse(422, {
        message: 'Git Repository is empty. Initial commit required.',
      });
    });

    try {
      const backend = new GitHubBackend(config);
      await expect(backend.uploadSnapshot('{"a":1}', '')).rejects.toMatchObject({
        code: 'REPO_EMPTY',
      });
    } finally {
      fake.restore();
    }
  });

  it('409 Git Repository is empty 同样识别为空仓库并自愈', async () => {
    let initDone = false;
    const fake = installFakeFetch((url, init) => {
      if (url.endsWith('/contents/sync/.gitkeep')) {
        initDone = true;
        return okShaResponse('gitkeep-sha');
      }
      if (init.method === 'GET' && (isManifestPut(url) || url.split('?')[0]!.endsWith('/contents/sync/state.json'))) {
        return jsonResponse(404, { message: 'Not Found' });
      }
      if (isManifestPut(url) || isChunkPut(url)) {
        if (!initDone) {
          return jsonResponse(409, {
            message: 'Git Repository is empty',
          });
        }
        return okShaResponse('sha-after-init');
      }
      throw new Error(`unexpected ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      const result = await backend.uploadSnapshot('{"a":1}', '');
      expect(result.newVersion).toMatch(/^sha-/);
    } finally {
      fake.restore();
    }
  });

  it('uploadAttachment 首次上传同样触发空仓库自愈', async () => {
    let initDone = false;
    const fake = installFakeFetch((url) => {
      if (url.endsWith('/contents/sync/.gitkeep')) {
        initDone = true;
        return okShaResponse('gitkeep-sha');
      }
      if (url.includes('/contents/sync/attachments/')) {
        if (!initDone) {
          return jsonResponse(422, {
            message: 'Git Repository is empty. Initial commit required.',
          });
        }
        return jsonResponse(201, { content: { sha: 'attachment-sha' } });
      }
      throw new Error(`unexpected ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      await backend.uploadAttachment('att-1', new Blob(['hello']));
      // 验证初始化发生过
      expect(initDone).toBe(true);
    } finally {
      fake.restore();
    }
  });

  it('普通 422（含 sha 的版本冲突）仍映射为 VERSION_CONFLICT 而非 REPO_EMPTY', async () => {
    const fake = installFakeFetch((url) => {
      if (isManifestPut(url)) {
        return jsonResponse(422, { message: 'sha does not match' });
      }
      throw new Error(`unexpected ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      await expect(backend.uploadSnapshot('{"a":1}', 'stale-sha')).rejects.toMatchObject({
        code: 'VERSION_CONFLICT',
      });
    } finally {
      fake.restore();
    }
  });

  it('初始化后所有 PUT 成功，最终返回 manifest 的 SHA', async () => {
    let initDone = false;
    const fake = installFakeFetch((url, init) => {
      if (url.endsWith('/contents/sync/.gitkeep')) {
        initDone = true;
        return okShaResponse('gitkeep-sha');
      }
      // GET manifest / state.json 之前文件不存在 → 404
      if (init.method === 'GET' && (isManifestPut(url) || url.split('?')[0]!.endsWith('/contents/sync/state.json'))) {
        return jsonResponse(404, { message: 'Not Found' });
      }
      // PUT 在初始化前返回空仓库错误
      if (!initDone && (isManifestPut(url) || isChunkPut(url))) {
        return jsonResponse(422, {
          message: 'Git Repository is empty. Initial commit required.',
        });
      }
      if (isManifestPut(url)) return okShaResponse('manifest-final-sha');
      if (isChunkPut(url)) return okShaResponse('chunk-final-sha');
      throw new Error(`unexpected ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      const result = await backend.uploadSnapshot('{"a":1}', '');
      expect(result.newVersion).toBe('manifest-final-sha');
    } finally {
      fake.restore();
    }
  });
});
