/**
 * GitHubBackend 空仓库自愈测试
 *
 * 用 fake fetch 模拟 GitHub Contents API，验证：
 * - 空仓库 PUT state.json 返回 422/409（Git Repository is empty）→
 *   自动 PUT {directory}/.gitkeep 初始化 → 重试上传成功，且只初始化一次
 * - 初始化请求同样带 Authorization，body 不含 token
 * - 初始化后仍失败时重试耗尽并抛 REPO_EMPTY
 * - 普通 422（含 sha 的版本冲突）仍映射为 VERSION_CONFLICT 而非 REPO_EMPTY
 * - uploadAttachment 首次上传同样触发空仓库自愈
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

/** 安装 fake fetch 并记录每次调用；返回恢复函数。 */
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
      recorded.body = JSON.parse(String(init.body)) as Record<string, string>;
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

/** 构造 JSON Response。 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function okShaResponse(sha: string): Response {
  return jsonResponse(201, { content: { sha } });
}

describe('GitHubBackend 空仓库自愈', () => {
  it('空仓库时自动 PUT .gitkeep 初始化并重试上传成功', async () => {
    let statePutCount = 0;
    let gitkeepPutCount = 0;

    const fake = installFakeFetch((url, init) => {
      if (init.method === 'PUT' && url.endsWith('/contents/sync/state.json')) {
        statePutCount++;
        if (statePutCount === 1) {
          // 典型空仓库响应：422 Git Repository is empty
          return jsonResponse(422, {
            message: 'Git Repository is empty. Initial commit required.',
          });
        }
        return okShaResponse('sha-after-init');
      }
      if (init.method === 'PUT' && url.endsWith('/contents/sync/.gitkeep')) {
        gitkeepPutCount++;
        return okShaResponse('gitkeep-sha');
      }
      throw new Error(`未预期的请求: ${init.method} ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      const result = await backend.uploadSnapshot('{"a":1}', '');

      expect(result.newVersion).toBe('sha-after-init');
      expect(statePutCount).toBe(2); // 首次失败 + 初始化后重试成功
      expect(gitkeepPutCount).toBe(1); // 只初始化一次

      const initCall = fake.calls.find((c) =>
        c.url.endsWith('/contents/sync/.gitkeep'),
      );
      expect(initCall?.method).toBe('PUT');
      expect(initCall?.body?.message).toBe('sync: initialize sync directory');
      expect(initCall?.body?.branch).toBe('main');
      // 安全红线：初始化请求同样带 Authorization，且 body 不含 token
      expect(initCall?.headers.Authorization).toBe('Bearer test-token');
      expect(JSON.stringify(initCall?.body)).not.toContain('test-token');
    } finally {
      fake.restore();
    }
  });

  it('初始化后上传仍失败则重试耗尽并抛 REPO_EMPTY', async () => {
    let statePutCount = 0;
    let gitkeepPutCount = 0;

    const fake = installFakeFetch((url, init) => {
      if (init.method === 'PUT' && url.endsWith('/contents/sync/state.json')) {
        statePutCount++;
        return jsonResponse(422, { message: 'Git Repository is empty.' });
      }
      if (init.method === 'PUT' && url.endsWith('/contents/sync/.gitkeep')) {
        gitkeepPutCount++;
        return okShaResponse('gitkeep-sha');
      }
      throw new Error(`未预期的请求: ${init.method} ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      await expect(backend.uploadSnapshot('{"a":1}', '')).rejects.toMatchObject({
        code: 'REPO_EMPTY',
      });
      // 初始 1 次 + 重试 MAX_EMPTY_REPO_RETRIES 次
      expect(statePutCount).toBe(3);
      expect(gitkeepPutCount).toBe(2);
    } finally {
      fake.restore();
    }
  });

  it('普通 422（含 sha 的版本冲突）仍映射为 VERSION_CONFLICT', async () => {
    const fake = installFakeFetch(() =>
      jsonResponse(422, { message: 'sha does not match our record' }),
    );

    try {
      const backend = new GitHubBackend(config);
      await expect(
        backend.uploadSnapshot('{"a":1}', 'stale-sha'),
      ).rejects.toMatchObject({
        code: 'VERSION_CONFLICT',
      });
      // 不触发空仓库初始化
      expect(fake.calls.filter((c) => c.url.includes('.gitkeep'))).toHaveLength(0);
    } finally {
      fake.restore();
    }
  });

  it('409 Git Repository is empty 同样识别为空仓库并自愈', async () => {
    let statePutCount = 0;

    const fake = installFakeFetch((url, init) => {
      if (init.method === 'PUT' && url.endsWith('/contents/sync/state.json')) {
        statePutCount++;
        if (statePutCount === 1) {
          return jsonResponse(409, {
            message: 'Git Repository is empty. Initial commit required',
          });
        }
        return okShaResponse('sha-after-409');
      }
      if (init.method === 'PUT' && url.endsWith('/contents/sync/.gitkeep')) {
        return okShaResponse('gitkeep-sha');
      }
      throw new Error(`未预期的请求: ${init.method} ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      const result = await backend.uploadSnapshot('{"a":1}', '');
      expect(result.newVersion).toBe('sha-after-409');
      expect(statePutCount).toBe(2);
    } finally {
      fake.restore();
    }
  });

  it('uploadAttachment 首次上传空仓库同样自愈', async () => {
    let attachPutCount = 0;

    const fake = installFakeFetch((url, init) => {
      if (
        init.method === 'PUT' &&
        url.includes('/contents/sync/attachments/')
      ) {
        attachPutCount++;
        if (attachPutCount === 1) {
          return jsonResponse(422, {
            message: 'Git Repository is empty. Initial commit required.',
          });
        }
        return okShaResponse('att-sha');
      }
      if (init.method === 'PUT' && url.endsWith('/contents/sync/.gitkeep')) {
        return okShaResponse('gitkeep-sha');
      }
      // uploadAttachment 内部 422 时的 GET 探测（文件不存在 → 404）
      if (init.method === 'GET') {
        return jsonResponse(404, { message: 'Not Found' });
      }
      throw new Error(`未预期的请求: ${init.method} ${url}`);
    });

    try {
      const backend = new GitHubBackend(config);
      await backend.uploadAttachment(
        'att-1',
        new Blob(['hello'], { type: 'text/plain' }),
      );
      expect(attachPutCount).toBe(2);
      expect(fake.calls.filter((c) => c.url.endsWith('.gitkeep'))).toHaveLength(1);
    } finally {
      fake.restore();
    }
  });
});
