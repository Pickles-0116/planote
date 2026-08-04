/**
 * GitHubBackend 远端 state.json 超大文件测试（v1.3-CloudSync-Trim 二次修复）
 *
 * 复现真实场景：远端 state.json 体积 ~1.4MB，GitHub Contents API 返回 metadata
 * 但 content 字段为空（encoding: "none"）。原代码会抛 StorageBackendError
 * 'INVALID_PAYLOAD'，被错误归类为 FORMAT_MISMATCH 误导用户。
 *
 * 修复后应该抛 RemoteSnapshotTooLargeError，mapToSyncError 映射为 PAYLOAD_TOO_LARGE。
 */

import { describe, it, expect } from 'vitest';
import { GitHubBackend } from '../github';
import { DEFAULT_SYNC_CONFIG } from '@/db/sync/types';
import type { SyncConfig } from '@/db/sync/types';
import { RemoteSnapshotTooLargeError } from '../size-guard';
import { mapToSyncError } from '../sync-error';

const config: SyncConfig = {
  ...DEFAULT_SYNC_CONFIG,
  repo: 'Pickles-0116/planote-warehouse',
  branch: 'main',
  token: 'test-token',
  directory: 'sync',
};

function installFakeFetch(handler: (url: string) => Response | Promise<Response>): {
  restore: () => void;
} {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => handler(String(input));
  return { restore: () => (globalThis.fetch = original) };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GitHubBackend 远端 state.json 超大文件（content 为空）', () => {
  it('size > 1MB 且 content 为空时抛 RemoteSnapshotTooLargeError', async () => {
    const fake = installFakeFetch((url) => {
      if (url.includes('/contents/sync/state.json')) {
        return jsonResponse(200, {
          type: 'file',
          name: 'state.json',
          path: 'sync/state.json',
          sha: 'oversized-sha',
          // 关键：content 为空 + encoding 为 "none"，模拟 GitHub 对超大文件的处理
          content: '',
          encoding: 'none',
          size: 1_379_615, // 用户的真实文件大小
        });
      }
      return jsonResponse(404, { message: 'Not Found' });
    });

    try {
      const backend = new GitHubBackend(config);
      await expect(backend.downloadSnapshot()).rejects.toBeInstanceOf(
        RemoteSnapshotTooLargeError,
      );
    } finally {
      fake.restore();
    }
  });

  it('远端超大错误 → mapToSyncError → PAYLOAD_TOO_LARGE', async () => {
    const fake = installFakeFetch((url) => {
      if (url.includes('/contents/sync/state.json')) {
        return jsonResponse(200, {
          type: 'file',
          name: 'state.json',
          path: 'sync/state.json',
          sha: 'x',
          content: '',
          encoding: 'none',
          size: 1_379_615,
        });
      }
      return jsonResponse(404, { message: 'Not Found' });
    });

    try {
      const backend = new GitHubBackend(config);
      try {
        await backend.downloadSnapshot();
        expect.fail('应该抛错');
      } catch (err) {
        const syncErr = mapToSyncError(err);
        expect(syncErr.type).toBe('PAYLOAD_TOO_LARGE');
        expect(syncErr.userMessage).toMatch(/删除/);
      }
    } finally {
      fake.restore();
    }
  });

  it('content 为空但 size ≤ 1MB（其他编码问题）仍走 INVALID_PAYLOAD 路径', async () => {
    const fake = installFakeFetch((url) => {
      if (url.includes('/contents/sync/state.json')) {
        return jsonResponse(200, {
          type: 'file',
          name: 'state.json',
          path: 'sync/state.json',
          sha: 'x',
          content: '',
          encoding: 'none',
          size: 1024, // 1KB 走 INVALID_PAYLOAD
        });
      }
      return jsonResponse(404, { message: 'Not Found' });
    });

    try {
      const backend = new GitHubBackend(config);
      try {
        await backend.downloadSnapshot();
        expect.fail('应该抛错');
      } catch (err) {
        // 不是 RemoteSnapshotTooLargeError
        expect(err).not.toBeInstanceOf(RemoteSnapshotTooLargeError);
      }
    } finally {
      fake.restore();
    }
  });
});
